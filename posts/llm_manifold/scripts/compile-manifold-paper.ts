import { spawnSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

/** `posts/llm_manifold`, the directory this script's own `scripts/` sits in. */
const DEFAULT_PAPER_DIR = resolve(import.meta.dirname, "..");

export type Command = {
	cmd: string;
	args: string[];
	cwd?: string;
};

export type ManifoldPaperPdfPaths = {
	paperDir: string;
	composeScript: string;
	paper: string;
	bibliography: string;
	csl: string;
	typstSource: string;
	buildDir: string;
	outputPdf: string;
};

type CliOptions = {
	output?: string;
	paperDir: string;
	skipCompose: boolean;
};

/**
 * Every generated artifact stays below the ignored paper build directory.
 * The default is based on this script, so the command works from any cwd.
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
		csl: join(resolvedPaperDir, "ieee.csl"),
		typstSource: join(buildDir, "manifold-paper.typ"),
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

/**
 * Pandoc resolves citations before emitting Typst. This preserves the paper's
 * IEEE citation style without requiring BibTeX or a bibliography pass.
 */
export function buildTypstPandocCommand(
	paths: ManifoldPaperPdfPaths,
): Command {
	return {
		cmd: "pandoc",
		args: [
			paths.paper,
			"--to=typst",
			"--standalone",
			"--citeproc",
			"--shift-heading-level-by=-1",
			`--bibliography=${paths.bibliography}`,
			`--csl=${paths.csl}`,
			`--output=${paths.typstSource}`,
		],
	};
}

export function buildTypstCompileCommand(
	paths: ManifoldPaperPdfPaths,
): Command {
	return {
		cmd: "typst",
		args: [
			"compile",
			`--root=${paths.paperDir}`,
			paths.typstSource,
			paths.outputPdf,
		],
	};
}

function run(command: Command): void {
	const proc = spawnSync(command.cmd, command.args, {
		cwd: command.cwd,
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

Compiles posts/llm_manifold/sections/*.md to an arXiv-style preprint PDF
using Pandoc and Typst. Runs from any working directory.

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

	mkdirSync(paths.buildDir, { recursive: true });
	mkdirSync(dirname(paths.outputPdf), { recursive: true });

	if (!options.skipCompose) {
		console.log(`Composing ${paths.paper}...`);
		run(buildComposeCommand(paths));
	}

	console.log(`Generating ${paths.typstSource}...`);
	run(buildTypstPandocCommand(paths));

	console.log(`Building ${paths.outputPdf} with Typst...`);
	run(buildTypstCompileCommand(paths));
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
