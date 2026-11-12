import {
	a,
	aside,
	button,
	details,
	div,
	dl,
	fieldset,
	h1,
	input,
	label,
	meta,
	option,
	output,
	p,
	progress,
	script,
	select,
	small,
	span,
	style,
	summary,
} from "@davidsouther/jiffies/dom/html.ts";
import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
import { pageHead } from "../../src/lib/page-head.ts";

// jiffies types restrict attribute names, so ARIA attributes go on afterwards.
function attrs<T extends Element>(el: T, a: Record<string, string>): T {
	for (const [k, v] of Object.entries(a)) el.setAttribute(k, v);
	return el;
}

const THREE_CDN = "https://cdn.jsdelivr.net/npm/three@0.128.0";

// Full-bleed dark WebGL stage with an instrument rail. The stage is a window
// onto the night sky, so it stays dark in every site theme; the rail uses the
// site's jiffies-css theme. The `.app` rule lowers --base-size so the many
// small controls stay compact (jiffies-css density tokens derive from it).
const CSS = `
:root {
  --df-void: #04060b;
  --df-accent: #9cc4ff;
  --df-dim: #8090a8;
  --df-ink: #dde5f1;
  --df-star: #d8e7ff;
  --df-near: #6cd3c2;
  --df-mid: #efb15a;
  --df-far: #e16a5c;
}
[hidden] { display: none !important; }
html, body { height: 100%; margin: 0; padding: 0; max-width: none; overflow: hidden; background: var(--df-void); }
.app { --base-size: 5px; height: 100%; display: grid; grid-template-columns: minmax(0, 1fr) 21rem; font-size: 0.8125rem; }
.stage { position: relative; min-width: 0; overflow: hidden; background: var(--df-void); color: var(--df-ink); touch-action: none; }
.stage canvas { display: block; width: 100%; height: 100%; outline: none; }
.hud { position: absolute; display: flex; gap: 6px; flex-wrap: wrap; pointer-events: none; align-items: center; }
.hud > * { pointer-events: auto; }
.hud.top { top: max(14px, env(safe-area-inset-top, 0px)); left: 16px; right: 16px; }
.hud.bottom { bottom: 14px; left: 16px; }
.hud button { background: #0b1019cc; color: var(--df-ink); border: 1px solid #2c374a; }
.hud button:hover { border-color: var(--df-accent); }
.hud h1, .hud h1 small { color: var(--df-ink) !important; }
.hud h1 { margin: 0 12px 0 0; font-size: 1.35rem; line-height: 1; letter-spacing: 0.04em; text-transform: uppercase; color: var(--df-ink); text-shadow: 0 1px 8px #000; }
.hud h1 small { display: block; margin-top: 3px; font-size: 0.7rem; letter-spacing: 0.02em; text-transform: none; font-weight: 400; color: var(--df-dim) !important; }
.hud .hint { color: var(--df-dim); font-size: 0.75rem; text-shadow: 0 1px 6px #000; }
.hudright { margin-left: auto; display: flex; gap: 6px; align-items: center; }
.app button[aria-pressed="true"] { outline: 2px solid var(--df-accent); outline-offset: -2px; }
.tip { position: absolute; pointer-events: none; font: 11px/1.35 ui-monospace, Menlo, monospace; background: #0b1019ee; color: var(--df-ink); border: 1px solid #222c3d; padding: 4px 7px; border-radius: 2px; white-space: nowrap; transform: translate(12px, -50%); }
.ring { position: absolute; pointer-events: none; border: 1.5px solid var(--df-accent); border-radius: 50%; transform: translate(-50%, -50%); box-shadow: 0 0 0 1px #0008; }
.busy { position: absolute; inset: 0; display: grid; place-items: center; background: #04060bcc; color: var(--df-ink); text-align: center; }
.busy progress { display: block; width: 160px; margin: 12px auto 0; }
.drop { position: absolute; inset: 10px; border: 2px dashed var(--df-accent); display: grid; place-items: center; font-size: 1.25rem; letter-spacing: 0.08em; text-transform: uppercase; background: #04060bb0; color: var(--df-ink); }

.rail { min-width: 0; overflow-y: auto; padding: 12px 16px 24px; display: flex; flex-direction: column; gap: 12px; background: var(--color-surface); color: var(--color-on-surface); border-left: 1px solid var(--color-outline-variant); }
.rail summary { font-size: 0.8rem; letter-spacing: 0.1em; text-transform: uppercase; }
.rail summary span { font-weight: 400; letter-spacing: 0; text-transform: none; }
.rail .slider { display: grid; grid-template-columns: 1fr auto; gap: 2px 8px; align-items: center; margin-bottom: 8px; }
.rail .slider input { grid-column: 1 / -1; width: 100%; }
.rail .pair { display: flex; gap: 6px; align-items: center; margin-bottom: 8px; }
.rail .pair input { width: 5rem; }
.rail .pair legend { float: left; }
.rail .hint { opacity: 0.7; font-size: 0.75rem; margin: 0 0 8px; }
.rail .btns { display: flex; flex-wrap: wrap; gap: 6px; }
.rail label:has(> input[role=switch]) { display: flex; align-items: center; gap: 8px; margin-bottom: 4px; }
.census { display: grid; grid-template-columns: 1fr auto; gap: 4px 10px; margin: 0; }
.census dt, .census dd { margin: 0; }
.census dd { text-align: right; font-variant-numeric: tabular-nums; }
.census .zsrc-head { margin-top: 6px; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.06em; opacity: 0.7; }
.census .zr { font-size: 0.7rem; opacity: 0.7; }
.census .dot { display: inline-block; width: 10px; height: 10px; border-radius: 50%; }
#selDl { display: grid; grid-template-columns: auto 1fr; gap: 3px 12px; margin: 0 0 8px; }
#selDl dt { opacity: 0.7; }
#selDl dd { margin: 0; text-align: right; font-variant-numeric: tabular-nums; }
#selTag { font-weight: 600; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 6px; }
.app.collapsed { grid-template-columns: minmax(0, 1fr); }
.app.collapsed .rail { display: none; }

@media (max-width: 760px) {
  .app { grid-template-columns: 1fr; grid-template-rows: minmax(0, 1fr) auto; }
  .rail { border-left: 0; border-top: 1px solid var(--color-outline-variant); max-height: 46vh; }
  .hud h1 { font-size: 1.1rem; }
  .hud h1 small { display: none; }
}
`;

