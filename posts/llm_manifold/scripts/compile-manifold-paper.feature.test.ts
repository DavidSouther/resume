import { describe, expect, it } from "vitest";
import {
	buildBibtexCommand,
	buildIcmlPandocCommand,
	buildPdfLatexCommand,
	createManifoldPaperPdfPaths,
	latexNeedsRerun,
	normalizeBibtexForClassicBibtex,
	stripPandocReferencesSection,
	stripSectionNumbers,
} from "./compile-manifold-paper.ts";

describe("manifold paper ICML PDF compiler", () => {
	it("builds a pandoc command that uses the official ICML style surface", () => {
		const paths = createManifoldPaperPdfPaths("/paper");

		const command = buildIcmlPandocCommand(paths);

		expect(command.cmd).toBe("pandoc");
		expect(command.args).toContain(paths.icmlMarkdown);
		expect(command.args).toContain("--standalone");
		expect(command.args).toContain("--syntax-highlighting=none");
		expect(command.args).toContain("--natbib");
		expect(command.args).toContain(`--template=${paths.template}`);
		expect(command.args).toContain(`--lua-filter=${paths.tableFilter}`);
		expect(command.args).toContain(`--bibliography=${paths.icmlBibliography}`);
		expect(command.args).toContain("--metadata=biblio-style:icml2026");
	});

	it("hands pandoc the LaTeX source rather than asking it to make the PDF", () => {
		// pandoc 3.10 does not run bibtex for --natbib, so a pandoc-driven
		// --pdf-engine build renders every citation as "(?)". The LaTeX passes
		// are driven explicitly below instead.
		const paths = createManifoldPaperPdfPaths("/paper");

		const command = buildIcmlPandocCommand(paths);

		expect(command.args).toContain(`--output=${paths.icmlTex}`);
		expect(command.args).not.toContain("--pdf-engine=pdflatex");
		expect(command.args.join(" ")).not.toContain(paths.outputPdf);
	});

	it("resolves the bibliography with a bibtex pass between LaTeX passes", () => {
		const paths = createManifoldPaperPdfPaths("/paper");

		const latex = buildPdfLatexCommand(paths);
		const bibtex = buildBibtexCommand(paths);

		expect(latex.cmd).toBe("pdflatex");
		expect(latex.args).toContain("-interaction=nonstopmode");
		expect(latex.args).toContain(paths.icmlTex);
		expect(latex.cwd).toBe(paths.buildDir);

		expect(bibtex.cmd).toBe("bibtex");
		expect(bibtex.args).toEqual([paths.texJobName]);
		expect(bibtex.cwd).toBe(paths.buildDir);
	});

	it("keeps running LaTeX while the log asks to be rerun", () => {
		expect(
			latexNeedsRerun(
				"LaTeX Warning: Label(s) may have changed. Rerun to get cross-references right.",
			),
		).toBe(true);
		expect(latexNeedsRerun("Output written on manifold-paper.pdf (7 pages)")).toBe(
			false,
		);
	});

	it("keeps generated PDFs and downloaded ICML assets under ignored build output", () => {
		const paths = createManifoldPaperPdfPaths("/paper");

		expect(paths.buildDir).toBe("/paper/build/llm_manifold");
		expect(paths.outputPdf).toBe(
			"/paper/build/llm_manifold/manifold-paper-icml2026.pdf",
		);
		expect(paths.icmlKitZip).toBe("/paper/build/llm_manifold/icml2026.zip");
		expect(paths.styleDir).toBe("/paper/build/llm_manifold/icml2026");
		expect(paths.icmlMarkdown).toBe("/paper/build/llm_manifold/paper.icml.md");
		expect(paths.icmlTex).toBe("/paper/build/llm_manifold/manifold-paper.tex");
		expect(paths.icmlBibliography).toBe(
			"/paper/build/llm_manifold/refs.icml.bib",
		);
		expect(paths.tableFilter).toBe("/paper/scripts/filters/icml-tables.lua");
	});

	it("defaults the paper directory to the one this script ships in", () => {
		// The script used to default to process.cwd(), so it only ran from
		// posts/llm_manifold and died anywhere else.
		const paths = createManifoldPaperPdfPaths();

		expect(paths.paperDir.endsWith("/posts/llm_manifold")).toBe(true);
		expect(paths.paper.endsWith("/posts/llm_manifold/paper.md")).toBe(true);
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

	it("removes the references section whatever number it currently carries", () => {
		// The strip was pinned to "## 10. References" and silently stopped
		// matching when the outline shrank to eight sections.
		const markdown = "## 7. Conclusion\n\nDone.\n\n## 8. References\n\nCited.\n";

		expect(stripPandocReferencesSection(markdown)).toBe(
			"## 7. Conclusion\n\nDone.\n",
		);
	});

	it("strips hand-written section numbers so LaTeX does not number them twice", () => {
		const markdown = [
			"## 5. Evaluating a New Technique Against the Operators",
			"",
			"Body with 1. an inline enumeration that must survive.",
			"",
			"### Larger context windows",
		].join("\n");

		expect(stripSectionNumbers(markdown)).toBe(
			[
				"## Evaluating a New Technique Against the Operators",
				"",
				"Body with 1. an inline enumeration that must survive.",
				"",
				"### Larger context windows",
			].join("\n"),
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
