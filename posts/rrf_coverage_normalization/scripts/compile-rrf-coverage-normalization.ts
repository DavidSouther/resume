import { join, resolve } from "node:path";
import {
	buildPandocCommand,
	buildTypstCommand,
	compilePaper,
	createPaperPdfPaths,
	listPaperSections,
	type PaperPdfPaths,
} from "../../../scripts/compile-paper.ts";

const PAPER_DIR = resolve(import.meta.dirname, "..");
const OUTPUT_PDF = join(PAPER_DIR, "build", "rrf-coverage-normalization.pdf");

export function createRrfPaperPdfPaths(): PaperPdfPaths {
	return createPaperPdfPaths({ paperDir: PAPER_DIR, outputPdf: OUTPUT_PDF, typstSourceName: "rrf-coverage-normalization.typ" });
}

export { buildPandocCommand, buildTypstCommand, listPaperSections };

export function compileRrfCoverageNormalizationPaper(): void {
	compilePaper({ paperDir: PAPER_DIR, outputPdf: OUTPUT_PDF, typstSourceName: "rrf-coverage-normalization.typ", cslName: "ieee.csl" });
}

if (import.meta.main) {
	try { compileRrfCoverageNormalizationPaper(); }
	catch (error) { console.error(error instanceof Error ? error.message : error); process.exit(1); }
}
