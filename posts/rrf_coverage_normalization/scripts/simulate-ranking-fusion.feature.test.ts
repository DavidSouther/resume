import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

const paperDir = resolve(import.meta.dirname, "..");
const simulator = resolve(import.meta.dirname, "simulate-ranking-fusion.ts");

describe("illustrative ranking-fusion simulation", () => {
	it("calculates the five requested methods and renders their worked comparison from one synthetic fixture", () => {
		const outputDirectory = mkdtempSync(join(tmpdir(), "rrf-ranking-fusion-"));
		const sectionPath = join(outputDirectory, "04_simulation.md");

		try {
			const result = spawnSync(process.execPath, [simulator, "--output", sectionPath], {
				cwd: resolve(paperDir, "..", ".."),
			});
			expect(result.status).toBe(0);
			if (result.status !== 0) return;

			const report = JSON.parse(new TextDecoder().decode(result.stdout)) as {
				fixture: { label: string; rankers: string[]; documents: Array<{ id: string; ranks: Record<string, number | null> }> };
				rankMaps: Record<string, Record<string, number | null>>;
				methods: Array<{ id: string; formula: string; nonzeroAtN1: boolean; boundedBonus: boolean; source: string }>;
				results: Array<{ id: string; coverage: number; scores: Record<string, number> }>;
				orders: Record<string, string[]>;
				comparisons: { rankerReversal: string; methodDisagreement: string };
			};

			expect(report.fixture.label).toMatch(/illustrative|synthetic/i);
			expect(report.fixture.rankers).toEqual(["lexical", "text embedding", "multimodal embedding"]);
			expect(report.fixture.documents).toHaveLength(7);
			expect(report.results).toHaveLength(7);
			for (const resultRow of report.results) {
				expect(resultRow.coverage).toBeGreaterThan(0);
				expect(Object.keys(resultRow.scores).sort()).toEqual(["S_1", "S_ISR", "S_RRF", "S_sat", "S_w"]);
			}
			expect(report.rankMaps).toHaveProperty("lexical");
			expect(report.rankMaps).toHaveProperty("text embedding");
			expect(report.rankMaps).toHaveProperty("multimodal embedding");
			expect(report.rankMaps["text embedding"].D).toBeLessThan(report.rankMaps["text embedding"].F);
			expect(report.rankMaps["multimodal embedding"].D).toBeGreaterThan(report.rankMaps["multimodal embedding"].F);

			const documentIds = report.fixture.documents.map((document) => document.id).sort();
			for (const methodId of ["S_RRF", "S_w", "S_ISR", "S_1", "S_sat"]) {
				expect(report.orders[methodId].slice().sort()).toEqual(documentIds);
			}
			expect(report.orders.S_RRF.indexOf("A")).toBeLessThan(report.orders.S_RRF.indexOf("B"));
			expect(report.orders.S_ISR.indexOf("B")).toBeLessThan(report.orders.S_ISR.indexOf("A"));
			expect(report.methods.map((method) => method.id)).toEqual(["S_RRF", "S_w", "S_ISR", "S_1", "S_sat"]);
			for (const method of report.methods) {
				expect(method.formula).not.toHaveLength(0);
				expect(typeof method.nonzeroAtN1).toBe("boolean");
				expect(typeof method.boundedBonus).toBe("boolean");
				expect(method.source).not.toHaveLength(0);
			}
			expect(report.comparisons.rankerReversal).toMatch(/D.*F|F.*D/);
			expect(report.comparisons.methodDisagreement).toMatch(/A.*B|B.*A/);

			const section = readFileSync(sectionPath, "utf8");
			expect(section).toContain("Illustrative home-energy retrieval fixture");
			expect(section).toContain("S_{\\mathrm{RRF}}");
			expect(section).toContain("S_w");
			expect(section).toContain("S_{\\mathrm{ISR}}");
			expect(section).toContain("S_1");
			expect(section).toContain("S_{\\mathrm{sat}}");
			expect(section).toContain("Table 1");
			expect(section).toMatch(/right side of Table 3 gives each method's document order[^.]*full-precision scores/is);
			expect(section).not.toContain("Sorting the full-precision scores produces the following orders:");
			expect(section).not.toContain("Source tier");
			expect(section).not.toContain("Prior published use");
			for (const caption of [
				"Table: Generated document scores",
				"Table: Full-precision document order",
				"Table: Strict comparisons hidden",
			]) expect(section).toContain(caption);
			expect(section).not.toContain("Table: Provenance and boundary behavior");
			expect(section).not.toContain("| Bounded coverage bonus | Source |");
			expect(section).not.toContain("n(d)");

			const displayedScoreRows = section.match(
				/^\| [A-G] \| [1-3] \| \d+\.\d{3} \| \d+\.\d{3} \| \d+\.\d{3} \| \d+\.\d{3} \| \d+\.\d{3} \|$/gm,
			);
			expect(displayedScoreRows).toHaveLength(7);
			expect(section).toContain("| A | 3 | 0.046 | 0.015 | 0.562 | 0.093 | 0.133 |");
			expect(section).toContain("$(a,b,t)=(3,0.1,2)");
			expect(section).toMatch(/singleton coverage[^.]*multiplier approaches four/i);
			expect(section).not.toContain("| A | 3 | 0.047 |");
			expect(section).toMatch(/full precision[^.]*sorting/i);
			expect(section).toMatch(/displayed ties[^.]*computational ties/i);

			const resultById = Object.fromEntries(report.results.map((result) => [result.id, result]));
			for (const { notation, methodId, higher, lower } of [
				{ notation: "S_{\\mathrm{RRF}}", methodId: "S_RRF", higher: "A", lower: "E" },
				{ notation: "S_{\\mathrm{RRF}}", methodId: "S_RRF", higher: "F", lower: "C" },
				{ notation: "S_w", methodId: "S_w", higher: "A", lower: "E" },
				{ notation: "S_1", methodId: "S_1", higher: "F", lower: "C" },
				{ notation: "S_{\\mathrm{sat}}", methodId: "S_sat", higher: "F", lower: "C" },
			]) {
				const margin = resultById[higher].scores[methodId] - resultById[lower].scores[methodId];
				expect(margin).toBeGreaterThan(0);
				expect(section).toContain(`| $${notation}$ | ${higher} > ${lower} | ${margin.toString()} |`);
			}
			expect(section).toContain("| $S_{\\mathrm{ISR}}$ | D > F > B = C > A > E > G |");
			expect(section).not.toContain("| $S_{\\mathrm{ISR}}$ | D > F > B > C > A > E > G |");
			expect(section).toMatch(/ISR is different: B and C tie exactly at 1,/i);

			for (const heading of [
				"### Synthetic setup",
				"### Reading ranker coverage",
				"### What the scoring rules emphasize",
				"### Observed fusion behavior",
				"### What this example establishes",
			]) {
				expect(section).toContain(heading);
			}
			expect(section).toMatch(/em dash[^.]*not return/i);
			expect(section).toMatch(/lexical[^.]*exact[^.]*text embedding[^.]*semantic[^.]*multimodal embedding[^.]*visual/is);
			expect(section).toMatch(/D precedes F[^.]*text embedding[^.]*F precedes D[^.]*multimodal embedding/i);
			expect(section).toMatch(/RRF ranks A above B[^.]*ISR ranks B above A/i);
			expect(section).toMatch(/weighted RRF[^.]*lexical[^.]*C[^.]*F/i);
			expect(section).toMatch(/S_1[^.]*same[^.]*order[^.]*RRF/i);
			expect(section).toMatch(/not a benchmark|does not establish retrieval quality/i);
		} finally {
			rmSync(outputDirectory, { force: true, recursive: true });
		}
	});
});
