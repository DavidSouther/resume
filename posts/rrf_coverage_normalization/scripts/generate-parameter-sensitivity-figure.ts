import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type Point = { x: number; y: number };
type Series = { label: string; color: string; dash?: string; points: Point[] };

const COLORS = [
	"#006d77",
	"#d1495b",
	"#edae49",
	"#3d5a80",
	"#7a5195",
	"#2a9d8f",
	"#bc5090",
	"#ef8354",
	"#5c677d",
];

export function rrfTerm(rank: number, k: number): number {
	return 1 / (k + rank);
}

export function weightedRrfTerm(rank: number, k: number, weight: number): number {
	return weight * rrfTerm(rank, k);
}

export function rbcTerm(rank: number, phi: number): number {
	if (phi === 0) return rank === 1 ? 1 : 0;
	return (1 - phi) * phi ** (rank - 1);
}

export function isrTerm(rank: number): number {
	return 1 / rank ** 2;
}

export function equalSupportScores(
	coverage: number,
	options: {
		k: number;
		rank: number;
		weight: number;
		phi: number;
		sigma: number;
		b: number;
		B: number;
	},
): Record<string, number> {
	const { k, rank, weight, phi, sigma, b, B } = options;
	const rrf = coverage * rrfTerm(rank, k);
	const inverseSquareSum = coverage * isrTerm(rank);
	return {
		S_RRF: rrf,
		S_avg: rrf / coverage,
		S_w: coverage * weightedRrfTerm(rank, k, weight),
		S_RBC: coverage * rbcTerm(rank, phi),
		S_ISR: coverage * inverseSquareSum,
		S_logISR: Math.log(coverage) * inverseSquareSum,
		S_logNISR: Math.log(coverage + sigma) * inverseSquareSum,
		S_log: B * rrf * Math.log(coverage + b),
	};
}

export function normalizePanel(series: Series[]): Series[] {
	const panelMaximum = Math.max(...series.flatMap((item) => item.points.map(({ y }) => y)));
	return series.map((item) => ({
		...item,
		points: item.points.map(({ x, y }) => ({ x, y: y / panelMaximum })),
	}));
}

function chart(
	id: string,
	x: number,
	y: number,
	width: number,
	height: number,
	title: string,
	xLabel: string,
	series: Series[],
): string {
	const normalized = normalizePanel(series);
	const left = x + 38;
	const top = y + 36;
	const plotWidth = width - 50;
	const plotHeight = height - 92;
	const xs = normalized.flatMap((item) => item.points.map((point) => point.x));
	const xMin = Math.min(...xs);
	const xMax = Math.max(...xs);
	const px = (value: number) => left + ((value - xMin) / (xMax - xMin)) * plotWidth;
	const py = (value: number) => top + (1 - value) * plotHeight;
	const paths = normalized
		.map((item) => {
			const points = item.points.map((point) => `${px(point.x).toFixed(1)},${py(point.y).toFixed(1)}`).join(" ");
			return `<polyline data-series="${item.label}" points="${points}" fill="none" stroke="${item.color}" stroke-width="3"${item.dash ? ` stroke-dasharray="${item.dash}"` : ""}/>`;
		})
		.join("\n");
	const legendColumns = width < 350 || id === "coverage-shape" ? 2 : 3;
	const legend = normalized
		.map((item, index) => {
			const legendX = left + (index % legendColumns) * (plotWidth / legendColumns);
			const legendY = y + height + 2 + Math.floor(index / legendColumns) * 18;
			return `<line x1="${legendX}" y1="${legendY - 5}" x2="${legendX + 20}" y2="${legendY - 5}" stroke="${item.color}" stroke-width="3"${item.dash ? ` stroke-dasharray="${item.dash}"` : ""}/><text x="${legendX + 25}" y="${legendY}">${item.label}</text>`;
		})
		.join("\n");
	return `<g class="chart" data-panel="${id}" data-normalization="panel-common-max"><text class="chart-title" x="${x + width / 2}" y="${y + 18}" text-anchor="middle">${title}</text>
		<line class="grid" x1="${left}" y1="${top}" x2="${left + plotWidth}" y2="${top}"/><line class="grid" x1="${left}" y1="${top + plotHeight / 2}" x2="${left + plotWidth}" y2="${top + plotHeight / 2}"/>
		<line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}"/><line class="axis" x1="${left}" y1="${top + plotHeight}" x2="${left + plotWidth}" y2="${top + plotHeight}"/>
		<text class="tick" x="${left - 7}" y="${top + 4}" text-anchor="end">1</text><text class="tick" x="${left - 7}" y="${top + plotHeight / 2 + 4}" text-anchor="end">.5</text><text class="tick" x="${left - 7}" y="${top + plotHeight + 4}" text-anchor="end">0</text>
		<text class="tick" x="${left}" y="${top + plotHeight + 17}" text-anchor="middle">${xMin}</text><text class="tick" x="${left + plotWidth}" y="${top + plotHeight + 17}" text-anchor="middle">${xMax}</text><text class="axis-label" x="${left + plotWidth / 2}" y="${top + plotHeight + 36}" text-anchor="middle">${xLabel}</text>
		${paths}${legend}</g>`;
}

