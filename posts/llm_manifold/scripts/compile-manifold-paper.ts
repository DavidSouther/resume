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

const TEX_JOB_NAME = "manifold-paper";
const MAX_LATEX_PASSES = 4;

/** `posts/llm_manifold`, the directory this script's own `scripts/` sits in. */
const DEFAULT_PAPER_DIR = resolve(import.meta.dirname, "..");

export type Command = {
	cmd: string;
	args: string[];
	cwd?: string;
	env?: NodeJS.ProcessEnv;
};

export type ManifoldPaperPdfPaths = {
	paperDir: string;
	composeScript: string;
	paper: string;
	bibliography: string;
	icmlMarkdown: string;
	icmlTex: string;
	icmlBibliography: string;
	texJobName: string;
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
	paperDir: string;
	skipCompose: boolean;
};

/**
 * `paperDir` is `posts/llm_manifold`, not the repo root: every path below hangs
 * off the paper's own directory. It defaults to this script's parent so the
 * command works from any working directory.
 */
export function createManifoldPaperPdfPaths(
	paperDir = DEFAULT_PAPER_DIR,
	outputPdf?: string,
): ManifoldPaperPdfPaths {
	const resolvedPaperDir = resolve(paperDir);
	const buildDir = join(resolvedPaperDir, "build", "llm_manifold");

	return {
		paperDir: resolvedPaperDir,
		composeScript: join(
			resolvedPaperDir,
			"evals",
			"scripts",
			"compose_paper.py",
		),
		paper: join(resolvedPaperDir, "paper.md"),
		bibliography: join(resolvedPaperDir, "refs.bib"),
		icmlMarkdown: join(buildDir, "paper.icml.md"),
		icmlTex: join(buildDir, `${TEX_JOB_NAME}.tex`),
		icmlBibliography: join(buildDir, "refs.icml.bib"),
		texJobName: TEX_JOB_NAME,
		tableFilter: join(
			resolvedPaperDir,
			"scripts",
			"filters",
			"icml-tables.lua",
		),
		template: join(
			resolvedPaperDir,
			"scripts",
			"templates",
			"llm-manifold-icml.tex",
		),
		buildDir,
		styleDir: join(buildDir, ICML_STYLE),
		icmlKitZip: join(buildDir, `${ICML_STYLE}.zip`),
		outputPdf: outputPdf
			? resolve(resolvedPaperDir, outputPdf)
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
		`--template=${paths.template}`,
		`--lua-filter=${paths.tableFilter}`,
		`--bibliography=${paths.icmlBibliography}`,
		`--metadata=icml-style:${ICML_STYLE}`,
		"--metadata=icml-running-title:Agentic LLM Workflows as Trajectory-Steering",
		`--metadata=biblio-style:${ICML_STYLE}`,
		`--output=${paths.icmlTex}`,
	];

	if (options.accepted) {
		args.splice(args.length - 1, 0, "--metadata=icml-style-options:accepted");
	}

	return {
		cmd: "pandoc",
		args,
	};
}

/**
 * pandoc does not run bibtex for `--natbib`, so letting it drive `--pdf-engine`
 * leaves every `\citep` undefined and renders it as "(?)". The LaTeX passes are
 * therefore driven here: pdflatex, bibtex, then pdflatex twice more to settle
 * the citation and cross-reference labels.
 */
export function buildPdfLatexCommand(paths: ManifoldPaperPdfPaths): Command {
	return {
		cmd: "pdflatex",
		args: ["-interaction=nonstopmode", "-halt-on-error", paths.icmlTex],
		cwd: paths.buildDir,
		env: latexSearchEnv(paths),
	};
}

export function buildBibtexCommand(paths: ManifoldPaperPdfPaths): Command {
	return {
		cmd: "bibtex",
		args: [paths.texJobName],
		cwd: paths.buildDir,
		env: latexSearchEnv(paths),
	};
}

/**
 * How many passes it takes to settle depends on how far the inserted
 * bibliography shifts the page breaks, so the count is read off the log rather
 * than fixed. `MAX_LATEX_PASSES` only bounds a pathological oscillation.
 */
export function latexNeedsRerun(log: string): boolean {
	return /Rerun to get|Rerun LaTeX/u.test(log);
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

/**
 * natbib emits the bibliography itself, so the markdown's own References
 * heading would print an empty duplicate section above it. The section number
 * is optional in the pattern because the outline has been renumbered once
 * already and a pinned number silently stops matching.
 */
export function stripPandocReferencesSection(markdown: string): string {
	const stripped = markdown.replace(
		/\n## (?:\d+\. )?References\n[\s\S]*$/u,
		"",
	);
	return `${stripped.trimEnd()}\n`;
}

/**
 * The markdown numbers its own headings ("## 5. ...") so that the composed
 * paper.md reads correctly on its own and the eval scripts can address a
 * section by number. LaTeX numbers sections too, which prints "5. 5. ..." in
 * the PDF unless the hand-written number is dropped on the way in.
 */
export function stripSectionNumbers(markdown: string): string {
	return markdown.replace(/^(#{1,6} )\d+\.\s+/gmu, "$1");
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
		stripSectionNumbers(stripPandocReferencesSection(markdown)),
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
		cwd: command.cwd,
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
		paperDir: DEFAULT_PAPER_DIR,
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
		} else if (arg === "--paper-dir") {
			i += 1;
			options.paperDir = resolve(process.cwd(), requiredValue(args, i, arg));
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
	console.log(`Usage: node posts/llm_manifold/scripts/compile-manifold-paper.ts [options]

Compiles posts/llm_manifold/sections/*.md to an ICML-formatted PDF.
Runs from any working directory.

Options:
  --accepted          Use the ICML accepted/camera-ready notice.
  --icml-kit <zip>    Use a local ${ICML_STYLE}.zip instead of downloading it.
  --no-download       Fail if the ICML kit is not already present.
  --output <pdf>      Write the PDF to this path.
  --paper-dir <path>  The paper's directory. Defaults to the posts/llm_manifold
                      directory this script ships in.
  --skip-compose      Do not regenerate paper.md before building the PDF.
`);
}

function ensureIcmlStyleAssets(
	paths: ManifoldPaperPdfPaths,
	options: CliOptions,
): void {
	mkdirSync(paths.styleDir, { recursive: true });

	if (options.icmlKit) {
		const localKit = resolve(process.cwd(), options.icmlKit);
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
	const output = options.output
		? resolve(process.cwd(), options.output)
		: undefined;
	const paths = createManifoldPaperPdfPaths(options.paperDir, output);

	mkdirSync(dirname(paths.outputPdf), { recursive: true });

	if (!options.skipCompose) {
		console.log(`Composing ${paths.paper}...`);
		run(buildComposeCommand(paths));
	}

	console.log("Preparing ICML-specific markdown and BibTeX inputs...");
	prepareIcmlInputs(paths);

	ensureIcmlStyleAssets(paths, options);

	console.log(`Building ${paths.outputPdf}...`);
	run(buildIcmlPandocCommand(paths, options));

	const latex = buildPdfLatexCommand(paths);
	const latexLog = join(paths.buildDir, `${paths.texJobName}.log`);
	run(latex);
	run(buildBibtexCommand(paths));
	for (let pass = 0; pass < MAX_LATEX_PASSES; pass += 1) {
		run(latex);
		if (!latexNeedsRerun(readFileSync(latexLog, "utf-8"))) {
			break;
		}
	}

	const builtPdf = join(paths.buildDir, `${paths.texJobName}.pdf`);
	if (builtPdf !== paths.outputPdf) {
		copyFileSync(builtPdf, paths.outputPdf);
	}
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