// A labelled range with a live readout. Labels use `for` directly because
// jiffies renders attributes verbatim.
function slider(
	id: string,
	text: string,
	min: string,
	max: string,
	step: string,
	value: string,
): HTMLDivElement {
	const lbl = label({}, text);
	lbl.setAttribute("for", id);
	return div(
		{ class: "slider" },
		lbl,
		output({ id: `${id}Out` }),
		input({ id, type: "range", min, max, step, value }),
	);
}

function numberRow(
	id: string,
	text: string,
	min: string,
	max: string,
	step: string,
	value: string,
): HTMLDivElement {
	const lbl = label({}, text);
	lbl.setAttribute("for", id);
	return div(
		{ class: "pair" },
		lbl,
		input({ id, type: "number", min, max, step, value }),
	);
}

function range(
	groupLabel: string,
	idLo: string,
	loValue: string,
	idHi: string,
	hiValue: string,
	max: string,
	step: string,
): HTMLFieldSetElement {
	const fs = fieldset(
		{ class: "pair" },
		span({}, groupLabel),
		attrs(
			input({ id: idLo, type: "number", min: "0", max, step, value: loValue }),
			{ "aria-label": `${groupLabel} minimum` },
		),
		span({}, "to"),
		attrs(
			input({ id: idHi, type: "number", min: "0", max, step, value: hiValue }),
			{ "aria-label": `${groupLabel} maximum` },
		),
	);
	fs.setAttribute("role", "group");
	return fs;
}

function toggle(id: string, text: string, checked: boolean): HTMLLabelElement {
	const lbl = label(
		{},
		attrs(input({ id, type: "checkbox", checked }), { role: "switch" }),
		text,
	);
	lbl.setAttribute("for", id);
	return lbl;
}

function opt(value: string, text: string): HTMLOptionElement {
	return option({ value }, text);
}

function projButton(
	value: string,
	text: string,
	title: string,
	pressed: boolean,
): HTMLButtonElement {
	const b = attrs(button({ class: "secondary", title }, text), {
		"aria-pressed": String(pressed),
	});
	b.dataset.v = value;
	return b;
}

function hudButton(
	id: string,
	text: string,
	title?: string,
): HTMLButtonElement {
	return button({ id, class: "secondary", title }, text);
}

