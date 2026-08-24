import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	buildBibtexCommand,
	buildPdfLatexCommand,
	buildPreprintPandocCommand,
	createManifoldPaperPdfPaths,
	latexNeedsRerun,
	normalizeBibtexForClassicBibtex,
	stripPandocReferencesSection,
	stripSectionNumbers,
} from "./compile-manifold-paper.ts";

describe("manifold paper preprint PDF compiler", () => {
	it("builds a pandoc command that depends only on stock LaTeX", () => {
		const paths = createManifoldPaperPdfPaths("/paper");

		const command = buildPreprintPandocCommand(paths);

		expect(command.cmd).toBe("pandoc");
		expect(command.args).toContain(paths.preprintMarkdown);
		expect(command.args).toContain("--standalone");
		expect(command.args).toContain("--syntax-highlighting=none");
		expect(command.args).toContain("--natbib");
		expect(command.args).toContain(`--template=${paths.template}`);
		expect(command.args).toContain(`--lua-filter=${paths.tableFilter}`);
		expect(command.args).toContain(
			`--bibliography=${paths.preprintBibliography}`,
		);
		expect(command.args).toContain("--metadata=biblio-style:plainnat");
		expect(command.args.join(" ")).not.toContain("icml");
	});

	it("hands pandoc the LaTeX source rather than asking it to make the PDF", () => {
		// pandoc 3.10 does not run bibtex for --natbib, so a pandoc-driven
		// --pdf-engine build renders every citation as "(?)". The LaTeX passes
		// are driven explicitly below instead.
		const paths = createManifoldPaperPdfPaths("/paper");

		const command = buildPreprintPandocCommand(paths);

		expect(command.args).toContain(`--output=${paths.texSource}`);
		expect(command.args).not.toContain("--pdf-engine=pdflatex");
		expect(command.args.join(" ")).not.toContain(paths.outputPdf);
	});

	it("resolves the bibliography with a bibtex pass between LaTeX passes", () => {
		const paths = createManifoldPaperPdfPaths("/paper");

		const latex = buildPdfLatexCommand(paths);
		const bibtex = buildBibtexCommand(paths);

		expect(latex.cmd).toBe("pdflatex");
		expect(latex.args).toContain("-interaction=nonstopmode");
		expect(latex.args).toContain(paths.texSource);
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

	it("keeps every generated artifact under ignored build output", () => {
		const paths = createManifoldPaperPdfPaths("/paper");

		expect(paths.buildDir).toBe("/paper/build/llm_manifold");
		expect(paths.outputPdf).toBe(
			"/paper/build/llm_manifold/manifold-paper-preprint.pdf",
		);
		expect(paths.preprintMarkdown).toBe(
			"/paper/build/llm_manifold/paper.preprint.md",
		);
		expect(paths.texSource).toBe(
			"/paper/build/llm_manifold/manifold-paper.tex",
		);
		expect(paths.preprintBibliography).toBe(
			"/paper/build/llm_manifold/refs.preprint.bib",
		);
		expect(paths.tableFilter).toBe(
			"/paper/scripts/filters/preprint-tables.lua",
		);
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

	it("names the author with affiliation and contact, never anonymizing", () => {
		// The ICML style hid the author list unless the build passed [accepted],
		// so the default PDF used to print "Anonymous Authors".
		const template = readFileSync(
			new URL("./templates/llm-manifold-preprint.tex", import.meta.url),
			"utf-8",
		);

		expect(template).toContain("\\author{$for(author)$$author.name$");
		expect(template).toContain("$author.affiliation$");
		expect(template).toContain("mailto:$author.email$");
		expect(template).not.toContain("icml");
	});

	it("normalizes known Unicode names for classic BibTeX", () => {
		const bibtex =
			"author = {Vake, Domen and Vičič, Jernej and Tošić, Aleksandar},";

		expect(normalizeBibtexForClassicBibtex(bibtex)).toBe(
			"author = {Vake, Domen and Vi{\\v{c}}i{\\v{c}}, Jernej and To{\\v{s}}i{\\v{c}}, Aleksandar},",
		);
	});
});
