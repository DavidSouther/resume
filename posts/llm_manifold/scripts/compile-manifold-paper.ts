import { spawnSync } from "node:child_process";
import {
	copyFileSync,
	existsSync,
	mkdirSync,
	readFileSync,
	writeFileSync,
} from "node:fs";
import { dirname, join, resolve } from "node:path";

const ICML_YEAR = 2026;
const ICML_STYLE = `icml${ICML_YEAR}`;
const ICML_KIT_URL =
	"https://media.icml.cc/Conferences/ICML2026/Styles/icml2026.zip";
const ICML_STYLE_ASSETS = [
	`${ICML_STYLE}.sty`,
	`${ICML_STYLE}.bst`,
	"algorithm.sty",
	"algorithmic.sty",
	"fancyhdr.sty",
] as const;

export type Command = {
	cmd: string;
	args: string[];
	env?: NodeJS.ProcessEnv;
};

export type ManifoldPaperPdfPaths = {
	root: string;
	manifoldDir: string;
	composeScript: string;
	paper: string;
	bibliography: string;
	icmlMarkdown: string;
	icmlBibliography: string;
	tableFilter: string;
	template: string;
	buildDir: string;
	styleDir: string;
	icmlKitZip: string;
	outputPdf: string;
};

type CliOptions = {
	accepted: boolean;
	icmlKit?: string;
	noDownload: boolean;
	output?: string;
	root: string;
	skipCompose: boolean;
};

export function createManifoldPaperPdfPaths(
	root = process.cwd(),
	outputPdf?: string,
): ManifoldPaperPdfPaths {
	const resolvedRoot = resolve(root);
	const manifoldDir = join(resolvedRoot);
	const buildDir = join(resolvedRoot, "build", "llm_manifold");

	return {
		root: resolvedRoot,
		manifoldDir,
		composeScript: join(manifoldDir, "evals", "scripts", "compose_paper.py"),
		paper: join(manifoldDir, "paper.md"),
		bibliography: join(manifoldDir, "refs.bib"),
		icmlMarkdown: join(buildDir, "paper.icml.md"),
		icmlBibliography: join(buildDir, "refs.icml.bib"),
		tableFilter: join(resolvedRoot, "scripts", "filters", "icml-tables.lua"),
		template: join(
			resolvedRoot,
			"scripts",
			"templates",
			"llm-manifold-icml.tex",
		),
		buildDir,
		styleDir: join(buildDir, ICML_STYLE),
		icmlKitZip: join(buildDir, `${ICML_STYLE}.zip`),
		outputPdf: outputPdf
			? resolve(resolvedRoot, outputPdf)
			: join(buildDir, `manifold-paper-${ICML_STYLE}.pdf`),
	};
}

export function buildComposeCommand(paths: ManifoldPaperPdfPaths): Command {
	return {
		cmd: "python3",
		args: [paths.composeScript],
	};
}

export function buildIcmlPandocCommand(
	paths: ManifoldPaperPdfPaths,
	options: Pick<CliOptions, "accepted"> = { accepted: false },
): Command {
	const args = [
		paths.icmlMarkdown,
		"--standalone",
		"--syntax-highlighting=none",
		"--shift-heading-level-by=-1",
		"--natbib",
		"--pdf-engine=pdflatex",
		`--template=${paths.template}`,
		`--lua-filter=${paths.tableFilter}`,
		`--bibliography=${paths.icmlBibliography}`,
		`--metadata=icml-style:${ICML_STYLE}`,
		"--metadata=icml-running-title:Agentic LLM Workflows as Trajectory-Steering",
		`--metadata=biblio-style:${ICML_STYLE}`,
		`--output=${paths.outputPdf}`,
	];

	if (options.accepted) {
		args.splice(args.length - 1, 0, "--metadata=icml-style-options:accepted");
	}

	return {
		cmd: "pandoc",
		args,
		env: latexSearchEnv(paths),
	};
}

function buildDownloadCommand(paths: ManifoldPaperPdfPaths): Command {
	return {
		cmd: "curl",
		args: [
			"--location",
			"--fail",
			"--show-error",
			"--output",
			paths.icmlKitZip,
			ICML_KIT_URL,
		],
	};
}

function buildExtractCommand(paths: ManifoldPaperPdfPaths): Command {
	return {
		cmd: "unzip",
		args: ["-o", "-j", paths.icmlKitZip, "-d", paths.styleDir],
	};
}

function latexSearchEnv(paths: ManifoldPaperPdfPaths): NodeJS.ProcessEnv {
	return {
		TEXINPUTS: prependSearchPath(paths.styleDir, process.env.TEXINPUTS),
		BSTINPUTS: prependSearchPath(paths.styleDir, process.env.BSTINPUTS),
		BIBINPUTS: prependSearchPath(
			dirname(paths.icmlBibliography),
			process.env.BIBINPUTS,
		),
	};
}

function prependSearchPath(path: string, existing: string | undefined): string {
	const separator = process.platform === "win32" ? ";" : ":";
	return `${path}${separator}${existing ?? ""}`;
}

