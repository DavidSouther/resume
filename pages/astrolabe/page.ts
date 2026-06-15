import {
	button,
	details,
	div,
	input,
	label,
	script,
	span,
	style,
	summary,
} from "@davidsouther/jiffies/dom/html.ts";
import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
import { buildDial } from "../../src/components/astrolabe/dial.ts";
import { ASTROLABE_CSS } from "../../src/lib/astrolabe/css.ts";
import { MATERIALS } from "../../src/lib/astrolabe/materials.ts";
import { SPEED_STEPS } from "../../src/lib/astrolabe/math.ts";
import { pageHead } from "../../src/lib/page-head.ts";

const ASTRONOMY_CDN =
	"https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.js";

function row(labelText: string, ...controls: Node[]): HTMLDivElement {
	// Associate the label with the first control that carries an id, so clicking
	// the whole label toggles its checkbox (a no-op for range/select rows).
	const forId = (controls[0] as Partial<HTMLElement>)?.id;
	const lbl = label({}, labelText);
	// jiffies renders attrs verbatim (no htmlFor→for mapping), so set `for`
	// directly to associate the label with its control.
	if (forId) lbl.setAttribute("for", forId);
	return div({ class: "row" }, lbl, ...controls);
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

// One case-material button: a metallic chip in the material's representative
// color over its name. controls.ts reads data-material to apply the preset.
function materialButton(
	id: string,
	name: string,
	swatch: string,
): HTMLButtonElement {
	const chip = span({ class: "chip" });
	chip.style.setProperty("--chip", swatch);
	const btn = button(
		{ class: "material-swatch", ariaLabel: name },
		chip,
		span({}, name),
	);
	btn.dataset.material = id;
	return btn;
}

// Primary motion controls: visible on screen at all times, independent of the
// expandable controls panel (which slides off when closed).
function clockRow(labelText: string, valId: string): HTMLDivElement {
	return div(
		{ class: "clock-row" },
		span({ class: "clock-k" }, labelText),
		span({ class: "clock-v", id: valId }),
	);
}

// A segmented single-choice control. Each button carries its data-value;
// controls.ts wires the active state and reflects the choice on the group's
// own dataset so non-DOM readers (e.g. sizeDial) can read it.
function segGroup(
	groupId: string,
	items: { value: string; label: string }[],
	active: string,
): HTMLDivElement {
	const grp = div({ class: "btn-group", id: groupId });
	grp.setAttribute("role", "group");
	grp.dataset.value = active;
	for (const { value, label: text } of items) {
		const b = button({ class: value === active ? "seg active" : "seg" }, text);
		b.dataset.value = value;
		grp.appendChild(b);
	}
	return grp;
}

function field(labelText: string, control: Node): HTMLDivElement {
	return div(
		{ class: "field" },
		span({ class: "field-k" }, labelText),
		control,
	);
}

function buildAlwaysControls(): HTMLDivElement {
	return div(
		{ id: "always-controls", ariaLabel: "Motion" },
		div(
			{ class: "clock" },
			clockRow("Real:", "realClock"),
			clockRow("Sim:", "simClock"),
		),
		field(
			"Earth",
			segGroup(
				"earthMode",
				[
					{ value: "fixed", label: "Stationary" },
					{ value: "orbital", label: "Orbital" },
				],
				"fixed",
			),
		),
		field(
			"Case",
			segGroup(
				"caseSize",
				[
					{ value: "full", label: "Full" },
					{ value: "90", label: "90mm" },
					{ value: "48", label: "48mm" },
					{ value: "38", label: "38mm" },
				],
				"full",
			),
		),
		field(
			"Speed",
			segGroup(
				"speed",
				SPEED_STEPS.map((s, i) => ({ value: String(i), label: s.label })),
				"0",
			),
		),
		field(
			"Material",
			div(
				{ class: "materials" },
				...MATERIALS.map((m) => materialButton(m.id, m.name, m.swatch)),
			),
		),
	);
}

function buildControlsPanel(): HTMLDivElement {
	return div(
		{ id: "controls", ariaLabel: "Controls" },
		details(
			{},
			summary({}, "Motion"),
			row("Parallax", input({ id: "parallaxOn", type: "checkbox" })),
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
				"Orbit discs",
				input({ id: "t_orbits", type: "checkbox", checked: true }),
			),
			row("Disc arms", input({ id: "t_spokes", type: "checkbox" })),
			row("Sign info", input({ id: "t_occ", type: "checkbox", checked: true })),
			row(
				"Twilight zone",
				input({ id: "t_twilight", type: "checkbox", checked: true }),
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
				colorSwatch("Guilloche", "--guilloche", "#AEB6C2"),
				colorSwatch("Case", "--case", "#C7CBD2"),
				colorSwatch("Strap leather", "--strap-leather", "#3A2A1E"),
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
			div(
				{ id: "strap", ariaHidden: "true" },
				div({ class: "strap-band strap-top" }),
				div({ class: "strap-band strap-bottom" }),
			),
			button({ id: "gear", ariaLabel: "Toggle controls" }, "CONTROLS"),
			buildAlwaysControls(),
			buildControlsPanel(),
			div({ id: "tip" }),
			div({ id: "signcard" }),
			buildDial(),
		),
	clientModules: ["/src/components/astrolabe/client.ts"],
} satisfies PageModule;
