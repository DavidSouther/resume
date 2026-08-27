import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type Point = { x: number; y: number };
type Series = { label: string; color: string; dash?: string; points: Point[] };

const COLORS = ["#006d77", "#d1495b", "#edae49", "#3d5a80"];

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

export function coverageSeries(
	coverage: number,
	k: number,
	rank: number,
	shift: number,
	strength: number,
): { rrf: number; average: number; shifted: number; base: number } {
	const rrf = coverage * rrfTerm(rank, k);
	return {
		rrf,
		average: rrf / coverage,
		shifted: rrf * Math.log(coverage + shift),
		base: strength * rrf * Math.log(coverage),
	};
}

function normalized(series: Series[], perSeries = false): Series[] {
	const globalMaximum = Math.max(...series.flatMap((item) => item.points.map(({ y }) => y)));
	return series.map((item) => {
		const maximum = perSeries ? Math.max(...item.points.map(({ y }) => y)) : globalMaximum;
		return { ...item, points: item.points.map(({ x, y }) => ({ x, y: y / maximum })) };
	});
}

function chart(
	x: number,
	y: number,
	width: number,
	height: number,
	title: string,
	xLabel: string,
	series: Series[],
): string {
	const left = x + 34;
	const top = y + 36;
	const plotWidth = width - 46;
	const plotHeight = height - 82;
	const xs = series.flatMap((item) => item.points.map((point) => point.x));
	const xMin = Math.min(...xs);
	const xMax = Math.max(...xs);
	const px = (value: number) => left + ((value - xMin) / (xMax - xMin)) * plotWidth;
	const py = (value: number) => top + (1 - value) * plotHeight;
	const paths = series
		.map((item) => {
			const points = item.points.map((point) => `${px(point.x).toFixed(1)},${py(point.y).toFixed(1)}`).join(" ");
			return `<polyline points="${points}" fill="none" stroke="${item.color}" stroke-width="3"${item.dash ? ` stroke-dasharray="${item.dash}"` : ""}/>`;
		})
		.join("\n");
	const legend = series
		.map((item, index) => {
			const legendX = left + (index % 2) * (plotWidth / 2);
			const legendY = y + height + 6 + Math.floor(index / 2) * 18;
			return `<line x1="${legendX}" y1="${legendY - 5}" x2="${legendX + 24}" y2="${legendY - 5}" stroke="${item.color}" stroke-width="3"${item.dash ? ` stroke-dasharray="${item.dash}"` : ""}/><text x="${legendX + 30}" y="${legendY}">${item.label}</text>`;
		})
		.join("\n");
	return `<g class="chart"><text class="chart-title" x="${x + width / 2}" y="${y + 18}" text-anchor="middle">${title}</text>
		<line class="grid" x1="${left}" y1="${top}" x2="${left + plotWidth}" y2="${top}"/><line class="grid" x1="${left}" y1="${top + plotHeight / 2}" x2="${left + plotWidth}" y2="${top + plotHeight / 2}"/>
		<line class="axis" x1="${left}" y1="${top}" x2="${left}" y2="${top + plotHeight}"/><line class="axis" x1="${left}" y1="${top + plotHeight}" x2="${left + plotWidth}" y2="${top + plotHeight}"/>
		<text class="tick" x="${left - 7}" y="${top + 4}" text-anchor="end">1</text><text class="tick" x="${left - 7}" y="${top + plotHeight / 2 + 4}" text-anchor="end">.5</text><text class="tick" x="${left - 7}" y="${top + plotHeight + 4}" text-anchor="end">0</text>
		<text class="tick" x="${left}" y="${top + plotHeight + 17}" text-anchor="middle">${xMin}</text><text class="tick" x="${left + plotWidth}" y="${top + plotHeight + 17}" text-anchor="middle">${xMax}</text><text class="axis-label" x="${left + plotWidth / 2}" y="${top + plotHeight + 36}" text-anchor="middle">${xLabel}</text>
		${paths}${legend}</g>`;
}

function rankCharts(): string {
	const ranks = Array.from({ length: 12 }, (_, index) => index + 1);
	const makeSeries = (values: number[], label: (value: number) => string, score: (rank: number, value: number) => number) => normalized(values.map((value, index) => ({
		label: label(value), color: COLORS[index], dash: index === 1 ? "8 5" : index === 2 ? "3 4" : undefined,
		points: ranks.map((rank) => ({ x: rank, y: score(rank, value) })),
	})));
	return [
		chart(28, 102, 270, 270, "S_RRF: rank damping", "rank r", makeSeries([5, 20, 60], (k) => `k=${k}`, (r, k) => rrfTerm(r, k))),
		chart(305, 102, 270, 270, "S_w: fixed weight", "rank r (k=20)", makeSeries([0.5, 1, 2], (w) => `w_i=${w}`, (r, w) => weightedRrfTerm(r, 20, w))),
		chart(582, 102, 270, 270, "S_RBC: persistence", "rank r", makeSeries([0.2, 0.5, 0.8], (phi) => `φ=${phi}`, rbcTerm)),
	].join("\n");
}

