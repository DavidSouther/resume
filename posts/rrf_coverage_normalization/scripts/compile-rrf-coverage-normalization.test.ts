import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import {
	buildPandocCommand,
	buildTypstCommand,
	createRrfPaperPdfPaths,
	listPaperSections,
} from "./compile-rrf-coverage-normalization.ts";

const paperDir = resolve(import.meta.dirname, "..");
const compiler = resolve(
	import.meta.dirname,
	"compile-rrf-coverage-normalization.ts",
);
const abstractParagraph =
	"Ranked fusion is the task of combining several retrievers with non-comprable rank scores into a cohesive whole ranking.  Reciprocal-rank fusion coverage normalization makes retrieval scores comparable when candidate lists have unequal support, preserving the rank-sensitive behavior that makes RRF useful for heterogeneous retrieval systems. In this paper, we introduce a family of functions that allows tuning the relative contributions of agreement across retrievers. With these techniques, it is possible to specifically choose for agreement across rankers, without allowing a single retriever to outrank others or allowing a plurality to overwhelm one another.";

describe("RRF coverage-normalization paper compiler", () => {
	it("uses only its paper-local paths and section inputs", () => {
		const paths = createRrfPaperPdfPaths();
		const sections = listPaperSections(paths);
		const pandoc = buildPandocCommand(paths, sections);
		const typst = buildTypstCommand(paths);

		expect(paths.paperDir).toBe(resolve(import.meta.dirname, ".."));
		expect(paths.outputPdf).toBe(
			resolve(paths.paperDir, "build", "rrf-coverage-normalization.pdf"),
		);
		expect(sections).toEqual([
			resolve(paths.sectionsDir, "01_abstract.md"),
			resolve(paths.sectionsDir, "02_prior_art.md"),
			resolve(paths.sectionsDir, "03_mathematical_formulation.md"),
			resolve(paths.sectionsDir, "04_simulation.md"),
			resolve(paths.sectionsDir, "05_discussion_conclusion.md"),
		]);
		expect(pandoc.cwd).toBe(paths.buildDir);
		expect(pandoc.args).toContain(
			`--template=${resolve(paths.paperDir, "templates", "manifold-preprint.typ")}`,
		);
		expect(typst.args).toContain(
			`--font-path=${resolve(paths.paperDir, "fonts")}`,
		);
		expect(typst.args).toContain("--ignore-system-fonts");
	});

	it("renders the paper metadata as a centered title and offset abstract", () => {
		const build = spawnSync(process.execPath, [compiler], {
			cwd: resolve(paperDir, "..", ".."),
			encoding: "utf8",
		});
		expect(build.status, build.stderr).toBe(0);

		const abstractSource = readFileSync(
			resolve(paperDir, "sections", "01_abstract.md"),
			"utf8",
		);
		const generatedTypst = readFileSync(
			resolve(paperDir, "build", "rrf-coverage-normalization.typ"),
			"utf8",
		);
		const normalizedGeneratedTypst = generatedTypst
			.replaceAll("\\@", "@")
			.replaceAll(/\s+/g, " ");
		const normalizedAbstractParagraph = abstractParagraph.replaceAll(
			/\s+/g,
			" ",
		);
		const template = readFileSync(
			resolve(paperDir, "templates", "manifold-preprint.typ"),
			"utf8",
		);

		expect(abstractSource).toContain(
			'title: "Coverage Normalization for Reciprocal Rank Fusion"',
		);
		expect(abstractSource).toContain("name: David Souther");
		expect(abstractSource).toContain(
			"affiliation: Independent researcher, Brooklyn, New York, USA",
		);
		expect(abstractSource).toContain("email: davidsouther@gmail.com");
		expect(abstractSource).toContain("date: 2026");
		expect(abstractSource).toContain(
			`abstract: >\n  ${abstractParagraph}\n---`,
		);

		expect(normalizedGeneratedTypst).toContain(
			"title: [Coverage Normalization for Reciprocal Rank Fusion]",
		);
		expect(normalizedGeneratedTypst).toContain("name: [David Souther]");
		expect(normalizedGeneratedTypst).toContain(
			"affiliation: [Independent researcher, Brooklyn, New York, USA]",
		);
		expect(normalizedGeneratedTypst).toContain(
			"email: [davidsouther@gmail.com]",
		);
		expect(normalizedGeneratedTypst).toContain("date: [2026]");
		expect(normalizedGeneratedTypst).toContain("abstract-title: [Abstract]");
		expect(normalizedGeneratedTypst).toContain(
			`abstract: [${normalizedAbstractParagraph}`,
		);

		expect(template).toContain("#align(center, block[");
		expect(template).toContain(
			'block(inset: (x: 0.4in, y: 0.55em))[#text(weight: "bold")[#abstract-title]',
		);
	});
});
