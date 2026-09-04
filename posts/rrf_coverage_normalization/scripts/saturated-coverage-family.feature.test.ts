import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, it } from "vitest";

const paperDir = resolve(import.meta.dirname, "..");
const repositoryRoot = resolve(paperDir, "..", "..");
const simulator = resolve(import.meta.dirname, "simulate-ranking-fusion.ts");
const formulation = resolve(paperDir, "sections", "03_mathematical_formulation.md");
const provenanceTable = resolve(paperDir, "figures", "scoring-rule-provenance-table.typ");
const figures = resolve(paperDir, "sections", "03_diagram_examples");

it("uses the approved saturated tuple in the figures and generated simulation", () => {
	const outputDirectory = mkdtempSync(join(tmpdir(), "rrf-saturated-"));
	try {
		const output = join(outputDirectory, "04_simulation.md");
		const run = spawnSync(process.execPath, [simulator, "--output", output], { cwd: repositoryRoot });
		expect(run.status).toBe(0);
		const report = JSON.parse(new TextDecoder().decode(run.stdout)) as {
			results: Array<{ id: string; coverage: number; scores: Record<string, number> }>;
			orders: Record<string, string[]>;
		};
		const expected = {
			A: 0.13311454357671076, B: 0.013871913292982421, C: 0.06732630790757031,
			D: 0.1374323981417342, E: 0.13106662752168446, F: 0.06734382711337505,
			G: 0.0134315350932052,
		};
		for (const result of report.results) {
			expect(result.scores.S_sat).toBeCloseTo(expected[result.id as keyof typeof expected], 12);
			expect(1 + 3 * (1 - Math.exp((1.1 - result.coverage) / 2))).toBeGreaterThan(0);
		}
		expect(report.orders.S_sat).toEqual(["D", "A", "E", "F", "C", "B", "G"]);
		const generated = readFileSync(output, "utf8");
		expect(generated).toContain("$(a,b,t)=(3,0.1,2)");
		expect(generated).toMatch(/singleton coverage[^.]*multiplier approaches four/i);

		const figureOne = readFileSync(join(figures, "rank-profile-comparison.typ"), "utf8");
		expect(figureOne).toContain("#let logrrf-ratios");
		expect(figureOne).toContain("#let saturated-ratios");
		expect(figureOne).toContain("3.392621");
		expect(figureOne).toContain("3.838390");
		expect(figureOne).toContain('#let log-fill = rgb("#E41A1C")');
		expect(figureOne).toContain('#let saturated-fill = rgb("#377EB8")');
		expect(figureOne).toContain("whitespace separates profiles");

		const figureTwo = readFileSync(join(figures, "rank-profile-comparison-grid.typ"), "utf8");
		for (const method of ["log-rrf", "saturated-rrf", "rbc", "isr", "log-isr"])
			expect(figureTwo).toContain(`#let ${method}`);
		expect(figureTwo).toContain("ranks $(1,1)$");
		expect(figureTwo.match(/panel\(\[\([a-e]\)/g)).toHaveLength(5);
		expect(readFileSync(formulation, "utf8")).toContain("$S_{\\mathrm{sat}}(d;3,0.1,2)$");
		const provenance = readFileSync(provenanceTable, "utf8");
		expect(provenance).toContain('[$S_(upright("sat"))$]');
		expect(provenance).toContain("block: true");
		expect(provenance).toContain("1 + a (1 - exp((1 + b - |R_d|) / t))");
	} finally {
		rmSync(outputDirectory, { recursive: true, force: true });
	}
});