function coverageCharts(): string {
	const coverages = Array.from({ length: 10 }, (_, index) => index + 1);
	const rules: Series[] = [
		{ label: "S_RRF", color: COLORS[0], points: coverages.map((n) => ({ x: n, y: coverageSeries(n, 20, 5, 1, 1).rrf })) },
		{ label: "S_avg", color: COLORS[1], dash: "8 5", points: coverages.map((n) => ({ x: n, y: coverageSeries(n, 20, 5, 1, 1).average })) },
		{ label: "S_shift", color: COLORS[2], dash: "3 4", points: coverages.map((n) => ({ x: n, y: coverageSeries(n, 20, 5, 1, 1).shifted })) },
		{ label: "S_base", color: COLORS[3], dash: "10 4 2 4", points: coverages.map((n) => ({ x: n, y: coverageSeries(n, 20, 5, 1, 1).base })) },
	];
	const varied = (values: number[], parameter: "b_s" | "B") => normalized(values.map((value, index) => ({
		label: `${parameter}=${value}`, color: COLORS[index], dash: index === 1 ? "8 5" : index === 2 ? "3 4" : undefined,
		points: coverages.map((n) => ({ x: n, y: parameter === "b_s" ? coverageSeries(n, 20, 5, value, 1).shifted : coverageSeries(n, 20, 5, 1, value).base })),
	})));
	return [
		chart(28, 445, 270, 270, "Equal-rank growth", "coverage n", normalized(rules, true)),
		chart(305, 445, 270, 270, "S_shift: additive shift", "coverage n", varied([0, 1, 4], "b_s")),
		chart(582, 445, 270, 270, "S_base: global scale", "coverage n", varied([0.5, 1, 2], "B")),
	].join("\n");
}

function sensitivityMatrix(): string {
	const columns = ["r", "n", "k", "w_i", "φ", "b_s", "b_ℓ / B"];
	const rows = [
		["S_RRF", "●", "◐", "●", "—", "—", "—", "—"],
		["S_avg", "●", "◐", "●", "—", "—", "—", "—"],
		["S_w", "●", "◐", "●", "●", "—", "—", "—"],
		["S_RBC", "●", "◐", "—", "—", "●", "—", "—"],
		["S_shift", "●", "●", "●", "—", "—", "●", "—"],
		["S_base", "●", "●", "●", "—", "—", "—", "○"],
	];
	const startX = 205, startY = 802, columnWidth = 88, rowHeight = 42;
	const headers = columns.map((label, index) => `<text class="matrix-head" x="${startX + index * columnWidth}" y="${startY}" text-anchor="middle">${label}</text>`).join("\n");
	const cells = rows.map((row, rowIndex) => {
		const y = startY + (rowIndex + 1) * rowHeight;
		return `<text class="matrix-row" x="${startX - 67}" y="${y + 5}" text-anchor="end">${row[0]}</text>\n${row.slice(1).map((value, columnIndex) => `<text class="matrix-cell" data-score="${row[0]}" data-parameter="${columns[columnIndex]}" x="${startX + columnIndex * columnWidth}" y="${y + 5}" text-anchor="middle">${value}</text>`).join("\n")}`;
	}).join("\n");
	return `<g id="sensitivity-matrix"><text class="panel-title" x="28" y="758">C  Parameter-to-score sensitivity map</text>
		<text class="note" x="28" y="782">Marks describe ranking behavior, not merely whether a symbol appears in a formula.</text>${headers}${cells}
		<text class="legend-text" x="42" y="1090">● can change relative scores/order or response shape</text><text class="legend-text" x="430" y="1090">◐ depends on added support/composition</text>
		<text class="legend-text" x="42" y="1116">○ global scale only; order unchanged</text><text class="legend-text" x="430" y="1116">— parameter has no role</text></g>`;
}

export function renderParameterSensitivityFigure(): string {
	return `<svg xmlns="http://www.w3.org/2000/svg" width="880" height="1140" viewBox="0 0 880 1140" role="img" aria-labelledby="title description">
	<title id="title">Parameter sensitivity of six rank-fusion scores</title><desc id="description">Rank-response curves, equal-rank coverage curves, and a matrix mapping r, n, k, w_i, phi, b_s, and b_l or B to S_RRF, S_avg, S_w, S_RBC, S_shift, and S_base.</desc>
	<style>text{font-family:"Libertinus Serif",Georgia,serif;fill:#17212b;font-size:17px}.figure-title{font-size:25px;font-weight:700}.panel-title{font-size:21px;font-weight:700}.chart-title,.matrix-head,.matrix-row{font-size:17px;font-weight:700}.tick,.axis-label,.note,.legend-text{font-size:15px}.matrix-cell{font-size:23px;font-weight:700}.axis{stroke:#17212b;stroke-width:1.5}.grid{stroke:#c8d0d8;stroke-width:1}</style>
	<rect width="880" height="1140" fill="#fff"/><text id="figure-heading" class="figure-title" x="440" y="36" text-anchor="middle">How parameters reshape rank-fusion scores</text>
	<text class="note" x="440" y="62" text-anchor="middle">Illustrative curves; vertical scales normalized within each small plot</text><text class="panel-title" x="28" y="91">A  Rank response (n=1; unvaried parameters held at reference values)</text>
	${rankCharts()}<text class="panel-title" x="28" y="425">B  Coverage response (equal rank r=5, k=20)</text>${coverageCharts()}${sensitivityMatrix()}</svg>\n`;
}

export function generateParameterSensitivityFigure(): string {
	const output = resolve(import.meta.dirname, "..", "figures", "parameter-sensitivity.svg");
	mkdirSync(dirname(output), { recursive: true });
	writeFileSync(output, renderParameterSensitivityFigure());
	return output;
}

if (import.meta.main) generateParameterSensitivityFigure();
