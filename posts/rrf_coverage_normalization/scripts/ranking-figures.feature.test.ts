import { existsSync, readFileSync, statSync } from "node:fs";
import { resolve } from "node:path";
import { expect, it } from "vitest";
import { compileRrfCoverageNormalizationPaper } from "./compile-rrf-coverage-normalization.ts";

const paperDir = resolve(import.meta.dirname, "..");
const section = resolve(paperDir, "sections", "03_mathematical_formulation.md");
const diagramExamples = resolve(paperDir, "sections", "03_diagram_examples");
const archive = resolve(diagramExamples, "archival");
const coverageFigure = resolve(diagramExamples, "coverage-multiplier-curves.typ");
const outputPdf = resolve(paperDir, "build", "rrf-coverage-normalization.pdf");

const archivedModules = [
	"ranking-figures.typ",
	"ranking-figures-1b.typ",
	"order-ledger.typ",
	"pairwise-casebook.typ",
	"rank-ballot.typ",
	"kernel-curve-atlas.typ",
	"kernel-curve-atlas-6b.typ",
	"decision-kernel-composite.typ",
	"log-rrf-k-variants.typ",
	"default-parameter-intuition.typ",
	"interim-order-ledger.typ",
	"interim-pairwise-casebook.typ",
	"interim-rank-ballot.typ",
	"parameter-sensitivity.svg",
];