function buildStage(): HTMLDivElement {
	const proj = fieldset(
		{ id: "proj" },
		projButton(
			"pyramid",
			"Pyramid",
			"The nearest depth is the telescope itself, so field width is proportional to depth",
			false,
		),
		projButton(
			"frustum",
			"Frustum",
			"Every source stays on its line of sight, so the telescope view matches the photograph",
			true,
		),
		projButton("box", "Box", "The field keeps its width at every depth", false),
	);
	attrs(proj, { role: "group", "aria-label": "Projection" });
	const spin = hudButton("vSpin", "Orbit");
	spin.setAttribute("aria-pressed", "false");
	const rail = attrs(
		button({ id: "railToggle", class: "secondary" }, "Hide controls"),
		{ "aria-controls": "rail", "aria-expanded": "true" },
	);
	const bar = progress({ id: "bar", class: "round" });
	return div(
		{ id: "stage", class: "stage" },
		div(
			{ class: "hud top compact" },
			h1(
				{},
				"Deep Field Volume",
				small({ id: "srcName" }, "Loading catalog field"),
			),
			hudButton(
				"vHome",
				"Telescope view",
				"Camera at the telescope: reproduces the original image (H)",
			),
			hudButton("vOblique", "Oblique"),
			hudButton("vSide", "Side"),
			hudButton("vTop", "Top"),
			spin,
			div({ class: "hudright" }, proj, rail),
		),
		div(
			{ class: "hud bottom" },
			span(
				{ class: "hint", id: "howto" },
				"Drag to rotate · right-drag or two fingers to pan · scroll to zoom · click a source to inspect",
			),
		),
		div({ id: "ring", class: "ring", hidden: true }),
		div({ id: "tip", class: "tip", hidden: true }),
		attrs(
			div(
				{ id: "busy", class: "busy" },
				div({}, div({ id: "busyText" }, "Analysing image"), bar),
			),
			{ role: "status", "aria-live": "polite" },
		),
	);
}

function sectionSummary(text: string): HTMLElement {
	return summary({}, text);
}

