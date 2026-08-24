import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/**
 * The paper is an arXiv-style preprint, not a submission to a venue with its
 * own style file, so the build depends only on what TeX Live ships.
 */
const BIBLIO_STYLE = "plainnat";

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
	preprintMarkdown: string;
	texSource: string;
	preprintBibliography: string;
	texJobName: string;
	tableFilter: string;
	template: string;
	buildDir: string;
	outputPdf: string;
};

type CliOptions = {
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
		preprintMarkdown: join(buildDir, "paper.preprint.md"),
		texSource: join(buildDir, `${TEX_JOB_NAME}.tex`),
		preprintBibliography: join(buildDir, "refs.preprint.bib"),
		texJobName: TEX_JOB_NAME,
		tableFilter: join(
			resolvedPaperDir,
			"scripts",
			"filters",
			"preprint-tables.lua",
		),
		template: join(
			resolvedPaperDir,
			"scripts",
			"templates",
			"llm-manifold-preprint.tex",
		),
		buildDir,
		outputPdf: outputPdf
			? resolve(resolvedPaperDir, outputPdf)
			: join(buildDir, "manifold-paper-preprint.pdf"),
	};
}

export function buildComposeCommand(paths: ManifoldPaperPdfPaths): Command {
	return {
		cmd: "python3",
		args: [paths.composeScript],
	};
}

export function buildPreprintPandocCommand(
	paths: ManifoldPaperPdfPaths,
): Command {
	return {
		cmd: "pandoc",
		args: [
			paths.preprintMarkdown,
			"--standalone",
			"--syntax-highlighting=none",
			"--shift-heading-level-by=-1",
			"--natbib",
			`--template=${paths.template}`,
			`--lua-filter=${paths.tableFilter}`,
			`--bibliography=${paths.preprintBibliography}`,
			`--metadata=biblio-style:${BIBLIO_STYLE}`,
			`--output=${paths.texSource}`,
		],
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
		args: ["-interaction=nonstopmode", "-halt-on-error", paths.texSource],
		cwd: paths.buildDir,
	};
}

export function buildBibtexCommand(paths: ManifoldPaperPdfPaths): Command {
	return {
		cmd: "bibtex",
		args: [paths.texJobName],
		cwd: paths.buildDir,
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

function preparePreprintInputs(paths: ManifoldPaperPdfPaths): void {
	mkdirSync(paths.buildDir, { recursive: true });

	const markdown = readFileSync(paths.paper, "utf-8");
	writeFileSync(
		paths.preprintMarkdown,
		stripSectionNumbers(stripPandocReferencesSection(markdown)),
		"utf-8",
	);

	const bibtex = readFileSync(paths.bibliography, "utf-8");
	writeFileSync(
		paths.preprintBibliography,
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
		paperDir: DEFAULT_PAPER_DIR,
		skipCompose: false,
	};

	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (arg === "--skip-compose") {
			options.skipCompose = true;
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

Compiles posts/llm_manifold/sections/*.md to an arXiv-style preprint PDF.
Runs from any working directory.

Options:
  --output <pdf>      Write the PDF to this path.
  --paper-dir <path>  The paper's directory. Defaults to the posts/llm_manifold
                      directory this script ships in.
  --skip-compose      Do not regenerate paper.md before building the PDF.
`);
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

	console.log("Preparing LaTeX markdown and BibTeX inputs...");
	preparePreprintInputs(paths);

	console.log(`Building ${paths.outputPdf}...`);
	run(buildPreprintPandocCommand(paths));

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
