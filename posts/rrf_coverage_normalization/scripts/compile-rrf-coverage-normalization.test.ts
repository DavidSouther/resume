import { readdirSync } from "node:fs";
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
		const onDisk = readdirSync(paths.sectionsDir)
			.filter((name) => /^\d\d_.+\.md$/.test(name))
			.sort()
			.map((name) => resolve(paths.sectionsDir, name));
		expect(sections).toEqual(onDisk);
		expect(sections.length).toBeGreaterThan(0);
		for (const section of sections) expect(pandoc.args).toContain(section);
		expect(pandoc.cwd).toBe(paths.buildDir);
		expect(pandoc.args).toContain(`--template=${resolve(paths.paperDir, "templates", "manifold-preprint.typ")}`);
		expect(typst.args).toContain(`--font-path=${resolve(paths.paperDir, "fonts")}`);
		expect(typst.args).toContain("--ignore-system-fonts");
	});
});
