import { describe, expect, it } from "vitest";
import {
	buildTypstCompileCommand,
	buildTypstPandocCommand,
	createManifoldPaperPdfPaths,
} from "./compile-manifold-paper.ts";

describe("manifold paper Typst compiler", () => {
	it("uses Pandoc's Typst writer and resolves IEEE citations", () => {
		const paths = createManifoldPaperPdfPaths("/paper");

		const command = buildTypstPandocCommand(paths);

		expect(command.cmd).toBe("pandoc");
		expect(command.args).toContain(paths.paper);
		expect(command.args).toContain("--to=typst");
		expect(command.args).toContain("--standalone");
		expect(command.args).toContain("--citeproc");
		expect(command.args).toContain(`--bibliography=${paths.bibliography}`);
		expect(command.args).toContain(`--csl=${paths.csl}`);
		expect(command.args).toContain(`--output=${paths.typstSource}`);
		expect(command.args.join(" ")).not.toMatch(
			/(latex|pdflatex|bibtex|natbib|\.tex\b)/,
		);
	});

	it("compiles the generated source directly with Typst", () => {
		const paths = createManifoldPaperPdfPaths("/paper");

		const command = buildTypstCompileCommand(paths);

		expect(command).toEqual({
			cmd: "typst",
			args: [
				"compile",
				"--root=/paper",
				"/paper/build/llm_manifold/manifold-paper.typ",
				"/paper/build/llm_manifold/manifold-paper-preprint.pdf",
			],
		});
	});

	it("keeps generated artifacts under ignored build output", () => {
		const paths = createManifoldPaperPdfPaths("/paper");

		expect(paths.buildDir).toBe("/paper/build/llm_manifold");
		expect(paths.typstSource).toBe(
			"/paper/build/llm_manifold/manifold-paper.typ",
		);
		expect(paths.outputPdf).toBe(
			"/paper/build/llm_manifold/manifold-paper-preprint.pdf",
		);
	});

	it("uses the paper's IEEE CSL and BibTeX sources without copying them", () => {
		const paths = createManifoldPaperPdfPaths("/paper");

		expect(paths.bibliography).toBe("/paper/refs.bib");
		expect(paths.csl).toBe("/paper/ieee.csl");
	});

	it("defaults the paper directory to the one this script ships in", () => {
		const paths = createManifoldPaperPdfPaths();

		expect(paths.paperDir.endsWith("/posts/llm_manifold")).toBe(true);
		expect(paths.paper.endsWith("/posts/llm_manifold/paper.md")).toBe(true);
	});

	it("names a custom output relative to the paper directory", () => {
		const paths = createManifoldPaperPdfPaths("/paper", "dist/paper.pdf");

		expect(paths.outputPdf).toBe("/paper/dist/paper.pdf");
	});
});
