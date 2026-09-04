import { spawnSync } from "node:child_process";
import { existsSync, mkdtempSync, readFileSync, rmSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { createRrfPaperPdfPaths, listPaperSections } from "./compile-rrf-coverage-normalization.ts";

const paperDir = resolve(import.meta.dirname, "..");
const section = resolve(paperDir, "sections", "05_discussion_conclusion.md");
const bibliography = resolve(paperDir, "refs.bib");
const simulator = resolve(import.meta.dirname, "simulate-ranking-fusion.ts");
const compiler = resolve(import.meta.dirname, "compile-rrf-coverage-normalization.ts");
const generatedTypst = resolve(paperDir, "build", "rrf-coverage-normalization.typ");
const outputPdf = resolve(paperDir, "build", "rrf-coverage-normalization.pdf");
const repositoryRoot = resolve(paperDir, "..", "..");

/** Removes every space so mathematical tokens compare independently of hard wrapping. */
function compact(value: string): string {
	return value.replaceAll(/\s+/g, "");
}

/** Collapses whitespace runs so prose tokens survive hard wrapping. */
function flatten(value: string): string {
	return value.replaceAll(/\s+/g, " ");
}

function blockBetween(markdown: string, heading: string, nextHeading?: string): string {
	const startMarker = `${heading}\n`;
	const start = markdown.indexOf(startMarker);
	expect(start).toBeGreaterThanOrEqual(0);
	if (nextHeading === undefined) return markdown.slice(start);

	const end = markdown.indexOf(`${nextHeading}\n`, start + startMarker.length);
	expect(end).toBeGreaterThan(start);
	return markdown.slice(start, end);
}

type SimulationReport = {
	fixture: { k: number; rankers: string[] };
	rankMaps: Record<string, Record<string, number | null>>;
	results: Array<{ id: string; coverage: number; scores: Record<string, number> }>;
	orders: Record<string, string[]>;
};

/** Reproduces the Worked Example's order rendering, including its exact-tie marker. */
function renderOrder(report: SimulationReport, scoreId: string): string {
	const scoreOf = (id: string) =>
		report.results.find((result) => result.id === id)?.scores[scoreId] ?? Number.NaN;
	return report.orders[scoreId]
		.map((id, index, order) =>
			index === 0 ? id : `${scoreOf(order[index - 1]) === scoreOf(id) ? " = " : " > "}${id}`,
		)
		.join("");
}

describe("RRF discussion and conclusion", () => {
	it("closes the paper with the measured fusion differences, the A over B judgment, hedged suitability, and next steps", () => {
		// Arrange: recompute the Worked Example report so every expected value is derived, not copied.
		// Section 4 drifted from this generator once already, so hardcoded literals are not trusted here.
		const reportDirectory = mkdtempSync(join(tmpdir(), "rrf-discussion-"));
		let report: SimulationReport;
		try {
			const generated = spawnSync(
				process.execPath,
				[simulator, "--output", join(reportDirectory, "04_simulation.md")],
				{ cwd: repositoryRoot },
			);
			expect(generated.status).toBe(0);
			report = JSON.parse(new TextDecoder().decode(generated.stdout)) as SimulationReport;
		} finally {
			rmSync(reportDirectory, { recursive: true, force: true });
		}

		// The closing section exists and the compiler discovers it after the Worked Example.
		expect(existsSync(section)).toBe(true);
		expect(listPaperSections(createRrfPaperPdfPaths())).toContain(section);

		const markdown = readFileSync(section, "utf8");
		const references = readFileSync(bibliography, "utf8");
		expect(markdown.startsWith("## Discussion and Conclusion\n")).toBe(true);

		const headings = [
			"## Discussion and Conclusion",
			"### What the worked example separates",
			"### Why the A and B pair reverses",
			"### Where each rule appears to fit",
			"### Next steps",
		];
		const blocks = new Map(
			headings.map((heading, index) => [heading, blockBetween(markdown, heading, headings[index + 1])]),
		);

		// Assert: the lede restates the coverage-bonus question in the paper's own notation.
		const lede = blocks.get("## Discussion and Conclusion") ?? "";
		const compactLede = compact(lede);
		for (const token of ["$|R_d|$", "$r_i(d)$", "$k$", "$b$", "$a$", "$t$"])
			expect(compactLede).toContain(token);
		expect(lede).toMatch(/coverage/i);

		// Assert: measured results, restricted to the five rules the fixture computes.
		const measured = blocks.get("### What the worked example separates") ?? "";
		expect(measured).toMatch(/illustrative[^.]*not a benchmark/i);
		const flatMeasured = flatten(measured);
		const compactMeasured = compact(measured);
		for (const scoreId of ["S_RRF", "S_w", "S_ISR", "S_1", "S_sat"]) {
			expect(flatMeasured).toContain(renderOrder(report, scoreId));
		}
		for (const symbol of ["S_{\\mathrm{RRF}}", "S_w", "S_{\\mathrm{ISR}}", "S_1", "S_{\\mathrm{sat}}"] ) {
			expect(compactMeasured).toContain(symbol);
		}
		for (const result of report.results) expect(flatMeasured).toMatch(new RegExp(`\\b${result.id}\\b`));
		const coverageLevels = [...new Set(report.results.map((result) => result.coverage))].sort();
		for (const level of coverageLevels) expect(compactMeasured).toContain(`$|R_d|=${level}$`);

		// The exact ISR tie is a report fact, not a display artifact, so the section must call it exact.
		const isrScore = (id: string) => report.results.find((result) => result.id === id)?.scores.S_ISR;
		expect(isrScore("B")).toBe(isrScore("C"));
		expect(compactMeasured).toContain(
			`S_{\\mathrm{ISR}}(B)=S_{\\mathrm{ISR}}(C)=${isrScore("B")}`,
		);
		expect(measured).toMatch(/exact/i);

		// The input-level D and F reversal names both embedding channels.
		expect(report.rankMaps["text embedding"].D).toBeLessThan(report.rankMaps["text embedding"].F ?? 0);
		expect(report.rankMaps["multimodal embedding"].F).toBeLessThan(
			report.rankMaps["multimodal embedding"].D ?? 0,
		);
		for (const ranker of ["text embedding", "multimodal embedding"]) {
			expect(flatMeasured).toContain(ranker);
		}
		expect(measured).toMatch(/revers/i);

		// The fixed-weight exchange, and the margin bound that makes it possible.
		expect(measured).toMatch(/exchang/i);
		const rrfScore = (id: string) => report.results.find((result) => result.id === id)?.scores.S_RRF ?? 0;
		expect(rrfScore("F") - rrfScore("C")).toBeGreaterThan(0);
		expect(rrfScore("F") - rrfScore("C")).toBeLessThan(1e-5);
		expect(compactMeasured).toContain("$10^{-5}$");

		// Assert: the Closing Bell Task 3 answer stands alone under its own heading.
		const disagreement = blocks.get("### Why the A and B pair reverses") ?? "";
		const flatDisagreement = flatten(disagreement);
		const ranksOf = (id: string) =>
			report.fixture.rankers
				.map((ranker) => report.rankMaps[ranker][id])
				.filter((rank): rank is number => rank !== null && rank !== undefined);
		expect(ranksOf("A")).toEqual([4, 4, 4]);
		expect(ranksOf("B")).toEqual([1]);
		expect(flatDisagreement).toContain("A above B");
		expect(flatDisagreement).toContain("rank 4");
		expect(flatDisagreement).toContain("rank 1");
		expect(compact(disagreement)).toContain(`$k=${report.fixture.k}$`);
		expect(disagreement).toMatch(/inverse[- ]square/i);
		expect(disagreement).toMatch(/\bRRF\b/);
		expect(disagreement).toMatch(/\bISR\b/);
		expect(disagreement).toMatch(/judg/i);

		// Assert: every rule gets a hedged suitability statement traced to a Section 3 growth rate.
		const suitability = blocks.get("### Where each rule appears to fit") ?? "";
		const compactSuitability = compact(suitability);
		for (const symbol of [
			"S_{\\mathrm{RRF}}",
			"S_{\\mathrm{avg}}",
			"S_w",
			"S_{\\mathrm{RBC}}",
			"S_{\\mathrm{ISR}}",
			"S_{\\mathrm{logISR}}",
			"S_{\\mathrm{logNISR}}",
			"S_{\\mathrm{log}}",
			"S_1",
			"S_{\\mathrm{sat}}",
		]) {
			expect(compactSuitability).toContain(symbol);
		}
		expect(suitability).toMatch(/unbounded[^.]*multiplier/i);
		expect(suitability).toMatch(/bounded[^.]*multiplier/i);
		expect(suitability).toMatch(/additional[^.]*positive[^.]*increases/i);
		expect(suitability).toMatch(/correlat/i);
		for (const growth of [
			"$n/(k+r)$",
			"$1/(k+r)$",
			"$nw/(k+r)$",
			"$nq_\\phi(r)$",
			"$n^2/r^2$",
			"$n\\lnn/r^2$",
			"$n\\ln(n+\\sigma)/r^2$",
			"$Bn\\ln(n+b)/(k+r)$",
		]) {
			expect(compactSuitability).toContain(growth);
		}
		// The four rules the fixture does not compute are labelled as analytic, not measured.
		expect(suitability).toMatch(/analytic/i);
		expect(suitability.match(/\bappears? to\b|\bcan\b|\blikely\b/gi)?.length ?? 0).toBeGreaterThanOrEqual(4);
		// Section 4 disclaims superiority of any one rule, so this section must not assert it.
		expect(suitability).not.toMatch(/\bsuperior\b|\bbest rule\b|\boutperform/i);

		// Assert: one explicit next-steps statement, hedged, with no new bibliography key.
		const nextSteps = blocks.get("### Next steps") ?? "";
		expect(nextSteps).toMatch(/relevance judgment/i);
		expect(nextSteps).toMatch(/metric/i);
		expect(nextSteps).toMatch(/weight/i);
		expect(nextSteps).toMatch(/parameter grid/i);
		expect(nextSteps).toMatch(/not an optimum/i);
		expect(nextSteps).toMatch(/would need|would require|appears|\bcan\b/i);
		expect(nextSteps).not.toContain("[@");

		// Assert: house style, and no contradiction with Section 4's document-count drift.
		expect(markdown).not.toContain("$$");
		expect(markdown).not.toMatch(/\\log(?:\b|_)/);
		expect(markdown).not.toMatch(/\bthis paper\b/i);
		// Section 4 states both "six documents" and "seven documents". Silence here avoids a visible
		// contradiction. Remove this assertion once the project's cleanup step repairs Section 4.
		expect(markdown).not.toMatch(/\b(?:six|seven)\s+documents\b/i);
		for (const citation of markdown.match(/@[A-Za-z][A-Za-z0-9]*/g) ?? []) {
			expect(references).toContain(`{${citation.slice(1)},`);
		}

		// Assert: the closing section reaches the compiled paper, after the Worked Example.
		rmSync(outputPdf, { force: true });
		const compiledPaper = spawnSync(process.execPath, [compiler], { cwd: repositoryRoot });
		expect(compiledPaper.status).toBe(0);
		expect(existsSync(outputPdf)).toBe(true);
		expect(statSync(outputPdf).size).toBeGreaterThan(0);

		const rendered = readFileSync(generatedTypst, "utf8");
		const workedExampleStart = rendered.indexOf("= Simulation");
		const discussionStart = rendered.indexOf("= Discussion and Conclusion");
		expect(workedExampleStart).toBeGreaterThanOrEqual(0);
		expect(discussionStart).toBeGreaterThan(workedExampleStart);
	});
});
