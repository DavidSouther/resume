// Boots the NYC polling map: MapLibre over OpenFreeMap, with tract by election
// district pieces and early voting sites from /nyc_polling/.
//
// The MapLibre URL arrives as a <meta> tag, like mermaid's, so the bundler never
// tries to resolve a CDN specifier.

import { type CardProps, card } from "./cards.ts";

const STYLE_URL = "https://tiles.openfreemap.org/styles/positron";
const PIECES_URL = "/nyc_polling/nyc_assignment.geojson";
const POLLS_URL = "/nyc_polling/nyc_poll_sites.geojson";
const NYC_BOUNDS: [number, number, number, number] = [
	-74.26, 40.49, -73.69, 40.92,
];
// Data sources, listed once in the map's info box (the attribution control).
const SOURCES = [
	"Poverty and income: U.S. Census Bureau, ACS 2024 5-year, tables S1701 and S1901",
	"Tracts and election districts: NYC Dept. of City Planning (2020 census tracts clipped to shoreline)",
	"Early voting sites and assignments: NYC Board of Elections, General Election 2026",
	"Site locations geocoded with the Google Geocoding API",
	"Population is people for whom poverty status is determined. ± is a 90% margin of error",
	"An election district piece shows its whole tract's population, poverty rate, and income. Distance is from the center of the piece to its assigned site",
	"Faded areas are low population tracts (under 1,200 people): their estimates are unreliable and they are left out of the analysis. Zero population tracts are not split by election district",
	"Combined: each poverty class and distance band has its own color. Darker is higher poverty, and blue through violet and amber to red runs from the nearest to the farthest band",
];
const MODES = {
	poverty: "Poverty",
	distance: "Distance",
	combined: "Combined",
} as const;
type Mode = keyof typeof MODES;
// The feature property that holds each mode's fill color.
const FILL: Record<Mode, string> = {
	poverty: "povertyFill",
	distance: "distanceFill",
	combined: "combinedFill",
};
const OPACITY = { base: 0.7, combined: 1, lowPopulation: 0.3 } as const;
/** Fill opacity for a mode. Low population areas recede: they carry little weight in any impact. */
function fillOpacity(mode: Mode): unknown {
	const opacity = mode === "combined" ? OPACITY.combined : OPACITY.base;
	return [
		"case",
		["==", ["get", "lowPopulation"], true],
		opacity * OPACITY.lowPopulation,
		opacity,
	];
}
// Combined legend: one row per poverty class, one column per distance band (upper bounds, in miles).
const POVERTY_ROWS = [
	"< 10%",
	"10 to 20",
	"20 to 30",
	"30 to 40",
	"40%+",
] as const;
const DISTANCE_COLUMNS = ["< 1/4", "< 1/2", "< 1", "1+"] as const;

interface LegendEntry {
	color: string;
	label: string;
}
interface Collection {
	legends: Record<Mode, LegendEntry[]>;
}
interface MapEvent {
	lngLat: unknown;
	point: unknown;
	features?: Feature[];
}
interface Feature {
	properties: CardProps;
}
interface PopupLike {
	setLngLat(l: unknown): PopupLike;
	setDOMContent(n: Node): PopupLike;
	addTo(m: unknown): PopupLike;
}

// Minimal view of the MapLibre API used here.
interface MapLike {
	on(type: string, cb: (e?: MapEvent) => void): void;
	on(type: string, layer: string, cb: (e: MapEvent) => void): void;
	addSource(id: string, source: unknown): void;
	addLayer(layer: unknown, before?: string): void;
	getStyle(): { layers: { id: string; type: string }[] };
	setLayoutProperty(layer: string, prop: string, value: unknown): void;
	queryRenderedFeatures(point: unknown, o: { layers: string[] }): Feature[];
	setPaintProperty(layer: string, prop: string, value: unknown): void;
	addControl(c: unknown, pos?: string): void;
	getCanvas(): HTMLElement;
}
interface MapLibre {
	Map: new (o: Record<string, unknown>) => MapLike;
	NavigationControl: new () => unknown;
	Popup: new (o?: Record<string, unknown>) => PopupLike;
}

function el<K extends keyof HTMLElementTagNameMap>(
	tag: K,
	props: Partial<HTMLElementTagNameMap[K]> = {},
	...kids: (Node | string)[]
): HTMLElementTagNameMap[K] {
	const node = Object.assign(document.createElement(tag), props);
	node.append(...kids);
	return node;
}

async function fetchJson<T>(url: string): Promise<T> {
	const res = await fetch(url);
	if (!res.ok) throw new Error(`${url}: ${res.status}`);
	return res.json();
}

function legendList(entries: LegendEntry[]): HTMLElement {
	return el(
		"ul",
		{ className: "legend" },
		...entries.map((e) => {
			const swatch = el("span", { className: "swatch" });
			swatch.style.background = e.color;
			return el("li", {}, swatch, e.label);
		}),
	);
}

/** The Combined legend: poverty classes down, distance bands across, one swatch per cell. */
function legendGrid(entries: LegendEntry[]): HTMLElement {
	const columns = DISTANCE_COLUMNS.length;
	const rows = POVERTY_ROWS.map((label, r) =>
		el(
			"tr",
			{},
			el("th", { scope: "row" }, label),
			...entries.slice(r * columns, (r + 1) * columns).map((e) => {
				const swatch = el("td", { title: e.label });
				swatch.style.background = e.color;
				swatch.setAttribute("aria-label", e.label);
				return swatch;
			}),
		),
	);
	return el(
		"div",
		{ className: "combined-legend" },
		el(
			"table",
			{ className: "bivariate" },
			el("caption", {}, "Poverty rate by miles to site"),
			el(
				"thead",
				{},
				el(
					"tr",
					{},
					el("td", {}),
					...DISTANCE_COLUMNS.map((t) => el("th", { scope: "col" }, t)),
				),
			),
			el("tbody", {}, ...rows),
		),
		legendList(entries.slice(POVERTY_ROWS.length * columns)),
	);
}