function series(label: string, color: string, values: number[], xs: number[], dash?: string): Series {
	return { label, color, dash, points: xs.map((x, index) => ({ x, y: values[index] })) };
}

function rankCharts(): string {
	const ranks = Array.from({ length: 12 }, (_, index) => index + 1);
	return [
		chart("rank-k", 28, 100, 285, 190, "RRF-family damping", "rank r", [5, 20, 60].map((k, index) => series(`k=${k}`, COLORS[index], ranks.map((r) => rrfTerm(r, k)), ranks, index === 1 ? "8 5" : index === 2 ? "3 4" : undefined))),
		chart("rank-weight", 338, 100, 285, 190, "Fixed retriever weight", "rank r (k=20)", [0.5, 1, 2].map((weight, index) => series(`w_i=${weight}`, COLORS[index], ranks.map((r) => weightedRrfTerm(r, 20, weight)), ranks, index === 1 ? "8 5" : index === 2 ? "3 4" : undefined))),
		chart("rank-kernels", 648, 100, 285, 190, "Geometric and inverse-square", "rank r", [
			series("RRF k=20", COLORS[0], ranks.map((r) => rrfTerm(r, 20)), ranks),
			series("RBC φ=.5", COLORS[3], ranks.map((r) => rbcTerm(r, 0.5)), ranks, "8 5"),
			series("ISR kernel", COLORS[4], ranks.map(isrTerm), ranks, "3 4"),
		]),
	].join("\n");
}

const SUPPORT = {
	k: 20,
	rank: 5,
	weight: 1,
	phi: 0.5,
	sigma: 0.01,
	b: 1,
	B: 1 / Math.log(2),
};

function coverageCharts(): string {
	const coverages = Array.from({ length: 10 }, (_, index) => index + 1);
	const scoreValues = (name: string, options = SUPPORT) => coverages.map((n) => equalSupportScores(n, options)[name]);
	return [
		chart("coverage-rrf-family", 28, 340, 440, 160, "RRF-kernel and RBC growth", "coverage n", [
			series("S_RRF", COLORS[0], scoreValues("S_RRF"), coverages),
			series("S_avg", COLORS[1], scoreValues("S_avg"), coverages, "8 5"),
			series("S_w", COLORS[2], scoreValues("S_w"), coverages, "3 4"),
			series("S_RBC", COLORS[3], scoreValues("S_RBC"), coverages, "10 4 2 4"),
			series("S_log", COLORS[7], scoreValues("S_log"), coverages, "7 3"),
		]),
		chart("coverage-isr-family", 493, 340, 440, 160, "ISR-family growth", "coverage n", [
			series("S_ISR", COLORS[4], scoreValues("S_ISR"), coverages),
			series("S_logISR", COLORS[5], scoreValues("S_logISR"), coverages, "8 5"),
			series("S_logNISR", COLORS[6], scoreValues("S_logNISR"), coverages, "3 4"),
		]),
		chart("coverage-shape", 28, 550, 440, 160, "Shape b (all B=1/ln(1+b))", "coverage n", [0.5, 1, 4].map((b, index) =>
			series(
				index === 1 ? "S_log b=1 (default)" : `S_log b=${b}`,
				COLORS[index],
				scoreValues("S_log", { ...SUPPORT, b, B: 1 / Math.log(1 + b) }),
				coverages,
				index === 1 ? "8 5" : index === 2 ? "3 4" : undefined,
			),
		)),
		chart("coverage-global-scale", 493, 550, 440, 160, "Global scale B (b=1; magnitude only)", "coverage n", [0.5, 1 / Math.log(2), 2].map((B, index) => series(index === 1 ? "B=1/ln2" : `B=${B}`, COLORS[index], scoreValues("S_log", { ...SUPPORT, B }), coverages, index === 1 ? "8 5" : index === 2 ? "3 4" : undefined))),
	].join("\n");
}

