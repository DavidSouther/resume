import { readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
	buildPandocCommand,
	buildTypstCommand,
	compilePaper,
	createPaperPdfPaths,
	listPaperSections,
	type PaperPdfPaths,
} from "../../../scripts/compile-paper.ts";

const DEFAULT_PAPER_DIR = resolve(import.meta.dirname, "..");
type CliOptions = { output?: string; paperDir: string };

export function createManifoldPaperPdfPaths(paperDir = DEFAULT_PAPER_DIR, outputPdf?: string): PaperPdfPaths {
	const resolvedPaperDir = resolve(paperDir);
	return createPaperPdfPaths({
		paperDir: resolvedPaperDir,
		outputPdf: outputPdf ? resolve(resolvedPaperDir, outputPdf) : join(resolvedPaperDir, "build", "llm_manifold", "manifold-paper.pdf"),
		typstSourceName: "manifold-paper.typ",
	});
}

export { buildPandocCommand as buildTypstPandocCommand, buildTypstCommand as buildTypstCompileCommand, listPaperSections };

/** Folds generated Markdown table titles into their figures for below-table captions. */
export function moveGeneratedTableCaptionsBelow(typstSource: string): void {
	const source = readFileSync(typstSource, "utf8");
	const transformed = source.replace(/(#strong\[Table \d+\.\][\s\S]*?)\n\n(#figure\([\s\S]*?)\n  , kind: table\n  \)/g, (_, caption: string, figure: string) => {
		const captionBody = caption.replace(/^#strong\[Table \d+\.\]\s*/, "");
		return `${figure},\n  kind: table,\n  caption: [${captionBody}],\n)`;
	});
	writeFileSync(typstSource, addGeneratedTableRules(transformed));
}

/** Adds top, header, and final-row rules from the generated table's real row count. */
export function addGeneratedTableRules(source: string): string {
	return source
		.replace("align: (left,left,left,left,left,)", "align: (left + top,left + top,left + top,left + top,left + top,)")
		.replace(/table\.header\(\[Technique\], \[Token\s+type\], \[Signal\], \[Move\], \[Grounding\],\),\n    table\.hline\(\),/, "table.header([Technique], [Token type], [Signal], [Move], [Grounding],),\n    table.hline(y: 0, stroke: 0.5pt),\n    table.hline(y: 1, stroke: 0.35pt),")
		.replace("\n  )],\n  kind: table", "\n    table.hline(y: 8, stroke: 0.5pt),\n  )],\n  kind: table");
}

export function compileManifoldPaper(options: CliOptions = { paperDir: DEFAULT_PAPER_DIR }): void {
	const paths = createManifoldPaperPdfPaths(options.paperDir, options.output);
	compilePaper({ paperDir: paths.paperDir, outputPdf: paths.outputPdf, typstSourceName: "manifold-paper.typ", transformGeneratedTypst: moveGeneratedTableCaptionsBelow });
}

function parseArgs(args: string[]): CliOptions {
	const options: CliOptions = { paperDir: DEFAULT_PAPER_DIR };
	for (let i = 0; i < args.length; i += 1) {
		const arg = args[i];
		if (arg === "--output") { i += 1; options.output = requiredValue(args, i, arg); }
		else if (arg === "--paper-dir") { i += 1; options.paperDir = resolve(process.cwd(), requiredValue(args, i, arg)); }
		else if (arg === "--help" || arg === "-h") { printUsage(); process.exit(0); }
		else throw new Error(`unknown option: ${arg}`);
	}
	return options;
}

function requiredValue(args: string[], index: number, option: string): string {
	const value = args[index];
	if (!value) throw new Error(`${option} requires a value`);
	return value;
}

function printUsage(): void {
	console.log(`Usage: node posts/llm_manifold/scripts/compile-manifold-paper.ts [options]\n\nOptions:\n  --output <pdf>     Write the PDF relative to the paper directory.\n  --paper-dir <path> The paper directory.\n`);
}

if (import.meta.main) {
	try { compileManifoldPaper(parseArgs(process.argv.slice(2))); }
	catch (error) { console.error(error instanceof Error ? error.message : error); process.exit(1); }
}
