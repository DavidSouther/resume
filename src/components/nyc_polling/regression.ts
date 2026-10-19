// Draws the poverty rate by distance scatter and its regression curves with
// Plotly, from /nyc_polling/nyc_scatter.json. The fits are computed in Python;
// this module only plots them.
//
// The Plotly URL arrives as a <meta> tag, like mermaid's, so the bundler never
// tries to resolve a CDN specifier. Plotly's dist build is a plain script that
// sets `window.Plotly`.

import {
	table,
	tbody,
	td,
	th,
	thead,
	tr,
} from "@davidsouther/jiffies/dom/html.ts";

const DATA_URL = "/nyc_polling/nyc_scatter.json";
const CURVE_COLORS: Record<number, string> = {
	1: "#2b8cbe",
	2: "#d95f0e",
	3: "#31a354",
};

export interface Fit {
	degree: number;
	label: string;
	r2: number;
	adjR2: number;
	bic: number;
	vertex: number | null;
	x: number[];
	y: number[];
}

export interface NestedTest {
	degrees: string;
	f: number;
	df1: number;
	df2: number;
	p: number;
}

export interface ScatterData {
	n: number;
	points: {
		geoid: string[];
		electDist: number[];
		poverty: number[];
		miles: number[];
	};
	fits: Fit[];
	tests: NestedTest[];
	bestByBic: number;
}

interface PlotlyApi {
	newPlot(
		el: HTMLElement,
		data: unknown[],
		layout: Record<string, unknown>,
		config: Record<string, unknown>,
	): Promise<unknown>;
}

function loadPlotly(src: string): Promise<PlotlyApi> {
	const existing = (window as unknown as { Plotly?: PlotlyApi }).Plotly;
	if (existing) return Promise.resolve(existing);
	return new Promise((resolve, reject) => {
		const el = document.createElement("script");
		el.src = src;
		el.onload = () =>
			resolve((window as unknown as { Plotly: PlotlyApi }).Plotly);
		el.onerror = () => reject(new Error(`could not load ${src}`));
		document.head.append(el);
	});
}

/** Plotly traces: the points, then one line per fitted degree, the best by BIC drawn thick. */
export function traces(data: ScatterData): unknown[] {
	const { points } = data;
	return [
		{
			type: "scattergl",
			mode: "markers",
			name: "Tract districts",
			x: points.poverty,
			y: points.miles,
			customdata: points.geoid.map((g, i) => [g, points.electDist[i]]),
			hovertemplate:
				"Tract %{customdata[0]}, ED %{customdata[1]}<br>%{x}% poverty, %{y} miles<extra></extra>",
			marker: { size: 4, opacity: 0.25, color: "#636363" },
		},
		...data.fits.map((f) => ({
			type: "scatter",
			mode: "lines",
			name: `${f.label} (R² ${f.r2.toFixed(3)})`,
			x: f.x,
			y: f.y,
			hoverinfo: "name",
			line: {
				color: CURVE_COLORS[f.degree],
				width: f.degree === data.bestByBic ? 4 : 2,
			},
		})),
	];
}

function formatP(p: number): string {
	return p < 1e-4 ? "<0.0001" : p.toFixed(4);
}

/** The fit comparison: one row per degree, with the F test for the term it adds. */
export function fitsTable(data: ScatterData): HTMLTableElement {
	return table(
		{},
		thead(
			{},
			tr(
				{},
				...[
					"Degree",
					"R²",
					"Adjusted R²",
					"BIC",
					"F test for the added term",
				].map((h) => th({}, h)),
			),
		),
		tbody(
			{},
			...data.fits.map((f, i) => {
				const t = i > 0 ? data.tests[i - 1] : undefined;
				return tr(
					{},
					td(
						{},
						`${f.label}${f.degree === data.bestByBic ? " (best by BIC)" : ""}`,
					),
					td({}, f.r2.toFixed(4)),
					td({}, f.adjR2.toFixed(4)),
					td({}, f.bic.toFixed(1)),
					td(
						{},
						t
							? `F = ${t.f.toFixed(2)}, df ${t.df1}, ${t.df2}, p ${formatP(t.p)}`
							: "",
					),
				);
			}),
		),
	);
}

export async function boot(): Promise<void> {
	const plot = document.getElementById("nyc-scatter");
	const fits = document.getElementById("nyc-fits");
	const src = document
		.querySelector('meta[name="plotly-src"]')
		?.getAttribute("content");
	if (!plot || !fits || !src) return;
	const [plotly, response] = await Promise.all([
		loadPlotly(src),
		fetch(DATA_URL),
	]);
	if (!response.ok) throw new Error(`${DATA_URL}: ${response.status}`);
	const data = (await response.json()) as ScatterData;
	await plotly.newPlot(
		plot,
		traces(data),
		{
			margin: { t: 16, r: 16 },
			xaxis: { title: { text: "Tract poverty rate (%)" }, range: [0, 100] },
			yaxis: { title: { text: "Miles to assigned site" }, rangemode: "tozero" },
			legend: { orientation: "h", y: -0.2 },
			paper_bgcolor: "rgba(0,0,0,0)",
			plot_bgcolor: "rgba(0,0,0,0)",
		},
		{ responsive: true, displaylogo: false },
	);
	fits.replaceChildren(fitsTable(data));
}

void boot().catch((error) => {
	console.error("regression chart failed to render", error);
});
