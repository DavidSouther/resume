import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
	appendFileSync,
	copyFileSync,
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
} from "node:fs";
import { basename, dirname, join, resolve } from "node:path";

const REQUIRED_FONT_FAMILIES = ["Libertinus Serif", "JetBrains Mono"];
const INVOCATION_LOG_ENV = "PAPER_COMPILER_INVOCATION_LOG";

export type Command = { cmd: string; args: string[]; cwd?: string };
export type PaperCompilerConfig = {
	paperDir: string;
	outputPdf: string;
	typstSourceName: string;
	cslName?: string;
	transformGeneratedTypst?: (typstSource: string) => void;
};
export type PaperPdfPaths = {
	paperDir: string;
	sectionsDir: string;
	bibliography: string;
	buildBibliography: string;
	buildDir: string;
	typstSource: string;
	outputPdf: string;
};
export type SharedCompilerInvocation = { paperDir: string; outputPdf: string };
type ProvisionedFont = { family: string; file: string; sha256: string };
type FontManifest = { fonts: ProvisionedFont[] };

let invocationObserver:
	| ((invocation: SharedCompilerInvocation) => void)
	| undefined;

/** Installs a process-local observer for focused tests and returns its cleanup function. */
export function observeSharedCompilerInvocationForTest(
	callback: (invocation: SharedCompilerInvocation) => void,
): () => void {
	invocationObserver = callback;
	return () => {
		if (invocationObserver === callback) invocationObserver = undefined;
	};
}

/** Derives every generated path from a paper root rather than the process cwd. */
export function createPaperPdfPaths(
	config: PaperCompilerConfig,
): PaperPdfPaths {
	const paperDir = resolve(config.paperDir);
	const outputPdf = resolve(config.outputPdf);
	const buildDir = dirname(outputPdf);
	return {
		paperDir,
		sectionsDir: join(paperDir, "sections"),
		bibliography: join(paperDir, "refs.bib"),
		buildBibliography: join(buildDir, "refs.bib"),
		buildDir,
		typstSource: join(buildDir, config.typstSourceName),
		outputPdf,
	};
}

export function listPaperSections(paths: PaperPdfPaths): string[] {
	const sections = readdirSync(paths.sectionsDir, { withFileTypes: true })
		.filter((entry) => entry.isFile() && entry.name.endsWith(".md"))
		.map((entry) => join(paths.sectionsDir, entry.name))
		.sort();
	if (sections.length === 0)
		throw new Error(`no Markdown sections found in ${paths.sectionsDir}`);
	return sections;
}

export function buildPandocCommand(
	paths: PaperPdfPaths,
	sections: string[],
): Command {
	return {
		cmd: "pandoc",
		args: [
			...sections,
			"--to=typst",
			"--standalone",
			"--shift-heading-level-by=-1",
			"--bibliography=refs.bib",
			"--metadata=csl:ieee",
			`--lua-filter=${join(paths.paperDir, "templates", "manifold-table-widths.lua")}`,
			`--template=${join(paths.paperDir, "templates", "manifold-preprint.typ")}`,
			`--output=${paths.typstSource}`,
		],
		cwd: paths.buildDir,
	};
}

export function buildTypstCommand(paths: PaperPdfPaths): Command {
	return {
		cmd: "typst",
		args: [
			"compile",
			`--root=${paths.paperDir}`,
			`--font-path=${join(paths.paperDir, "fonts")}`,
			"--ignore-system-fonts",
			paths.typstSource,
			paths.outputPdf,
		],
	};
}

/** Compiles a paper using only assets stored below its configured root. */
export function compilePaper(config: PaperCompilerConfig): void {
	const paths = createPaperPdfPaths(config);
	observeInvocation(paths);
	validatePaperAssets(paths, config.cslName);
	mkdirSync(paths.buildDir, { recursive: true });
	copyFileSync(paths.bibliography, paths.buildBibliography);
	const sections = listPaperSections(paths);
	verifyProvisionedFonts(paths.paperDir);
	run(buildPandocCommand(paths, sections));
	config.transformGeneratedTypst?.(paths.typstSource);
	run(buildTypstCommand(paths));
}

export function verifyProvisionedFonts(paperDir: string): void {
	const fontsDir = join(paperDir, "fonts");
	const manifestPath = join(fontsDir, "manifest.json");
	let manifest: FontManifest;
	try {
		manifest = JSON.parse(readFileSync(manifestPath, "utf8")) as FontManifest;
	} catch (error) {
		throw new Error(
			`could not read font manifest ${manifestPath}: ${String(error)}`,
		);
	}
	if (!Array.isArray(manifest.fonts))
		throw new Error("font manifest must contain a fonts array");
	const families = new Set<string>();
	const files = new Set<string>();
	for (const font of manifest.fonts) {
		if (
			!font ||
			typeof font.family !== "string" ||
			typeof font.file !== "string" ||
			typeof font.sha256 !== "string"
		)
			throw new Error("font manifest has an invalid font entry");
		if (font.file !== basename(font.file) || !font.file.endsWith(".ttf"))
			throw new Error(
				`font manifest file must stay within fonts/: ${font.file}`,
			);
		if (families.has(font.family) || files.has(font.file))
			throw new Error(
				`font manifest has duplicate family or file: ${font.family}`,
			);
		families.add(font.family);
		files.add(font.file);
		const fontPath = join(fontsDir, font.file);
		if (!existsSync(fontPath))
			throw new Error(`required provisioned font is missing: ${fontPath}`);
		if (sha256(fontPath) !== font.sha256)
			throw new Error(`provisioned font digest mismatch: ${fontPath}`);
	}
	for (const family of REQUIRED_FONT_FAMILIES)
		if (!families.has(family))
			throw new Error(`font manifest is missing required family: ${family}`);
	const discovered = spawnSync(
		"typst",
		["fonts", `--font-path=${fontsDir}`, "--ignore-system-fonts"],
		{ encoding: "utf8" },
	);
	if (discovered.error || discovered.status !== 0)
		throw new Error("could not verify provisioned Typst font families");
	for (const family of REQUIRED_FONT_FAMILIES)
		if (!discovered.stdout.split("\n").includes(family))
			throw new Error(
				`Typst cannot load required provisioned family: ${family}`,
			);
}

function validatePaperAssets(paths: PaperPdfPaths, cslName?: string): void {
	const required = [
		paths.bibliography,
		join(paths.paperDir, "templates", "manifold-preprint.typ"),
		join(paths.paperDir, "templates", "manifold-table-widths.lua"),
		join(paths.paperDir, "fonts", "manifest.json"),
		...(cslName ? [join(paths.paperDir, cslName)] : []),
	];
	for (const path of required)
		if (!existsSync(path) || !statSync(path).isFile())
			throw new Error(`required paper asset is missing: ${path}`);
}

function observeInvocation(paths: PaperPdfPaths): void {
	const invocation = { paperDir: paths.paperDir, outputPdf: paths.outputPdf };
	invocationObserver?.(invocation);
	const log = process.env[INVOCATION_LOG_ENV];
	if (log) appendFileSync(log, `${JSON.stringify(invocation)}\n`);
}

function sha256(path: string): string {
	return createHash("sha256").update(readFileSync(path)).digest("hex");
}
function run(command: Command): void {
	const result = spawnSync(command.cmd, command.args, {
		cwd: command.cwd,
		stdio: "inherit",
	});
	if (result.error) throw result.error;
	if (result.status !== 0)
		throw new Error(
			`${command.cmd} failed with exit ${result.status ?? "unknown"}`,
		);
}
