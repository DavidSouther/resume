import {
	a,
	code,
	div,
	h1,
	h2,
	h3,
	li,
	p,
	pre,
	span,
	table,
	tbody,
	td,
	th,
	thead,
	tr,
	ul,
} from "@davidsouther/jiffies/dom/html.ts";
import {
	type AdminWindow,
	type CompletionRow,
	loadCompletionTable,
	loadSourcesConfig,
	loadTestimonyConfig,
} from "../lib/nyc-dot.ts";

const CONFIDENCE_LABELS: Record<string, string> = {
	"permit-verified": "Permit-verified",
	"api-verified": "API-verified",
	"testimony-only": "Testimony-only",
	"tracker-only": "Tracker-only",
	unavailable: "Unavailable",
};

function confidenceBadge(value: string): HTMLSpanElement {
	return span(
		{ class: `nd-badge ${value}` },
		CONFIDENCE_LABELS[value] ?? value,
	);
}

function windowCard(key: string, window: AdminWindow): HTMLDivElement {
	return div(
		{ class: "nd-window-card" },
		h3({}, window.label),
		div(
			{ class: "nd-range" },
			key === "mamdani" && !window.end
				? `${window.start} – present`
				: `${window.start} – ${window.end}`,
		),
	);
}

function comparisonTable(rows: CompletionRow[] | null): HTMLElement {
	if (
		!rows ||
		rows.length === 0 ||
		rows.every((r) => r.confidence === "unavailable")
	) {
		return div(
			{ class: "nd-banner" },
			"This pipeline has not been run against live data yet. Every metric below is currently unavailable — see ",
			code({}, "tools/nyc-dot-completion/README.md"),
			" for why, and how to run it for real.",
		);
	}

	return table(
		{ class: "nd-table" },
		thead(
			{},
			tr(
				{},
				th({}, "Metric"),
				th({}, "Unit"),
				th({}, "Adams total"),
				th({}, "Mamdani to date"),
				th({}, "Mamdani annualized"),
				th({}, "Confidence"),
				th({}, "Notes"),
			),
		),
		tbody(
			{},
			...rows.map((row) =>
				tr(
					{},
					td({}, row.metric),
					td({}, row.unit),
					td({ class: "nd-num" }, row.adamsTotal || "—"),
					td({ class: "nd-num" }, row.mamdaniToDateTotal || "—"),
					td({ class: "nd-num" }, row.mamdaniAnnualizedTotal || "—"),
					td({}, confidenceBadge(row.confidence)),
					td({}, row.notes || "—"),
				),
			),
		),
	);
}

function confidenceLegend(): HTMLUListElement {
	return ul(
		{ class: "nd-legend" },
		li(
			{},
			confidenceBadge("permit-verified"),
			" sourced from the Street Construction Permits pull",
		),
		li(
			{},
			confidenceBadge("api-verified"),
			" sourced directly from another NYC Open Data API",
		),
		li(
			{},
			confidenceBadge("testimony-only"),
			" no API figure; DOT testimony only",
		),
		li(
			{},
			confidenceBadge("tracker-only"),
			" no API or testimony figure; TransAlt tracker only",
		),
		li(
			{},
			confidenceBadge("unavailable"),
			" none of the above — empty is the honest answer",
		),
	);
}

export function NycDotCompletion(): HTMLElement {
	const rows = loadCompletionTable();
	const sources = loadSourcesConfig();
	const testimony = loadTestimonyConfig();

	return div(
		{ id: "nd-page" },
		h1({}, "NYC DOT Project Completion: Adams vs. Mamdani"),
		p(
			{ class: "nd-sub" },
			"Protected bike lanes, daylighted intersections, and pedestrian plazas / Open Streets, compared across administrations from NYC Open Data — not scraped, not estimated.",
		),

		h2({}, "Administration windows"),
		div(
			{ class: "nd-windows" },
			...Object.entries(sources.administrations).map(([key, w]) =>
				windowCard(key, w),
			),
		),

		h2({}, "Comparison"),
		comparisonTable(rows),
		confidenceLegend(),

		h2({}, "Methodology"),
		ul(
			{},
			li(
				{},
				"Primary source: NYC DOT Street Construction Permits (Socrata ",
				code({}, "tqtj-sjs8"),
				"). A permit is an ",
				span({ class: "nd-unverified" }, "issued"),
				", work-authorized record — not a verified completion. Every permit-derived figure in this table says so.",
			),
			li(
				{},
				"permit_type / work_type values are classified into bike-lane-install / daylighting / other / ambiguous via a human-reviewed mapping (",
				code({}, "tools/nyc-dot-completion/config/classification.yaml"),
				"), generated from the dataset's own distinct values — never guessed from field names.",
			),
			li(
				{},
				"Bike lane mileage is reported only if the permits dataset carries a real linear-measurement field, confirmed by schema inspection. Otherwise the table reports a permit count, not a fabricated mileage.",
			),
			li(
				{},
				"Street and Highway Capital Reconstruction Projects (",
				code({}, "97nd-ff3i"),
				") cross-check anything the permit feed alone can't confirm as completed.",
			),
			li(
				{},
				"Pedestrian Plazas (",
				code({}, "k5k6-6jex"),
				") are bucketed by administration window only if the dataset carries an install/opening date; otherwise this page reports a single total count as of extraction, with no fabricated year split.",
			),
			li(
				{},
				"Mamdani's window (Jan 1, 2026 – present) is open-ended. \"Mamdani annualized\" extrapolates the to-date total over the elapsed fraction of a year, so it's comparable to Adams' full four-year total — it is never presented as an actual full-year figure.",
			),
			li(
				{},
				"DOT Council testimony and the Transportation Alternatives bike lane tracker are cross-checks only, never the primary number. Any variance beyond a configured threshold is surfaced as a warning, not silently resolved in either direction.",
			),
		),

		h2({}, "Sources"),
		ul(
			{ class: "nd-sources" },
			...sources.datasets.map((d) =>
				li(
					{},
					a(
						{ href: d.resourceUrl, target: "_blank", rel: "noreferrer" },
						d.datasetId,
					),
					" — ",
					div({ class: "nd-role" }, d.role),
				),
			),
			...testimony.map((doc) =>
				li(
					{},
					a({ href: doc.url, target: "_blank", rel: "noreferrer" }, doc.title),
					" (manual transcription, cross-check only)",
					doc.urlVerified
						? null
						: span(
								{ class: "nd-unverified" },
								" — URL not verified to resolve",
							),
				),
			),
			li(
				{},
				a(
					{ href: sources.transalt.url, target: "_blank", rel: "noreferrer" },
					"TransAlt Protected Bike Lane Tracker",
				),
				" — ",
				div({ class: "nd-role" }, sources.transalt.note),
			),
		),

		h2({}, "Reproduce this"),
		div(
			{ class: "nd-repro" },
			p(
				{},
				"The full pull → classify → aggregate → cross-check pipeline lives at ",
				a(
					{
						href: "https://github.com/davidsouther/resume/tree/main/tools/nyc-dot-completion",
						target: "_blank",
						rel: "noreferrer",
					},
					"tools/nyc-dot-completion",
				),
				" in this site's repo, with its raw cached pulls and classification config committed alongside the code.",
			),
			pre(
				{},
				"cd tools/nyc-dot-completion\npip install -r requirements.txt\ncd src\npython inspect_schema.py   # step 0 — review before continuing\npython run_pipeline.py     # steps 1-5",
			),
		),
	);
}
