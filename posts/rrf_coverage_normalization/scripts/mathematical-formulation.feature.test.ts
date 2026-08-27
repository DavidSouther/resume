import { spawnSync } from "node:child_process";
import { existsSync, readFileSync, rmSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const paperDir = resolve(import.meta.dirname, "..");
const section = resolve(paperDir, "sections", "03_mathematical_formulation.md");
const bibliography = resolve(paperDir, "refs.bib");
const generatedTypst = resolve(paperDir, "build", "rrf-coverage-normalization.typ");
const outputPdf = resolve(paperDir, "build", "rrf-coverage-normalization.pdf");
const compiler = resolve(import.meta.dirname, "compile-rrf-coverage-normalization.ts");

describe("RRF mathematical formulation", () => {
	it("compiles five sourced formulas in shared notation with the shifted-log bias boundaries", () => {
		const markdown = readFileSync(section, "utf8");
		const references = readFileSync(bibliography, "utf8");

		const notation = [
			"I is the retriever-index set.",
			"I_d contains the retrievers whose rankings contain document d.",
			"n(d) = |I_d|.",
			"r_i(d) is the one-based rank of d under retriever i.",
			"k > 0.",
			"w_i >= 0.",
			"0 <= phi < 1.",
			"b > 0.",
			"log is the natural logarithm.",
		];
		for (const notationStatement of notation) {
			expect(markdown).toContain(notationStatement);
		}

		const definitions = [
			{
				heading: "### Plain RRF",
				formula: "S_RRF(d) = sum_{i in I_d} 1/(k+r_i(d))",
				expectedCitations: ["@cormack2009"],
				tier: "Evidence tier: primary paper.",
			},
			{
				heading: "### Coverage division",
				formula: "S_avg(d) = S_RRF(d)/n(d)",
				expectedCitations: ["@cormack2009"],
				tier: "Evidence tier: paper-defined comparator.",
			},
			{
				heading: "### Fixed retriever weights",
				formula: "S_w(d) = sum_{i in I_d} w_i/(k+r_i(d))",
				expectedCitations: ["@azureVectorWeighting"],
				tier: "Evidence tier: official documentation.",
			},
			{
				heading: "### Rank-Biased Centroid",
				formula: "S_RBC(d) = sum_{i in I_d} (1-phi)phi^(r_i(d)-1)",
				expectedCitations: ["@bailey2017"],
				tier: "Evidence tier: primary paper.",
			},
			{
				heading: "### Shifted-log candidate",
				formula: "S_log(d; b) = S_RRF(d) log(n(d)+b)",
				expectedCitations: ["@cormack2009", "@mourao2014"],
				tier: "Evidence tier: this paper's proposal.",
			},
		];
		const analysisHeading = "### Boundary and coverage analysis";
		const blockHeadings = [
			...definitions.map((definition) => definition.heading),
			analysisHeading,
		];
		const blockStarts = blockHeadings.map((heading) => {
			const marker = `${heading}\n`;
			expect(markdown.split(marker)).toHaveLength(2);
			return markdown.indexOf(marker);
		});
		for (let index = 1; index < blockStarts.length; index += 1) {
			expect(blockStarts[index]).toBeGreaterThan(blockStarts[index - 1]);
		}

		for (const [index, definition] of definitions.entries()) {
			const block = markdown.slice(blockStarts[index], blockStarts[index + 1]);
			expect(block).toContain(definition.formula);
			expect(block).toContain(definition.tier);
			for (const citation of definition.expectedCitations) {
				expect(block).toContain(citation);
				expect(references).toContain(`{${citation.slice(1)},`);
			}
		}

		const requiredConclusions = [
			"The returned-document domain is n(d) >= 1.",
			"The singleton multiplier is positive for every b > 0.",
			"The zero-coverage logarithm log(b) is finite for b > 0.",
			"The empty RRF sum makes the extended score zero.",
			"When 0 < b < 1, log(b) is negative.",
			"When b = 1, log(b) is zero.",
			"When b > 1, log(b) is positive.",
			"As b approaches zero, log(1+b) approaches zero.",
			"At b = 1, the singleton multiplier is log(2).",
			"Over a fixed finite coverage range, the multiplier becomes nearly constant.",
			"As b increases, ordering approaches scaled plain RRF.",
			"Fixed weights are independent of n(d).",
			"Fixed weights do not normalize realized coverage.",
			"The logarithmic multiplier has diminishing increments.",
			"At equal ranks, plain RRF grows in proportion to n.",
			"At equal ranks, the candidate grows in proportion to n log(n+b).",
			"The total coverage reward is unbounded.",
			"This is not a division-style normalization.",
		];
		const analysis = markdown.slice(blockStarts.at(-1));
		for (const conclusion of requiredConclusions) {
			expect(analysis).toContain(conclusion);
		}

		rmSync(outputPdf, { force: true });
		const result = spawnSync(process.execPath, [compiler], {
			cwd: resolve(paperDir, "..", ".."),
		});

		expect(result.status).toBe(0);
		expect(existsSync(outputPdf)).toBe(true);
		expect(statSync(outputPdf).size).toBeGreaterThan(0);

		const rendered = readFileSync(generatedTypst, "utf8")
			.replaceAll("\\_", "_")
			.replaceAll("\\<", "<")
			.replaceAll("\\>", ">")
			.replaceAll(/\s+/g, " ");
		for (const notationStatement of notation) {
			expect(rendered).toContain(notationStatement);
		}
		for (const definition of definitions) {
			expect(rendered).toContain(definition.formula);
			expect(rendered).toContain(definition.tier);
			for (const citation of definition.expectedCitations) {
				expect(rendered).toContain(citation);
			}
		}
		for (const conclusion of requiredConclusions) {
			expect(rendered).toContain(conclusion);
		}
	});
});