async function boot() {
	const host = document.getElementById("nyc-map");
	const controls = document.getElementById("nyc-controls");
	const src = document
		.querySelector('meta[name="maplibre-src"]')
		?.getAttribute("content");
	if (!host || !controls || !src) return;

	const status = el("p", { className: "status", role: "status" }, "Loading…");
	controls.replaceChildren(status);
	const fail = (what: string, err: unknown) => {
		console.error(what, err);
		status.textContent = `${what}: ${err instanceof Error ? err.message : String(err)}`;
	};

	let ml: MapLibre;
	let map: MapLike;
	try {
		const maplibre = (await import(/* @vite-ignore */ src)) as unknown as
			| MapLibre
			| { default: MapLibre };
		ml = "Map" in maplibre ? maplibre : maplibre.default;
		map = new ml.Map({
			container: host,
			style: STYLE_URL,
			bounds: NYC_BOUNDS,
			fitBoundsOptions: { padding: 10 },
			attributionControl: { compact: true, customAttribution: SOURCES },
		});
		map.addControl(new ml.NavigationControl(), "bottom-right");
	} catch (err) {
		fail("Could not start the map", err);
		return;
	}
	// The info box (attribution control) opens expanded on wide screens; start it collapsed.
	map.on("load", () => {
		const box = host.querySelector(".maplibregl-ctrl-attrib");
		box?.classList.remove("maplibregl-compact-show");
		box?.removeAttribute("open");
	});
	map.on("error", (e) => console.error("map error", e));

	const legendHost = el("div", { className: "legends" });
	const legends = {} as Record<Mode, HTMLElement>;
	let mode: Mode = "poverty";
	const setMode = (m: Mode) => {
		mode = m;
		map.setPaintProperty("pieces-fill", "fill-color", [
			"coalesce",
			["get", FILL[m]],
			"#cccccc",
		]);
		map.setPaintProperty("pieces-fill", "fill-opacity", fillOpacity(m));
		for (const [k, node] of Object.entries(legends)) node.hidden = k !== m;
	};

	const toggle = el(
		"div",
		{ className: "mode", role: "radiogroup", ariaLabel: "Color by" },
		...(Object.keys(MODES) as Mode[]).map((m) => {
			const input = el("input", {
				type: "radio",
				name: "mode",
				value: m,
				checked: m === mode,
			});
			input.addEventListener("change", () => setMode(m));
			return el("label", {}, input, MODES[m]);
		}),
	);
	controls.replaceChildren(toggle, legendHost, status);
	status.textContent = "Loading…";

	map.on("load", async () => {
		try {
			const [pieces, polls] = await Promise.all([
				fetchJson<Collection>(PIECES_URL),
				fetchJson(POLLS_URL),
			]);
			map.addSource("pieces", { type: "geojson", data: pieces });
			// Under the basemap's labels, so street and place names stay readable.
			const labels = map.getStyle().layers.find((l) => l.type === "symbol")?.id;
			map.addLayer(
				{
					id: "pieces-fill",
					type: "fill",
					source: "pieces",
					paint: {
						"fill-color": ["coalesce", ["get", FILL[mode]], "#cccccc"],
						"fill-opacity": fillOpacity(mode),
					},
				},
				labels,
			);
			map.addLayer(
				{
					id: "pieces-line",
					type: "line",
					source: "pieces",
					paint: { "line-color": "#00000040", "line-width": 0.5 },
				},
				labels,
			);
			map.addSource("polls", { type: "geojson", data: polls });
			map.addLayer({
				id: "polls",
				type: "circle",
				source: "polls",
				paint: {
					"circle-radius": 5,
					"circle-color": "#0288d1",
					"circle-stroke-color": "#ffffff",
					"circle-stroke-width": 1.5,
				},
			});
			for (const m of Object.keys(MODES) as Mode[]) {
				legends[m] =
					m === "combined"
						? legendGrid(pieces.legends.combined)
						: legendList(pieces.legends[m]);
				legendHost.append(legends[m]);
			}
			legendHost.append(
				el(
					"p",
					{ className: "lowpop-key" },
					el("span", { className: "swatch faded" }),
					"Faded: low population (under 1,200)",
				),
			);
			legendHost.append(
				el(
					"p",
					{ className: "poll-key" },
					el("span", { className: "dot" }),
					"Early voting site",
				),
			);
			setMode(mode);
			status.remove();
		} catch (err) {
			fail("Could not load map data", err);
			return;
		}

		// One click handler: a poll site wins over the piece underneath it.
		const layers = ["polls", "pieces-fill"];
		map.on("click", (e) => {
			if (!e) return;
			const f =
				map.queryRenderedFeatures(e.point, { layers: ["polls"] })[0] ??
				map.queryRenderedFeatures(e.point, { layers: ["pieces-fill"] })[0];
			if (!f) return;
			new ml.Popup({ maxWidth: "340px" })
				.setLngLat(e.lngLat)
				.setDOMContent(card(f.properties))
				.addTo(map);
		});
		for (const id of layers) {
			map.on("mouseenter", id, () => {
				map.getCanvas().style.cursor = "pointer";
			});
			map.on("mouseleave", id, () => {
				map.getCanvas().style.cursor = "";
			});
		}
	});
}

window.addEventListener("DOMContentLoaded", () => {
	boot().catch((err) => console.error(err));
});
