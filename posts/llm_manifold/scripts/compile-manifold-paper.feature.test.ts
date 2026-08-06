import { describe, expect, it } from "vitest";
import {
	buildIcmlPandocCommand,
	createManifoldPaperPdfPaths,
	normalizeBibtexForClassicBibtex,
	stripPandocReferencesSection,
} from "./compile-manifold-paper.ts";

describe("manifold paper ICML PDF compiler", () => {
	it("builds a pandoc command that uses the official ICML style surface", () => {
		const paths = createManifoldPaperPdfPaths("/repo");

		const command = buildIcmlPandocCommand(paths);

		expect(command.cmd).toBe("pandoc");
		expect(command.args).toContain(paths.icmlMarkdown);
		expect(command.args).toContain("--standalone");
		expect(command.args).toContain("--syntax-highlighting=none");
		expect(command.args).toContain("--natbib");
		expect(command.args).toContain("--pdf-engine=pdflatex");
		expect(command.args).toContain(`--template=${paths.template}`);
		expect(command.args).toContain(`--lua-filter=${paths.tableFilter}`);
		expect(command.args).toContain(`--bibliography=${paths.icmlBibliography}`);
		expect(command.args).toContain("--metadata=biblio-style:icml2026");
		expect(command.args).toContain(`--output=${paths.outputPdf}`);
	});

	it("keeps generated PDFs and downloaded ICML assets under ignored build output", () => {
		const paths = createManifoldPaperPdfPaths("/repo");

		expect(paths.buildDir).toBe("/repo/build/llm_manifold");
		expect(paths.outputPdf).toBe(
			"/repo/build/llm_manifold/manifold-paper-icml2026.pdf",
		);
		expect(paths.icmlKitZip).toBe("/repo/build/llm_manifold/icml2026.zip");
		expect(paths.styleDir).toBe("/repo/build/llm_manifold/icml2026");
		expect(paths.icmlMarkdown).toBe("/repo/build/llm_manifold/paper.icml.md");
		expect(paths.icmlBibliography).toBe(
			"/repo/build/llm_manifold/refs.icml.bib",
		);
		expect(paths.tableFilter).toBe("/repo/scripts/filters/icml-tables.lua");
	});

	it("removes the citeproc references placeholder from the ICML input", () => {
		const markdown = [
			"## 9. Conclusion",
			"",
			"Done.",
			"",
			"## 10. References",
			"",
			"Rendered by pandoc `--citeproc`.",
		].join("\n");

		expect(stripPandocReferencesSection(markdown)).toBe(
			"## 9. Conclusion\n\nDone.\n",
		);
	});

	it("normalizes known Unicode names for classic BibTeX", () => {
		const bibtex =
			"author = {Vake, Domen and Vičič, Jernej and Tošić, Aleksandar},";

		expect(normalizeBibtexForClassicBibtex(bibtex)).toBe(
			"author = {Vake, Domen and Vi{\\v{c}}i{\\v{c}}, Jernej and To{\\v{s}}i{\\v{c}}, Aleksandar},",
		);
	});
});