function sensitivityMatrix(): string {
	const columns = ["r", "n / support", "k", "w_i", "φ", "σ", "b", "B"];
	const rows = [
		["S_RRF", "●", "●", "●", "—", "—", "—", "—", "—"],
		["S_avg", "●", "◐", "●", "—", "—", "—", "—", "—"],
		["S_w", "●", "●", "●", "●", "—", "—", "—", "—"],
		["S_RBC", "●", "●", "—", "—", "●", "—", "—", "—"],
		["S_ISR", "●", "●", "—", "—", "—", "—", "—", "—"],
		["S_logISR", "●", "●", "—", "—", "—", "—", "—", "—"],
		["S_logNISR", "●", "●", "—", "—", "—", "●", "—", "—"],
		["S_log", "●", "●", "●", "—", "—", "—", "●", "○"],
	];
	const startX = 224;
	const startY = 815;
	const columnWidth = 88;
	const rowHeight = 22;
	const headers = columns.map((label, index) => `<text class="matrix-head" x="${startX + index * columnWidth}" y="${startY}" text-anchor="middle">${label}</text>`).join("\n");
	const cells = rows.map((row, rowIndex) => {
		const y = startY + (rowIndex + 1) * rowHeight;
		return `<text class="matrix-row" x="${startX - 77}" y="${y + 5}" text-anchor="end">${row[0]}</text>\n${row.slice(1).map((value, columnIndex) => `<text class="matrix-cell" data-score="${row[0]}" data-parameter="${columns[columnIndex]}" x="${startX + columnIndex * columnWidth}" y="${y + 5}" text-anchor="middle">${value}</text>`).join("\n")}`;
	}).join("\n");
	return `<g id="sensitivity-matrix" data-n-semantics="add-one-supporting-retriever"><text class="panel-title" x="28" y="770">C  Parameter-to-score sensitivity map</text>
		<text class="note" x="28" y="792">n means adding support: identical rank in plots; an arbitrary added rank makes only the average effect directional.</text>${headers}${cells}
		<text class="legend-text" x="42" y="1035">● can change relative scores, order, or response shape</text><text class="legend-text" x="500" y="1035">◐ direction depends on added support</text>
		<text class="legend-text" x="42" y="1057">○ global scale only; order unchanged</text><text class="legend-text" x="500" y="1057">— parameter has no role</text></g>`;
}

export function renderParameterSensitivityFigure(): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="1075" viewBox="0 0 960 1075" role="img" aria-labelledby="title description" data-normalization-policy="one-common-maximum-per-panel" data-coverage-perturbation="append-identical-rank-5-supporter">
	<title id="title">Parameter sensitivity of eight rank-fusion scores</title><desc id="description">Rank-response and equal-rank coverage curves plus a matrix mapping r, added support n, k, w_i, phi, sigma, b, and B to RRF, coverage division, weighted RRF, RBC, ISR, logISR, logN ISR, and the unified logarithmic RRF family.</desc>
	<style>text{font-family:"Libertinus Serif",Georgia,serif;fill:#17212b;font-size:16px}.figure-title{font-size:25px;font-weight:700}.panel-title{font-size:21px;font-weight:700}.chart-title,.matrix-head,.matrix-row{font-size:16px;font-weight:700}.tick,.axis-label,.note,.legend-text{font-size:14px}.matrix-cell{font-size:21px;font-weight:700}.axis{stroke:#17212b;stroke-width:1.5}.grid{stroke:#c8d0d8;stroke-width:1}</style>
	<rect width="960" height="1075" fill="#fff"/><text id="figure-heading" class="figure-title" x="480" y="36" text-anchor="middle">How parameters reshape rank-fusion scores</text>
	<text class="note" x="480" y="62" text-anchor="middle">One shared maximum per panel; vertical separations remain comparable within a panel</text><text class="panel-title" x="28" y="92">A  Rank response (one supporter; unvaried parameters at displayed reference values)</text>
	${rankCharts()}<text class="panel-title" x="28" y="322">B  Coverage response (append an identical rank-5 supporter; k=20, w_i=1, φ=.5)</text>${coverageCharts()}${sensitivityMatrix()}</svg>\n`;
}

export function generateParameterSensitivityFigure(): string {
	const output = resolve(import.meta.dirname, "..", "figures", "parameter-sensitivity.svg");
	mkdirSync(dirname(output), { recursive: true });
	writeFileSync(output, renderParameterSensitivityFigure());
	return output;
}

if (import.meta.main) generateParameterSensitivityFigure();