export function stripPandocReferencesSection(markdown: string): string {
	const stripped = markdown.replace(/\n## 10\. References\n[\s\S]*$/u, "");
	return `${stripped.trimEnd()}\n`;
}

export function normalizeBibtexForClassicBibtex(bibtex: string): string {
	const normalized = bibtex
		.replaceAll("Vičič", "Vi{\\v{c}}i{\\v{c}}")
		.replaceAll("Tošić", "To{\\v{s}}i{\\v{c}}");

	const unknownUnicode = [...normalized].find(
		(char) => char.charCodeAt(0) > 127,
	);
	if (unknownUnicode) {
		throw new Error(
			`refs.bib contains non-ASCII BibTeX text not normalized for classic BibTeX: ${unknownUnicode}`,
		);
	}

	return normalized;
}

function prepareIcmlInputs(paths: ManifoldPaperPdfPaths): void {
	mkdirSync(paths.buildDir, { recursive: true });

	const markdown = readFileSync(paths.paper, "utf-8");
	writeFileSync(
		paths.icmlMarkdown,
		stripPandocReferencesSection(markdown),
		"utf-8",
	);

	const bibtex = readFileSync(paths.bibliography, "utf-8");
	writeFileSync(
		paths.icmlBibliography,
		normalizeBibtexForClassicBibtex(bibtex),
		"utf-8",
	);
}

function run(command: Command): void {
	const proc = spawnSync(command.cmd, command.args, {
		env: command.env ? { ...process.env, ...command.env } : process.env,
		stdio: "inherit",
	});

	if (proc.error) {
		throw proc.error;
	}
	if (proc.status !== 0) {
		throw new Error(
			`${command.cmd} failed with exit ${proc.status ?? "unknown"}`,
		);
	}
}

function parseArgs(args: string[]): CliOptions {
	const options: CliOptions = {
		accepted: false,
		noDownload: false,
		root: process.cwd(),
		skipCompose: false,
	};

	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (arg === "--accepted") {
			options.accepted = true;
		} else if (arg === "--no-download") {
			options.noDownload = true;
		} else if (arg === "--skip-compose") {
			options.skipCompose = true;
		} else if (arg === "--icml-kit") {
			i += 1;
			options.icmlKit = requiredValue(args, i, arg);
		} else if (arg === "--output") {
			i += 1;
			options.output = requiredValue(args, i, arg);
		} else if (arg === "--root") {
			i += 1;
			options.root = requiredValue(args, i, arg);
		} else if (arg === "--help" || arg === "-h") {
			printUsage();
			process.exit(0);
		} else {
			throw new Error(`unknown option: ${arg}`);
		}
	}

	return options;
}

function requiredValue(args: string[], index: number, option: string): string {
	const value = args[index];
	if (!value) {
		throw new Error(`${option} requires a value`);
	}
	return value;
}

function printUsage(): void {
	console.log(`Usage: node scripts/compile-manifold-paper.ts [options]

Compiles posts/llm_manifold/sections/*.md to an ICML-formatted PDF.

Options:
  --accepted          Use the ICML accepted/camera-ready notice.
  --icml-kit <zip>   Use a local ${ICML_STYLE}.zip instead of downloading it.
  --no-download      Fail if the ICML kit is not already present.
  --output <pdf>     Write the PDF to this path.
  --root <path>      Repo root. Defaults to the current working directory.
  --skip-compose     Do not regenerate paper.md before building the PDF.
`);
}

function ensureIcmlStyleAssets(
	paths: ManifoldPaperPdfPaths,
	options: CliOptions,
): void {
	mkdirSync(paths.styleDir, { recursive: true });

	if (options.icmlKit) {
		const localKit = resolve(options.root, options.icmlKit);
		if (localKit !== paths.icmlKitZip) {
			copyFileSync(localKit, paths.icmlKitZip);
		}
	}

	if (!existsSync(paths.icmlKitZip)) {
		if (options.noDownload) {
			throw new Error(
				`${paths.icmlKitZip} does not exist and --no-download was set`,
			);
		}
		console.log(`Downloading ${ICML_STYLE} author kit...`);
		run(buildDownloadCommand(paths));
	}

	const missing = ICML_STYLE_ASSETS.filter(
		(asset) => !existsSync(join(paths.styleDir, asset)),
	);
	if (missing.length > 0) {
		console.log(`Extracting ${ICML_STYLE} LaTeX style files...`);
		run(buildExtractCommand(paths));
	}
}

function main(): void {
	const options = parseArgs(process.argv.slice(2));
	const paths = createManifoldPaperPdfPaths(options.root, options.output);

	mkdirSync(dirname(paths.outputPdf), { recursive: true });

	if (!options.skipCompose) {
		console.log("Composing posts/llm_manifold/paper.md...");
		run(buildComposeCommand(paths));
	}

	console.log("Preparing ICML-specific markdown and BibTeX inputs...");
	prepareIcmlInputs(paths);

	ensureIcmlStyleAssets(paths, options);

	console.log(`Building ${paths.outputPdf}...`);
	run(buildIcmlPandocCommand(paths, options));
	console.log(`Wrote ${paths.outputPdf}`);
}

if (import.meta.main) {
	try {
		main();
	} catch (error) {
		console.error(error instanceof Error ? error.message : error);
		process.exit(1);
	}
}
