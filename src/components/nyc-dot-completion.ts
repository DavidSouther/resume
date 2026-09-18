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
	"inventory-verified": "Inventory-verified",
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
			confidenceBadge("inventory-verified"),
			" sourced from DOT/DCP's own as-built bike route inventory",
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
				"Primary source for protected bike lanes: NYC's own Bike Routes inventory (Socrata ",
				code({}, "mzxg-pwib"),
				"), an ",
				span({ class: "nd-unverified" }, "as-built"),
				" record with a real install date per segment — not an issued permit. An earlier version of this pipeline assumed the Street Construction Permits dataset (",
				code({}, "tqtj-sjs8"),
				") carried bike-lane/daylighting categories; schema inspection found it does not (it's a general street-opening permit feed with no such field). That dataset is still pulled and cached as a documented audit trail, but is no longer used for classification.",
			),
			li(
				{},
				"ft_facilit / tf_facilit (the facility class in each direction of travel) are classified into bike-lane-install / other / ambiguous via a human-reviewed mapping (",
				code({}, "tools/nyc-dot-completion/config/classification.yaml"),
				'), generated from the dataset\'s own distinct values — never guessed from field names. A segment counts as a protected bike lane if either direction is classified "Protected".',
			),
			li(
				{},
				"Segment count and mileage are reported as two separate rows, deliberately: this dataset has no length field, but its geometry is real, so mileage is computed from each segment's own geometry (reprojected to EPSG:2263 for planar length), not guessed from a units-bearing field. On-street mileage only — a handful of off-street greenway/park-path segments run 3-15 miles as a single geometry and would otherwise swing an on-street pace figure by themselves; their totals are reported separately in that row's notes.",
			),
			li(
				{},
				"Daylighted intersections has no public NYC Open Data source as of this run (confirmed by catalog search across daylighting-adjacent terms) — DOT Council testimony is the only source, and the most recent (first Mamdani-era) testimony gives no figure at all. This metric is reported as unavailable rather than derived from unrelated permit free-text.",
			),
			li(
				{},
				"Pedestrian Plazas (",
				code({}, "k5k6-6jex"),
				") has no install/opening date field, so it contributes only a single total count as of extraction, never a fabricated year split. The Adams/Mamdani comparison for this row instead comes from DOT's Pedestrian Space Added (",
				code({}, "uebm-cmjr"),
				") project counts, bucketed by NYC fiscal year — a disclosed approximation, since fiscal years straddle administration transitions and don't line up with the Jan 1 admin-change date.",
			),
			li(
				{},
				"Street and Highway Capital Reconstruction Projects (",
				code({}, "97nd-ff3i"),
				") is pulled and cached as a future cross-check on anything the above feeds alone can't confirm as completed; not yet wired into the metrics above.",
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