const withoutTypstBlockComments = (source: string) => source.replaceAll(/\/\*[\s\S]*?\*\//g, "");

it("uses the requested ColorBrewer palettes and restores Figure 2's five panels", () => {
	const primaryFigure = readFileSync(resolve(diagramExamples, "rank-profile-comparison.typ"), "utf8");
	const comparisonGrid = readFileSync(resolve(diagramExamples, "rank-profile-comparison-grid.typ"), "utf8");
	const coverageCurves = readFileSync(coverageFigure, "utf8");
	const sectionSource = readFileSync(section, "utf8");

	// Figure 1: one shared height, touching within a pair, and a larger gap between cases.
	expect(primaryFigure).toContain('#let log-fill = rgb("#E41A1C")');
	expect(primaryFigure).toContain('#let saturated-fill = rgb("#377EB8")');
	expect(primaryFigure).toContain("#let pair-bar-width = 30%");
	expect(primaryFigure).toContain("#let pair-offset = 0.15");
	expect(primaryFigure).toContain("profile-centres.map(y => y - pair-offset)");
	expect(primaryFigure).toContain("profile-centres.map(y => y + pair-offset)");
	expect(primaryFigure.match(/width: pair-bar-width/g)).toHaveLength(2);
	expect(primaryFigure).not.toMatch(/outlined|grayscale/i);
	const barHeight = Number(primaryFigure.match(/pair-bar-width = (\d+)%/)?.[1]) / 100;
	const pairOffset = Number(primaryFigure.match(/pair-offset = ([\d.]+)/)?.[1]);
	const profileCentres = primaryFigure
		.match(/profile-centres = \(([^)]+)\)/)?.[1]
		.split(",")
		.map(Number) ?? [];
	expect(barHeight).toBeCloseTo(pairOffset * 2);
	expect(profileCentres).toHaveLength(7);
	for (let index = 1; index < profileCentres.length; index++) {
		const caseSpacing = profileCentres[index] - profileCentres[index - 1];
		expect(caseSpacing - (pairOffset * 2 + barHeight)).toBeCloseTo(0.4);
	}

	// Figure 2: the original method families remain distinct panels; saturation is panel (e).
	for (const [name, color] of [
		["log-fill", "#E41A1C"],
		["rbc-fill", "#377EB8"],
		["isr-fill", "#4DAF4A"],
		["logisr-fill", "#984EA3"],
		["saturated-fill", "#FF7F00"],
	] as const)
		expect(comparisonGrid).toContain(`#let ${name} = rgb("${color}")`);
	expect(comparisonGrid.match(/panel\(\[\([a-e]\)/g)).toHaveLength(5);
	for (const panelTitle of ["(a) logRRF", "(b) Rank-Biased Centroid", "(c) ISR", "(d) logISR", "(e) Saturated RRF"])
		expect(comparisonGrid).toContain(panelTitle);
	expect(comparisonGrid).toContain("#let saturated-rrf = compact-chart");
	expect(comparisonGrid).toContain("#let log-isr = compact-chart");
	expect(comparisonGrid).toContain("ranks $(1,1)$");
	expect(comparisonGrid).not.toMatch(/Five adjacent bars|touching block|comparison-chart/);

	// Coverage plot 1: ColorBrewer Reds, Blues, and Greens sequential families.
	for (const color of ["#FC9272", "#DE2D26", "#DEEBF7", "#9ECAE1", "#3182BD", "#E5F5E0", "#A1D99B", "#31A354"])
		expect(coverageCurves).toContain(`rgb("${color}")`);
	expect(coverageCurves).toContain("#let inverse-multiplier(n) = 1 / n");
	expect(coverageCurves).toContain('label: [$C_"inv"(n)$]');
	expect(coverageCurves).toContain('label: [$C_"log"(n; 1, 1/ln 2)$]');
	expect(coverageCurves).toContain('label: [$C_"log"(n; 2, 1/ln 3)$]');
	for (const parameters of ["1, 0, 1", "1, 0, 2", "2, 0, 1", "2, 0, 2", "2, 0.1, 2", "2, 0.3, 2"])
		expect(coverageCurves).toContain(`label: [$C_"sat"(n; ${parameters})$]`);

	expect(sectionSource).toMatch(/five panels/i);
	expect(sectionSource).toMatch(/Nine coverage multiplier curves/i);
	expect(sectionSource).not.toMatch(/five-bar blocks|five touching[^\n]*bars per rank profile|fifth bar/i);
});

it("compiles the paired and five-panel saturated-RRF comparison figures while preserving the archive", () => {
	const sectionSource = readFileSync(section, "utf8");
	const activeSource = withoutTypstBlockComments(sectionSource);
	const primaryFigure = readFileSync(resolve(diagramExamples, "rank-profile-comparison.typ"), "utf8");
	const comparisonGrid = readFileSync(resolve(diagramExamples, "rank-profile-comparison-grid.typ"), "utf8");

	compileRrfCoverageNormalizationPaper();

	expect(activeSource).toContain("rank-profile-comparison.typ");
	expect(activeSource).toContain("rank-profile-comparison-grid.typ");
	expect(activeSource).toContain("rank-profile-comparison-figure()");
	expect(activeSource).toContain("rank-profile-comparison-grid-figure()");
	expect(activeSource.match(/#figure\(/g)).toHaveLength(3);
	expect(activeSource).not.toContain("interim-order-ledger-figure()");
	expect(primaryFigure).toContain("#let rank-profile-comparison-figure");
	expect(comparisonGrid).toContain("#let rank-profile-comparison-grid-figure");
	expect(activeSource).not.toContain("logrrf-saturated-comparison-figure()");
	for (const method of ["log-rrf", "saturated-rrf", "rbc", "isr", "log-isr"])
		expect(comparisonGrid).toContain(`#let ${method}`);
	expect(comparisonGrid).toContain("ranks $(1,1)$");
	expect(comparisonGrid).toContain("zero-singletons: true");
	expect(primaryFigure).toContain("#let logrrf-ratios");
	expect(primaryFigure).toContain("#let saturated-ratios");
	expect(primaryFigure).toContain("3.392621");
	expect(primaryFigure).toContain("3.838390");
	expect(primaryFigure).toContain("#377EB8");
	expect(primaryFigure).toContain("whitespace separates profiles");
	for (const name of archivedModules) expect(existsSync(resolve(archive, name))).toBe(true);
	expect(readFileSync(resolve(archive, "ranking-figures.typ"), "utf8")).toContain("lq.contour");
	expect(readFileSync(resolve(archive, "README.md"), "utf8")).toContain("Figures 17–19");
	expect(existsSync(outputPdf)).toBe(true);
	expect(statSync(outputPdf).size).toBeGreaterThan(0);
});
