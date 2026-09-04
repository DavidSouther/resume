import { describe, expect, it } from "vitest";
import {
	buildTypstCompileCommand,
	buildTypstPandocCommand,
	createManifoldPaperPdfPaths,
	listPaperSections,
} from "./compile-manifold-paper.ts";

const SECTIONS = [
	"/paper/sections/01_abstract.md",
	"/paper/sections/02_intro.md",
	"/paper/sections/08_references.md",
];

describe("manifold paper Typst compiler", () => {
	it("feeds the ordered section sources directly to Pandoc", () => {
		const paths = createManifoldPaperPdfPaths("/paper");

		const command = buildTypstPandocCommand(paths, SECTIONS);

		expect(command.cmd).toBe("pandoc");
		expect(command.args.slice(0, SECTIONS.length)).toEqual(SECTIONS);
		expect(command.args).toContain("--to=typst");
		expect(command.args).toContain("--standalone");
		expect(command.args).toContain(`--output=${paths.typstSource}`);
		expect(command.cwd).toBe(paths.buildDir);
		expect(command.args.join(" ")).not.toContain("paper.md");
	});

	it("uses Typst's native IEEE bibliography rather than Citeproc and CSL", () => {
		const paths = createManifoldPaperPdfPaths("/paper");

		const command = buildTypstPandocCommand(paths, SECTIONS);

		expect(command.args).toContain("--bibliography=refs.bib");
		expect(command.args).toContain("--metadata=csl:ieee");
		expect(command.args).not.toContain("--citeproc");
		expect(command.args.join(" ")).not.toContain("ieee.csl");
	});

	it("compiles the generated source directly with Typst", () => {
		const paths = createManifoldPaperPdfPaths("/paper");

		expect(buildTypstCompileCommand(paths)).toEqual({
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
		expect(paths.buildBibliography).toBe(
			"/paper/build/llm_manifold/refs.bib",
		);
		expect(paths.typstSource).toBe(
			"/paper/build/llm_manifold/manifold-paper.typ",
		);
		expect(paths.outputPdf).toBe(
			"/paper/build/llm_manifold/manifold-paper-preprint.pdf",
		);
	});

	it("finds the repository's section files in numeric order", () => {
		const paths = createManifoldPaperPdfPaths();
		const sections = listPaperSections(paths);

		expect(sections.length).toBeGreaterThan(0);
		expect(sections.map((path) => path.split("/").at(-1))).toEqual(
			[...sections]
				.sort()
				.map((path) => path.split("/").at(-1)),
		);
		expect(sections[0]).toMatch(/01_abstract\.md$/);
	});

	it("names a custom output relative to the paper directory", () => {
		const paths = createManifoldPaperPdfPaths("/paper", "dist/paper.pdf");

		expect(paths.outputPdf).toBe("/paper/dist/paper.pdf");
	});
});