function buildRail(): HTMLElement {
	const selCls = select(
		{ id: "selCls" },
		opt("star", "Star"),
		opt("near", "Near galaxy"),
		opt("mid", "Mid galaxy"),
		opt("far", "Far galaxy"),
	);
	const selZ = input({
		id: "selZ",
		type: "number",
		min: "0",
		max: "20",
		step: "0.01",
		placeholder: "auto",
	});
	const selClsLabel = label({}, "Class");
	selClsLabel.setAttribute("for", "selCls");
	const selZLabel = label({}, "Redshift override");
	selZLabel.setAttribute("for", "selZ");
	const modeLabel = label({}, "Z axis measures");
	modeLabel.setAttribute("for", "mode");

	return aside(
		{ id: "rail", class: "rail compact" },
		details(
			{ open: true },
			summary({}, "Image ", span({ id: "dims" })),
			div(
				{ class: "btns" },
				button({ id: "loadSample" }, "Default field"),
				button({ id: "randJwst", class: "secondary" }, "Random JWST"),
				button({ id: "randHubble", class: "secondary" }, "Random Hubble"),
			),
			p(
				{ class: "hint" },
				"Only images with a published sky orientation and spectroscopic redshifts for sources in view are offered (DAWN JWST Archive, DESI DR1, SDSS DR18). Large images are analysed at 1600 px.",
			),
		),
		details(
			{ open: true },
			summary({}, "Census ", span({ id: "spikeInfo" })),
			dl({ id: "census", class: "census" }),
		),
		details(
			{ id: "selSec", open: true, hidden: true },
			summary({}, "Selected"),
			div({ id: "selTag" }),
			dl({ id: "selDl" }),
			div({ class: "slider" }, selClsLabel, selCls),
			div({ class: "slider" }, selZLabel, selZ),
			div(
				{ class: "btns" },
				button({ id: "selReset", class: "secondary" }, "Use estimate"),
				button({ id: "selClose", class: "secondary" }, "Deselect"),
			),
		),
		details(
			{ open: true },
			sectionSummary("Depth"),
			div(
				{ class: "slider" },
				modeLabel,
				select(
					{ id: "mode" },
					opt("comoving", "Comoving distance"),
					opt("lookback", "Light-travel time"),
					opt("log", "log(1 + z)"),
					opt("linear", "Redshift z"),
				),
			),
			slider("stretch", "Depth stretch", "0", "8", "0.05", "2.5"),
			slider("gamma", "Depth curve", "0.25", "2.5", "0.05", "1"),
			p(
				{ class: "hint" },
				"Curve below 1 opens up the foreground; above 1 opens up the deep field.",
			),
		),
		details(
			{},
			sectionSummary("Redshift assignment"),
			numberRow("zNear", "Near galaxies, z", "0", "2", "0.001", "0.0856"),
			range("Mid galaxies, z", "zMid0", "0.4", "zMid1", "2.0", "20", "0.05"),
			range("Far galaxies, z", "zFar0", "2.0", "zFar1", "6", "20", "0.1"),
			slider("cue", "Depth cue: size ↔ colour", "0", "1", "0.05", "0.75"),
			p(
				{ class: "hint" },
				"Sources matched to a catalog spectroscopic redshift are placed at that redshift. These settings only place the rest: within each class, smaller and redder sources are placed farther. Those are rank-order guesses, not measurements. The defaults were checked against spectroscopic redshifts in two JWST fields (rank correlation about 0.55; about 3 in 10 source pairs come out in the wrong order).",
			),
		),
		details(
			{ open: true },
			sectionSummary("Display"),
			slider("bright", "Brightness", "0.3", "3", "0.05", "1.15"),
			slider("scale", "Sprite size", "0.5", "3", "0.05", "1"),
			slider("sky", "Unresolved sky at back", "0", "1", "0.05", "0.3"),
			toggle("shells", "Redshift shells and bounding volume", true),
			toggle("markers", "Class markers", false),
			toggle("labels", "Name labels", true),
		),
		details(
			{},
			sectionSummary("Detection settings"),
			slider("dK", "Threshold above sky (σ)", "2", "12", "0.5", "5"),
			slider(
				"dNear",
				"Near: min area (% of frame)",
				"0.05",
				"2",
				"0.05",
				"0.22",
			),
			slider("dBlue", "Near: bluer than field by", "0", "1", "0.05", "0.35"),
			slider("dFar", "Far: max area (px)", "8", "200", "2", "40"),
			slider("dSpike", "Star: spike contrast (σ)", "1", "6", "0.25", "2.5"),
			slider("dCont", "Deblend contrast", "0.001", "0.05", "0.001", "0.005"),
			button({ id: "rerun" }, "Re-run detection"),
		),
		details(
			{},
			sectionSummary("Method"),
			p(
				{ class: "hint" },
				"Sources are found with a Rust detector compiled to WebAssembly, following the SExtractor method: a sky background mesh, matched-filter thresholding, 8-connected extraction and multi-threshold deblending.",
			),
			p(
				{ class: "hint" },
				"Stars are found by their diffraction spikes. For each bright source, the light along both opposite rays at every angle is measured; the angles shared by several sources are the telescope's spike pattern, and a source is a star when it shows sharp peaks at those angles.",
			),
			p(
				{ class: "hint" },
				"Near galaxies are large and clearly bluer than the field median: in an infrared composite, redshift pushes light into the redder filters. Pieces of a near galaxy cut off by deblending join its group. Mid and far galaxies are split by isophotal area.",
			),
			p(
				{ class: "hint" },
				"Sprites are the original pixels of each source, sky-subtracted and masked to its own footprint, drawn additively. Distances use flat ΛCDM with H₀ = 67.7, Ωm = 0.31.",
			),
			p(
				{ class: "hint", id: "credit" },
				"Sample image: ",
				a(
					{
						href: "https://esawebb.org/images/potm2301a/",
						target: "_blank",
						rel: "noopener",
					},
					"A Spiral Amongst Thousands",
				),
				", ESA/Webb, NASA & CSA, A. Martel (CC BY 4.0). LEDA 2046648 redshift 0.0856 from NED via ",
				a(
					{
						href: "https://en.wikipedia.org/wiki/PGC_2046648",
						target: "_blank",
						rel: "noopener",
					},
					"PGC 2046648",
				),
				".",
			),
		),
	);
}

export default {
	head: () => [
		...pageHead("Deep Field Volume"),
		meta({
			name: "description",
			content:
				"Detects stars and near, mid and far galaxies in a Hubble or JWST image and rebuilds it as a rotatable 3-D redshift volume from the original pixels.",
		}),
		style({}, CSS),
		script({ src: `${THREE_CDN}/build/three.min.js` }),
		script({ src: `${THREE_CDN}/examples/js/controls/OrbitControls.js` }),
	],
	default: () => div({ id: "app", class: "app" }, buildStage(), buildRail()),
	clientModules: ["/src/components/deep_field/client.ts"],
} satisfies PageModule;
