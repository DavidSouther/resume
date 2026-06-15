import {
	button,
	details,
	div,
	input,
	label,
	option,
	script,
	select,
	span,
	style,
	summary,
} from "@davidsouther/jiffies/dom/html.ts";
import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
import { ASTROLABE_CSS } from "../../src/lib/astrolabe/css.ts";
import { buildDial } from "../../src/lib/astrolabe/dial.ts";
import { pageHead } from "../../src/lib/page-head.ts";

const ASTRONOMY_CDN =
	"https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.js";

function row(labelText: string, ...controls: Node[]): HTMLDivElement {
	return div({ class: "row" }, label({}, labelText), ...controls);
}

function colorSwatch(
	labelText: string,
	varName: string,
	defaultColor: string,
): HTMLDivElement {
	const inp = input({ type: "color", value: defaultColor });
	inp.dataset.var = varName;
	inp.dataset.def = defaultColor;
	return div({ class: "sw" }, span({}, labelText), inp);
}

function buildControlsPanel(): HTMLDivElement {
	return div(
		{ id: "controls", ariaLabel: "Controls" },
		details(
			{ open: true },
			summary({}, "Motion"),
			row(
				"Earth",
				select(
					{ id: "earthMode" },
					option({ value: "fixed" }, "Stationary"),
					option({ value: "orbital" }, "Orbital"),
				),
			),
			row(
				"Animation speed",
				input({
					id: "speed",
					type: "range",
					min: "0",
					max: "1",
					step: "0.002",
					value: "0",
				}),
				span({ class: "val", id: "speedVal" }, "17.9 day/s"),
			),
			div({ class: "note", id: "simClock" }),
			row(
				"Parallax",
				input({ id: "parallaxOn", type: "checkbox", checked: true }),
			),
			row(
				"Parallax strength",
				input({
					id: "parallax",
					type: "range",
					min: "0",
					max: "1.5",
					step: "0.05",
					value: "0.7",
				}),
				span({ class: "val", id: "parallaxVal" }, "0.70"),
			),
			button({ id: "motionBtn", class: "btn" }, "Enable device tilt"),
			div(
				{ class: "note" },
				"Desktop uses the cursor for parallax. On phones, tap “Enable device tilt”.",
			),
		),
		details(
			{},
			summary({}, "Display"),
			row(
				"Dial finish",
				select(
					{ id: "bgMode" },
					option({ value: "flat" }, "Flat"),
					option({ value: "textured" }, "Textured"),
					option({ value: "sparkle" }, "Textured + sparkling"),
				),
			),
			row(
				"Orbit discs",
				input({ id: "t_orbits", type: "checkbox", checked: true }),
			),
			row("Disc arms", input({ id: "t_spokes", type: "checkbox" })),
			row(
				"Zodiac signs",
				input({ id: "t_zlabels", type: "checkbox", checked: true }),
			),
			row(
				"Sign dividers",
				input({ id: "t_dividers", type: "checkbox", checked: true }),
			),
			row(
				"Sign highlight",
				input({ id: "t_glow", type: "checkbox", checked: true }),
			),
			row("Sign info", input({ id: "t_occ", type: "checkbox", checked: true })),
			row(
				"Twilight zone",
				input({ id: "t_twilight", type: "checkbox", checked: true }),
			),
			row(
				"Conjunction lines",
				input({ id: "t_conj", type: "checkbox", checked: true }),
			),
			row(
				"Curved conjunctions",
				input({ id: "t_conj_curved", type: "checkbox", checked: true }),
			),
			row(
				"Conjunction within",
				input({
					id: "conjDeg",
					type: "range",
					min: "1",
					max: "12",
					step: "0.5",
					value: "3",
				}),
				span({ class: "val", id: "conjDegVal" }, "3°"),
			),
			row(
				"Guilloche",
				input({ id: "t_guilloche", type: "checkbox", checked: true }),
			),
			row(
				"Guilloche lines",
				input({
					id: "guillocheN",
					type: "range",
					min: "12",
					max: "360",
					step: "12",
					value: "120",
				}),
				span({ class: "val", id: "guillocheNVal" }, "120"),
			),
			row(
				"Watch hands",
				input({ id: "t_hands", type: "checkbox", checked: true }),
			),
			row("Moon", input({ id: "t_moon", type: "checkbox", checked: true })),
		),
		details(
			{},
			summary({}, "Colors"),
			div(
				{ class: "swatches" },
				colorSwatch("Background", "--ground", "#080B12"),
				colorSwatch("Zodiac band", "--zband", "#0E1422"),
				colorSwatch("Orbits", "--orbit", "#1A2340"),
				colorSwatch("Labels", "--label", "#8898BB"),
				colorSwatch("Hands", "--hand", "#EDE6CF"),
				colorSwatch("Sun", "--sun", "#D4A843"),
				colorSwatch("Mercury", "--mercury", "#9A9AAE"),
				colorSwatch("Venus", "--venus", "#C8B87A"),
				colorSwatch("Earth", "--earth", "#4A7FC1"),
				colorSwatch("Mars", "--mars", "#C46A3A"),
				colorSwatch("Jupiter", "--jupiter", "#BFA06A"),
				colorSwatch("Saturn", "--saturn", "#C8BE9A"),
				colorSwatch("Uranus", "--uranus", "#6AACB8"),
				colorSwatch("Neptune", "--neptune", "#4A5CAA"),
				colorSwatch("Moon", "--moon", "#D0D4DC"),
			),
		),
		div(
			{ class: "btnrow" },
			button({ id: "resetBtn", class: "btn" }, "Reset"),
			button({ id: "closeBtn", class: "btn" }, "Close"),
		),
	);
}

export default {
	head: () => [
		...pageHead("Astrolabe"),
		style({}, ASTROLABE_CSS),
		script({ src: ASTRONOMY_CDN, crossOrigin: "anonymous" }),
	],
	default: () =>
		div(
			{ id: "stage-wrap" },
			button({ id: "gear", ariaLabel: "Toggle controls" }, "CONTROLS"),
			buildControlsPanel(),
			div({ id: "tip" }),
			div({ id: "signcard" }),
			buildDial(),
		),
	clientModules: ["/src/components/astrolabe/client.ts"],
} satisfies PageModule;
