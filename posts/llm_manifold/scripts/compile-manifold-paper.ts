import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, readdirSync } from "node:fs";
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
	sectionsDir: string;
	bibliography: string;
	buildBibliography: string;
	typstSource: string;
	buildDir: string;
	outputPdf: string;
};

type CliOptions = {
	output?: string;
	paperDir: string;
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
		sectionsDir: join(resolvedPaperDir, "sections"),
		bibliography: join(resolvedPaperDir, "refs.bib"),
		buildBibliography: join(buildDir, "refs.bib"),
		typstSource: join(buildDir, "manifold-paper.typ"),
		buildDir,
		outputPdf: outputPdf
			? resolve(resolvedPaperDir, outputPdf)
			: join(buildDir, "manifold-paper-preprint.pdf"),
	};
}

export function listPaperSections(paths: ManifoldPaperPdfPaths): string[] {
	const files = readdirSync(paths.sectionsDir)
		.filter((file) => file.endsWith(".md"))
		.sort()
		.map((file) => join(paths.sectionsDir, file));

	if (files.length === 0) {
		throw new Error(`no Markdown sections found in ${paths.sectionsDir}`);
	}
	return files;
}

/**
 * Pandoc preserves citations as native Typst `@key` references. Typst reads
 * refs.bib itself and formats the bibliography with its built-in IEEE style.
 */
export function buildTypstPandocCommand(
	paths: ManifoldPaperPdfPaths,
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
			`--output=${paths.typstSource}`,
		],
		cwd: paths.buildDir,
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
	};

	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (arg === "--output") {
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
	copyFileSync(paths.bibliography, paths.buildBibliography);

	const sections = listPaperSections(paths);
	console.log(`Generating ${paths.typstSource} from ${sections.length} sections...`);
	run(buildTypstPandocCommand(paths, sections));

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
