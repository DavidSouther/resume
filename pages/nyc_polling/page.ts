import {
	a,
	div,
	h1,
	link,
	meta,
	noscript,
	p,
	style,
} from "@davidsouther/jiffies/dom/html.ts";
import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
import { pageHead } from "../../src/lib/page-head.ts";

const MAPLIBRE_VERSION = "6.13.0";
const MAPLIBRE_BASE = `https://cdn.jsdelivr.net/npm/maplibre-gl@${MAPLIBRE_VERSION}/dist`;

const CSS = `
.nyc-polling { position: fixed; inset: 0; }
#nyc-map { position: absolute; inset: 0; }
.nyc-title, #nyc-controls { position: absolute; z-index: 1; left: 0.75rem; max-width: min(18rem, calc(100vw - 1.5rem)); padding: 0.5rem 0.75rem; background: #fffe; color: #222; border-radius: 0.5rem; box-shadow: 0 1px 4px #0004; font-size: 0.8rem; line-height: 1.3; }
.nyc-title { top: 0.75rem; }
.nyc-title h1 { margin: 0; font-size: 0.9rem; line-height: 1.2; }
.nyc-title p, .nyc-polling li, .nyc-polling label, .nyc-polling .poll-key, .nyc-polling .lowpop-key, .nyc-polling .status { margin: 0; font-size: 0.75rem; line-height: 1.3; }
.lowpop-key { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.3rem; }
.swatch.faded { background: #444; opacity: 0.3; }
table.bivariate { border-collapse: separate; border-spacing: 2px; margin: 0 0 0.3rem; width: auto; border: 0; box-shadow: none; background: none; }
table.bivariate caption { font-size: 0.7rem; line-height: 1.2; text-align: left; caption-side: top; padding: 0 0 0.2rem; }
table.bivariate tr, table.bivariate th, table.bivariate tbody th[scope="row"], table.bivariate thead th, table.bivariate tfoot td { background: none !important; background-color: transparent !important; }
table.bivariate th, table.bivariate td { border: 0 !important; box-shadow: none; padding: 0; font-size: 0.65rem; line-height: 1.1; font-weight: 600; white-space: nowrap; }
table.bivariate th[scope="row"] { text-align: right; padding-right: 0.3rem; font-weight: 400; }
table.bivariate th[scope="col"] { text-align: center; }
table.bivariate tbody td { width: 2rem; height: 1.4rem; }
.nyc-title p { margin-top: 0.2rem; }
.nyc-title a { color: inherit; }
#nyc-controls { bottom: 1.75rem; }
.mode { display: flex; gap: 0.75rem; margin-bottom: 0.4rem; font-weight: 600; }
.mode label { display: flex; align-items: center; gap: 0.25rem; }
.legend { list-style: none; padding: 0; margin: 0; }
.legend li { display: flex; align-items: center; gap: 0.4rem; }
.swatch { width: 0.9rem; height: 0.9rem; border: 1px solid #0004; display: inline-block; }
.poll-key { display: flex; align-items: center; gap: 0.4rem; margin-top: 0.3rem; }
.dot { width: 0.7rem; height: 0.7rem; border-radius: 50%; background: #0288d1; border: 1.5px solid #fff; box-shadow: 0 0 0 1px #0004; }
.maplibregl-ctrl-attrib { max-width: min(26rem, calc(100vw - 1.5rem)); max-height: 60vh; overflow: auto; font-size: 0.7rem; }
.maplibregl-popup-content { max-height: 16rem; overflow: auto; color: #222; font-size: 0.8rem; }
`;

export default {
	head: () => [
		...pageHead("NYC Poverty and Early Voting Sites — David Souther"),
		// The client module reads the pinned URL from here rather than importing it.
		meta({ name: "maplibre-src", content: `${MAPLIBRE_BASE}/maplibre-gl.mjs` }),
		link({ rel: "stylesheet", href: `${MAPLIBRE_BASE}/maplibre-gl.css` }),
		style({}, CSS),
	],
	default: () =>
		div(
			{ class: "nyc-polling" },
			div({
				id: "nyc-map",
				ariaLabel: "Map of NYC early voting sites and election districts",
			}),
			div(
				{ class: "nyc-title" },
				h1({}, "NYC poverty and early voting sites"),
				p(
					{},
					"Census tracts by election district pieces. ",
					a({ href: "/" }, "davidsouther.com"),
				),
			),
			div({ id: "nyc-controls" }),
			noscript({}, p({}, "This map needs JavaScript.")),
		),
	clientModules: ["/src/components/nyc_polling/client.ts"],
} satisfies PageModule;
