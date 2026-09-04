import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { buildPandocCommand, buildTypstCommand, createRrfPaperPdfPaths, listPaperSections } from "./compile-rrf-coverage-normalization.ts";

describe("RRF coverage-normalization paper compiler", () => {
	it("uses only its paper-local paths and section inputs", () => {
		const paths = createRrfPaperPdfPaths();
		const sections = listPaperSections(paths);
		const pandoc = buildPandocCommand(paths, sections);
		const typst = buildTypstCommand(paths);

		expect(paths.paperDir).toBe(resolve(import.meta.dirname, ".."));
		expect(paths.outputPdf).toBe(resolve(paths.paperDir, "build", "rrf-coverage-normalization.pdf"));
		expect(sections).toEqual([
			resolve(paths.sectionsDir, "01_abstract.md"),
			resolve(paths.sectionsDir, "02_prior_art.md"),
			resolve(paths.sectionsDir, "03_mathematical_formulation.md"),
		]);
		expect(pandoc.cwd).toBe(paths.buildDir);
		expect(pandoc.args).toContain(`--template=${resolve(paths.paperDir, "templates", "manifold-preprint.typ")}`);
		expect(typst.args).toContain(`--font-path=${resolve(paths.paperDir, "fonts")}`);
		expect(typst.args).toContain("--ignore-system-fonts");
	});
});
