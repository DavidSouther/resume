// The Astrolabe controls component library + state core (Feature 3 — controls
// drawer state/markup separation). This is the new home for everything the
// rewritten drawer needs:
//
//   - the single serializable `ControlsState` + its `DEFAULTS`, the `toConfig`
//     projection the 60fps loop reads (data, NOT styling), and v2 persistence;
//   - `RootStyleSink`, the one cooperative cssText writer the color/material
//     controls share (the only place pure distribution meets the cssText-only
//     DOM wall);
//   - five dumb, presentational leaf control FCCs that each render themselves
//     from their value props and apply the single styling effect they own;
//   - the `ControlsDrawer` FCC that composes the leaves and fans state down, and
//     the thin `initControls` controller that holds state, persists it, pushes it
//     down, and derives `toConfig(state)`, making zero styling decisions.
//
// Mirrors the dial's `components.ts` (dumb leaf FCCs) + `view.ts` (state holder)
// split. No raw DOM mutation lives here — every write flows through Jiffies
// builders / `up()` / FCC `.update()`.
//
// Event wiring follows the Jiffies contract: handlers are passed in the `events`
// prop (the one key `update` wires via addEventListener, never as a serialized
// attribute), so a leaf takes an `events` map and the controller's handler reads
// the value off the event's `target`. No callback is ever a bare prop. See
// .ailly/developer/2026-06-23-A-astrolabe-fcc-refactor/controls-redesign.md.
import type { DomAttrs } from "@davidsouther/jiffies/dom/dom.ts";
import { up } from "@davidsouther/jiffies/dom/dom.ts";
import { FCC, type FCComponent, State } from "@davidsouther/jiffies/dom/fc.ts";
import {
	button,
	details,
	div,
	input,
	label,
	span,
	summary,
} from "@davidsouther/jiffies/dom/html.ts";
import {
	MATERIALS,
	type Material,
	type MaterialId,
	materialVars,
} from "../../lib/astrolabe/materials.ts";
import { SPEED_STEPS, speedToMul } from "../../lib/astrolabe/math.ts";
import type { Scene } from "../../lib/astrolabe/simulate.ts";
import {
	type Config,
	type EarthMode,
	GALILEAN,
	KEPLERIAN,
	PTOLEMAIC,
} from "../../lib/astrolabe/types.ts";
import {
	ClockworkRearFace,
	type ClockworkRearFaceProps,
} from "./clockwork-components.ts";
import { Clock, SignCard, Tooltip } from "./overlays.ts";
import { AstrolabeView, type ViewEvents } from "./view.ts";

// --- The one source of truth ------------------------------------------------

// One serializable object is the single source of truth for the whole drawer.
// The DOM is a projection of it, never a store. Panel open/close is drawer-local
// UI state and deliberately NOT part of this (it is not persisted).
export interface ControlsState {
	earthMode: "ptolemaic" | "galilean" | "keplerian";
	sizeMode: "full" | "90" | "48" | "38";
	speedStep: number; // index into SPEED_STEPS
	material: MaterialId;
	parallaxOn: boolean;
	parallax: number;
	orbits: boolean; // hide-orbits   (CSS only)
	spokes: boolean; // hide-spokes   (CSS only)
	signInfo: boolean; // → cfg.occ
	twilight: boolean; // → cfg.twilight + hide-twilight
	guilloche: boolean; // → cfg.guilloche + hide-guilloche
	guillocheN: number;
	hands: boolean; // → cfg.hands + hide-hands
	moon: boolean; // hide-moon     (CSS only)
	colors: Record<string, string>; // "--var" → hex; advanced overrides over the material
}

// Mirrors the current markup defaults (the `checked`/`value`/`data-value`/
// default-material the SSG renders today).
export const DEFAULTS: ControlsState = {
	earthMode: "galilean",
	sizeMode: "full",
	speedStep: 0,
	material: "platinum",
	parallaxOn: false,
	parallax: 0.7,
	orbits: true,
	spokes: false,
	signInfo: true,
	twilight: true,
	guilloche: true,
	guillocheN: 120,
	hands: true,
	moon: true,
	colors: {},
};

// Clean break from v1: the v1 blob is ignored (one-time reset to defaults).
export const STORAGE_KEY = "astrolabe.controls.v2";

// Map the earthMode string to the EarthMode enum (data for the loop).
export const EARTH_MODE_BY_VALUE: Record<string, EarthMode> = {
	ptolemaic: PTOLEMAIC,
	galilean: GALILEAN,
	keplerian: KEPLERIAN,
};

// The one thing the controller derives: the simulation inputs the loop consumes.
// Data, NOT styling — the hide-*/var styling layer is distributed to the controls.
export function toConfig(s: ControlsState): Config {
	return {
		speed: speedToMul(s.speedStep),
		sizeMode: s.sizeMode,
		earthMode: EARTH_MODE_BY_VALUE[s.earthMode] ?? GALILEAN,
		parallaxOn: s.parallaxOn,
		parallax: s.parallax,
		occ: s.signInfo,
		twilight: s.twilight,
		guilloche: s.guilloche,
		guillocheN: s.guillocheN,
		hands: s.hands,
	};
}

// Keep only string-valued `--*` entries of an unknown blob — a tampered or stale
// nested value (non-string, or a key without the `--` prefix) is dropped.
function parseColors(v: unknown): Record<string, string> {
	const out: Record<string, string> = {};
	if (typeof v === "object" && v !== null) {
		for (const [k, val] of Object.entries(v)) {
			if (k.startsWith("--") && typeof val === "string") out[k] = val;
		}
	}
	return out;
}

const EARTH_MODES = ["ptolemaic", "galilean", "keplerian"] as const;
const SIZE_MODES = ["full", "90", "48", "38"] as const;
const MATERIAL_IDS = MATERIALS.map((m) => m.id);

// Parse an unknown blob into a known-good ControlsState, field-by-field vs
// DEFAULTS. The enum-ish fields are validated against their allowed value set
// (not just "is a string"), so the returned value is a real proof of its type;
// booleans/numbers fall back on a type mismatch, and a non-finite number (NaN
// speedStep) falls back too. Never throws; a non-object yields a DEFAULTS clone.
export function validateState(raw: unknown): ControlsState {
	if (typeof raw !== "object" || raw === null) {
		return { ...DEFAULTS, colors: {} };
	}
	const o = raw as Record<string, unknown>;
	const pickEnum = <T extends string>(
		v: unknown,
		allowed: readonly T[],
		def: T,
	): T => (typeof v === "string" && allowed.includes(v as T) ? (v as T) : def);
	const pickBool = (v: unknown, def: boolean): boolean =>
		typeof v === "boolean" ? v : def;
	const pickNum = (v: unknown, def: number): number =>
		typeof v === "number" && Number.isFinite(v) ? v : def;
	return {
		earthMode: pickEnum(o.earthMode, EARTH_MODES, DEFAULTS.earthMode),
		sizeMode: pickEnum(o.sizeMode, SIZE_MODES, DEFAULTS.sizeMode),
		speedStep: pickNum(o.speedStep, DEFAULTS.speedStep),
		material: pickEnum(o.material, MATERIAL_IDS, DEFAULTS.material),
		parallaxOn: pickBool(o.parallaxOn, DEFAULTS.parallaxOn),
		parallax: pickNum(o.parallax, DEFAULTS.parallax),
		orbits: pickBool(o.orbits, DEFAULTS.orbits),
		spokes: pickBool(o.spokes, DEFAULTS.spokes),
		signInfo: pickBool(o.signInfo, DEFAULTS.signInfo),
		twilight: pickBool(o.twilight, DEFAULTS.twilight),
		guilloche: pickBool(o.guilloche, DEFAULTS.guilloche),
		guillocheN: pickNum(o.guillocheN, DEFAULTS.guillocheN),
		hands: pickBool(o.hands, DEFAULTS.hands),
		moon: pickBool(o.moon, DEFAULTS.moon),
		colors: parseColors(o.colors),
	};
}

// Best-effort write of the state object as-is. A disabled or full store is
// swallowed — persistence is never load-bearing.
export function persist(s: ControlsState): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
	} catch {
		// ignore: storage disabled or over quota
	}
}

// Read + parse-don't-validate the v2 blob; null on absence/garbage. Reads ONLY
// the v2 key, so a stored v1 blob is ignored (the clean-break reset).
export function loadState(): ControlsState | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		return validateState(JSON.parse(raw));
	} catch {
		return null;
	}
}

// --- The shared cssText writer ----------------------------------------------

// The cooperative CSS-var writer the color/material controls share. `--*` can
// only be written through a whole-string cssText (the object-style path cannot
// set custom properties), and that string also carries `--dial-px` (owned by
// client.ts) — so the var writes cannot distribute cleanly and instead merge
// into a shared map flushed once. The DECISION (which var, what value) stays in
// each control; only the cssText MECHANISM is shared.
export interface RootStyleSink {
	set(varName: string, value: string): void;
}

export function rootStyleSink(root: HTMLElement): RootStyleSink {
	const vars = new Map<string, string>();
	function flush() {
		// cssText replaces ALL inline style, so re-emit `--dial-px` (owned by
		// client.ts' host sizing), read fresh, so the whole-string write never
		// drops it. A single flush per change — not one per var — keeps a
		// material's whole var map from forcing N restyles. `getComputedStyle` is
		// guarded: at SSG build time the drawer is constructed too, and --dial-px
		// is not set there anyway (client.ts owns it), so a miss is harmless.
		const gcs = globalThis.getComputedStyle?.bind(globalThis);
		const dialPx = gcs ? gcs(root).getPropertyValue("--dial-px") : "";
		const parts: string[] = [];
		if (dialPx?.trim()) parts.push(`--dial-px:${dialPx.trim()}`);
		for (const [k, v] of vars) parts.push(`${k}:${v}`);
		up(root, { style: parts.join(";") });
	}
	return {
		set(name, value) {
			vars.set(name, value);
			flush();
		},
	};
}

// --- Dumb, presentational leaf control FCCs ---------------------------------
// Each leaf renders its UI from its value props and applies the single styling
// effect it owns (a hide-* root class, the full-screen class, or a CSS var via
// the sink). Event handlers arrive in the `events` prop and Jiffies wires them
// onto the boundary; the controller's handler reads the value off the event's
// `target`. Leaves hold no callbacks and make no state decisions.

// One DOM-event map (e.g. `{ change }`, `{ input }`, `{ click }`). Reuses the
// framework's events shape so it passes straight through to the boundary.
export type EventMap = NonNullable<DomAttrs["events"]>;

// Checkbox that OWNS its `hide-*` root class. The boundary IS the input, so the
// `events` change handler wires directly onto it.
export type CheckProps = {
	id: string;
	checked: boolean;
	root: HTMLElement;
	rootClass?: string;
};
export const CheckControl = FCC<CheckProps>(
	"astro-check-control",
	() => input({ type: "checkbox" }),
	(el, attrs) => {
		up(el, { id: attrs.id });
		(el as unknown as HTMLInputElement).checked = attrs.checked;
		if (attrs.rootClass) {
			up(attrs.root, {
				class: attrs.checked ? `!${attrs.rootClass}` : attrs.rootClass,
			});
		}
		return [];
	},
);

// Range slider + readout. The input + readout are built once and stashed in
// `[State]` (no DOM traversal): each render drives the SAME nodes — the input's
// value via the `.value` property (survives a user drag), the readout via a text
// reconcile. The `events` input handler wires onto the boundary <span>; an input
// event bubbles up from the child input, so the controller reads `event.target`.
export type RangeProps = {
	id: string;
	value: number;
	label: string;
	min: number;
	max: number;
	step: number;
};
type RangeState = { inp: HTMLInputElement; out: HTMLElement };
export const RangeControl = FCC<RangeProps, RangeState>(
	"astro-range-control",
	() => span({ class: "range-control" }),
	(el, attrs) => {
		// This control's `id` identifies its INPUT (the form control), not the
		// wrapper. `applyUpdate` auto-applied `id` to the boundary <span>; move it
		// to the input so `getElementById`/`label[for]` resolve to the slider.
		up(el, { id: false });
		const st = el[State] as RangeState;
		if (!st.inp) {
			st.inp = input({
				id: attrs.id,
				type: "range",
				min: String(attrs.min),
				max: String(attrs.max),
				step: String(attrs.step),
			}) as unknown as HTMLInputElement;
			st.out = span({ class: "val" });
		}
		st.inp.value = String(attrs.value);
		up(st.out, {}, attrs.label);
		return [st.inp, st.out];
	},
);

// Segmented single-choice control: marks the active button, reflects the value
// on the group's `data-value`, and (optionally) owns a root class applied when
// its value equals `rootClassValue` (caseSize owns `full-screen` at "full"). The
// `events` click handler wires onto the group; a click bubbles from a button, so
// the controller reads `event.target`'s `data-value`.
export type SegmentProps = {
	id: string;
	items: { value: string; label: string }[];
	value: string;
	root?: HTMLElement;
	rootClass?: string;
	rootClassValue?: string;
};
export const SegmentGroup = FCC<SegmentProps>(
	"astro-segment-group",
	() => div({ class: "btn-group", role: "group" }),
	(el, attrs) => {
		up(el, { id: attrs.id, "data-value": attrs.value });
		if (attrs.root && attrs.rootClass) {
			const on = attrs.value === attrs.rootClassValue;
			up(attrs.root, {
				class: on ? attrs.rootClass : `!${attrs.rootClass}`,
			});
		}
		return attrs.items.map((it) =>
			button(
				{
					class: it.value === attrs.value ? "seg active" : "seg",
					"data-value": it.value,
				},
				it.label,
			),
		);
	},
);

// Case-material swatch row: marks the active swatch from `value`. The material's
// var map is applied by the color pickers (which the controller re-seeds on a
// material change), so this writes no vars. The `events` click handler wires onto
// the group; the swatch's inner spans are `pointer-events:none` (CSS) so the
// controller reads `event.target`'s `data-material`.
export type MaterialProps = { materials: Material[]; value: MaterialId };
export const MaterialPicker = FCC<MaterialProps>(
	"astro-material-picker",
	() => div({ class: "materials" }),
	(_el, attrs) =>
		attrs.materials.map((m) =>
			button(
				{
					class:
						m.id === attrs.value ? "material-swatch active" : "material-swatch",
					ariaLabel: m.name,
					"data-material": m.id,
				},
				span({ class: "chip", style: `--chip:${m.swatch}` }),
				span({}, m.name),
			),
		),
);

// Color picker that OWNS its CSS var: on render it writes `value` through the
// shared sink (the cssText-only wall). The boundary IS the color input, so the
// `events` input handler wires directly onto it.
export type ColorProps = {
	value: string;
	varName: string;
	def: string;
	sink: RootStyleSink;
};
export const ColorPicker = FCC<ColorProps>(
	"astro-color-picker",
	() => input({ type: "color" }),
	(el, attrs) => {
		up(el, { "data-var": attrs.varName, "data-def": attrs.def });
		(el as unknown as HTMLInputElement).value = attrs.value;
		attrs.sink.set(attrs.varName, attrs.value);
		return [];
	},
);

// --- The drawer FCC ---------------------------------------------------------

// The color pickers, in drawer order. Each `def` is the markup default (= the
// platinum value, the default material), so a fresh drawer with no overrides and
// the platinum material shows exactly these.
const COLORS: { label: string; varName: string; def: string }[] = [
	{ label: "Background", varName: "--ground", def: "#080B12" },
	{ label: "Zodiac band", varName: "--zband", def: "#0E1422" },
	{ label: "Orbits", varName: "--orbit", def: "#1A2340" },
	{ label: "Labels", varName: "--label", def: "#8898BB" },
	{ label: "Hands", varName: "--hand", def: "#EDE6CF" },
	{ label: "Sun", varName: "--sun", def: "#D4A843" },
	{ label: "Mercury", varName: "--mercury", def: "#9A9AAE" },
	{ label: "Venus", varName: "--venus", def: "#C8B87A" },
	{ label: "Earth", varName: "--earth", def: "#4A7FC1" },
	{ label: "Mars", varName: "--mars", def: "#C46A3A" },
	{ label: "Jupiter", varName: "--jupiter", def: "#BFA06A" },
	{ label: "Saturn", varName: "--saturn", def: "#C8BE9A" },
	{ label: "Uranus", varName: "--uranus", def: "#6AACB8" },
	{ label: "Neptune", varName: "--neptune", def: "#4A5CAA" },
	{ label: "Moon", varName: "--moon", def: "#D0D4DC" },
	{ label: "Guilloche", varName: "--guilloche", def: "#AEB6C2" },
	{ label: "Case", varName: "--case", def: "#C7CBD2" },
	{ label: "Strap leather", varName: "--strap-leather", def: "#3A2A1E" },
];

const EARTH_ITEMS = [
	{ value: "ptolemaic", label: "Ptolemaic" },
	{ value: "galilean", label: "Galilean" },
	{ value: "keplerian", label: "Keplerian" },
];
const CASE_ITEMS = [
	{ value: "full", label: "Full" },
	{ value: "90", label: "90mm" },
	{ value: "48", label: "48mm" },
	{ value: "38", label: "38mm" },
];
const SPEED_ITEMS = SPEED_STEPS.map((s, i) => ({
	value: String(i),
	label: s.label,
}));

// The effective color a picker shows: an explicit override wins, else the
// current material's value, else the markup default. (Only --strap-leather has
// no material entry, so it falls straight through to its def.)
function effectiveColor(
	state: ControlsState,
	varName: string,
	def: string,
): string {
	return state.colors[varName] ?? materialVars(state.material)[varName] ?? def;
}

// Local layout builders (parity with the previous stage.ts markup).
function row(labelText: string, ...controls: Element[]): HTMLDivElement {
	const forId = (controls[0] as Partial<HTMLElement>)?.id;
	const lbl = forId ? label({ for: forId }, labelText) : label({}, labelText);
	return div({ class: "row" }, lbl, ...controls);
}
function field(labelText: string, control: Element): HTMLDivElement {
	return div(
		{ class: "field" },
		span({ class: "field-k" }, labelText),
		control,
	);
}
function clockRow(labelText: string, valEl: Element): HTMLDivElement {
	return div(
		{ class: "clock-row" },
		span({ class: "clock-k" }, labelText),
		valEl,
	);
}
function colorSwatch(labelText: string, inp: Element): HTMLDivElement {
	return div({ class: "sw" }, span({}, labelText), inp);
}

// The single `#stage-wrap` component (evolved from the controls-only drawer):
// it owns the whole stage and takes TWO merged payloads. The controls controller
// pushes `{ state, events }` (rare); the animation loop pushes `{ scene, dialEvents }`
// (60fps). `inputs.attrs` merges, so neither clobbers the other, and each fan is
// reference-gated so a scene frame never re-renders the controls and a state change
// never re-renders the dial. The dial (`AstrolabeView`) and overlays (`Clock` ×2,
// `Tooltip`, `SignCard`) are built and owned here — no element handle is passed in.
export type DrawerProps = {
	state?: ControlsState;
	events?: Record<string, EventMap>;
	scene?: Scene;
	dialEvents?: ViewEvents;
};

// Built-once, per-instance handles kept in the FCC `[State]`: the leaf controls,
// the static shell, and the panel-open flag. Built on the first render and
// reused thereafter, so `update` only fans values + events.
type DrawerInternals = {
	built: boolean;
	open: boolean;
	lastState?: ControlsState;
	lastScene?: Scene;
	// The dial + overlay FCC instances this component owns and fans the Scene to.
	dial: ReturnType<typeof AstrolabeView>;
	tip: ReturnType<typeof Tooltip>;
	signcard: ReturnType<typeof SignCard>;
	simClock: ReturnType<typeof Clock>;
	realClock: ReturnType<typeof Clock>;
	earthSeg: FCComponent<SegmentProps, object>;
	caseSeg: FCComponent<SegmentProps, object>;
	speedSeg: FCComponent<SegmentProps, object>;
	material: FCComponent<MaterialProps, object>;
	parallaxOn: FCComponent<CheckProps, object>;
	parallax: FCComponent<RangeProps, RangeState>;
	orbits: FCComponent<CheckProps, object>;
	spokes: FCComponent<CheckProps, object>;
	occ: FCComponent<CheckProps, object>;
	twilight: FCComponent<CheckProps, object>;
	guilloche: FCComponent<CheckProps, object>;
	guillocheN: FCComponent<RangeProps, RangeState>;
	hands: FCComponent<CheckProps, object>;
	moon: FCComponent<CheckProps, object>;
	colors: FCComponent<ColorProps, object>[];
	strap: Element;
	caseback: ReturnType<typeof ClockworkRearFace>;
	caseFlipped: boolean;
	gear: HTMLElement;
	panel: HTMLElement;
	resetBtn: HTMLElement;
};

function clockworkProps(
	root: Element,
	st: DrawerInternals,
	state = st.lastState ?? DEFAULTS,
): ClockworkRearFaceProps {
	return {
		mode: state.earthMode,
		speed: speedToMul(state.speedStep),
		flipped: st.caseFlipped,
		events: {
			click: (e) => {
				const target = e.target as HTMLElement;
				if (!target.closest?.("#flipCase")) return;
				st.caseFlipped = !st.caseFlipped;
				syncCaseback(root, st);
			},
		},
	};
}

function syncCaseback(
	root: Element,
	st: DrawerInternals,
	state = st.lastState ?? DEFAULTS,
): void {
	up(root, { class: st.caseFlipped ? "case-flipped" : "!case-flipped" });
	st.caseback.update(clockworkProps(root, st, state));
}

// The stage component. Boundary IS `#stage-wrap`. On first render it builds the
// whole interactive subtree into `[State]` — the control leaves + shell (the
// gear/close panel-toggle is pure drawer-local UI, never a state write) AND the
// dial (`AstrolabeView`) + overlay FCCs it owns. Each payload is reference-gated:
// a `{ state }` push fans the controls; a `{ scene }` push fans the dial + overlays.
export const ControlsDrawer = FCC<DrawerProps, DrawerInternals>(
	"astro-controls-drawer",
	() => div({ id: "stage-wrap" }),
	(el, attrs) => {
		const st = el[State] as DrawerInternals;
		if (!st.built) buildShell(st);
		// The controller's per-control `events` collection rides the `events` prop;
		// Jiffies adds inert listeners for those (non-DOM) keys on the boundary and
		// flags data-hydrate — clear it so the shell stays a clean static node.
		up(el, { "data-hydrate": false });

		// --- Controls (state), fanned only when the state object changes ---------
		if (attrs.state && attrs.state !== st.lastState) {
			st.lastState = attrs.state;
			const ev = attrs.events ?? {};
			const s = attrs.state;
			st.earthSeg.update({ value: s.earthMode, events: ev.earthMode });
			st.caseSeg.update({ value: s.sizeMode, events: ev.caseSize });
			st.speedSeg.update({ value: String(s.speedStep), events: ev.speed });
			syncCaseback(el, st, s);
			st.material.update({ value: s.material, events: ev.material });
			st.parallaxOn.update({ checked: s.parallaxOn, events: ev.parallaxOn });
			st.parallax.update({
				value: s.parallax,
				label: s.parallax.toFixed(2),
				events: ev.parallax,
			});
			st.orbits.update({ checked: s.orbits, events: ev.t_orbits });
			st.spokes.update({ checked: s.spokes, events: ev.t_spokes });
			st.occ.update({ checked: s.signInfo, events: ev.t_occ });
			st.twilight.update({ checked: s.twilight, events: ev.t_twilight });
			st.guilloche.update({ checked: s.guilloche, events: ev.t_guilloche });
			st.guillocheN.update({
				value: s.guillocheN,
				label: String(Math.round(s.guillocheN)),
				events: ev.guillocheN,
			});
			st.hands.update({ checked: s.hands, events: ev.t_hands });
			st.moon.update({ checked: s.moon, events: ev.t_moon });
			for (const [i, c] of COLORS.entries()) {
				st.colors[i].update({
					value: effectiveColor(s, c.varName, c.def),
					events: ev[c.varName],
				});
			}
			// Reset is a state op, so its handler rides the controller's events like a
			// leaf (the button lives in the panel, not a fanned control). Gear/close
			// stay drawer-internal UI, wired in buildShell.
			up(st.resetBtn, { events: ev.resetBtn });
		}

		// --- Scene (dial + overlays), fanned only when the frame changes ---------
		if (attrs.scene && attrs.scene !== st.lastScene) {
			st.lastScene = attrs.scene;
			const sc = attrs.scene;
			// The dial owns its own subsystems; pointer maps ride `viewEvents` (wired
			// once inside the dial). The overlays each render from their slice.
			st.dial.update({ scene: sc, viewEvents: attrs.dialEvents });
			st.simClock.update({ id: "simClock", text: sc.simClock });
			st.realClock.update({ id: "realClock", text: sc.realClock });
			st.tip.update({
				shown: sc.tooltip.shown,
				x: sc.tooltip.point.x,
				y: sc.tooltip.point.y,
				text: sc.tooltip.text,
			});
			st.signcard.update({
				shown: sc.signCard.shown,
				sign: sc.signCard.sign,
				occupants: sc.signCard.occupants,
				x: sc.signCard.point.x,
				y: sc.signCard.point.y,
			});
		}

		return [
			st.strap,
			st.caseback,
			st.gear,
			st.panel,
			st.tip,
			st.signcard,
			st.dial,
		];
	},
);

export type ControlsDrawerHandle = ReturnType<typeof ControlsDrawer>;

// The dial `<svg>` the stage component owns. The animation loop holds it only for
// sanctioned layout reads (`getBoundingClientRect`) and dial-root pointer wiring
// (`up(svg, { events })`); content always flows through `root.update({ scene })`.
// Built during the drawer's construction, so it is present by the time the
// bootstrap asks for it.
export function dialSvgOf(drawer: ControlsDrawerHandle): SVGSVGElement {
	return (drawer[State] as DrawerInternals).dial as unknown as SVGSVGElement;
}

// Build the leaf controls + static shell once into `st`, and wire the panel
// toggle (drawer-local UI; the controller is not involved). The leaves' static
// config (id/root/rootClass/items/min/max/step/sink/def) is set here; their
// value + events come from the per-render fan.
function buildShell(panel: DrawerInternals): void {
	const docRoot = window.document.documentElement;
	const sink = rootStyleSink(docRoot);

	// The dial + overlays this component owns and fans the Scene to. Built here,
	// never passed in as handles. Clocks live in the motion block; the dial /
	// tooltip / sign card are the trailing stage children (returned by render).
	panel.dial = AstrolabeView({});
	panel.tip = Tooltip({ shown: false, x: 0, y: 0, text: "" });
	panel.signcard = SignCard({
		shown: false,
		sign: 0,
		occupants: [],
		x: 0,
		y: 0,
	});
	panel.simClock = Clock({ id: "simClock", text: "" });
	panel.realClock = Clock({ id: "realClock", text: "" });
	panel.caseFlipped = false;
	panel.caseback = ClockworkRearFace({
		mode: DEFAULTS.earthMode,
		speed: speedToMul(DEFAULTS.speedStep),
		flipped: false,
	});

	panel.earthSeg = SegmentGroup({
		id: "earthMode",
		items: EARTH_ITEMS,
		value: DEFAULTS.earthMode,
	}) as FCComponent<SegmentProps, object>;
	panel.caseSeg = SegmentGroup({
		id: "caseSize",
		items: CASE_ITEMS,
		value: DEFAULTS.sizeMode,
		root: docRoot,
		rootClass: "full-screen",
		rootClassValue: "full",
	}) as FCComponent<SegmentProps, object>;
	panel.speedSeg = SegmentGroup({
		id: "speed",
		items: SPEED_ITEMS,
		value: String(DEFAULTS.speedStep),
	}) as FCComponent<SegmentProps, object>;
	panel.material = MaterialPicker({
		materials: MATERIALS,
		value: DEFAULTS.material,
	}) as FCComponent<MaterialProps, object>;

	const check = (id: string, checked: boolean, rootClass?: string) =>
		CheckControl({ id, checked, root: docRoot, rootClass }) as FCComponent<
			CheckProps,
			object
		>;
	panel.parallaxOn = check("parallaxOn", DEFAULTS.parallaxOn);
	panel.orbits = check("t_orbits", DEFAULTS.orbits, "hide-orbits");
	panel.spokes = check("t_spokes", DEFAULTS.spokes, "hide-spokes");
	panel.occ = check("t_occ", DEFAULTS.signInfo);
	panel.twilight = check("t_twilight", DEFAULTS.twilight, "hide-twilight");
	panel.guilloche = check("t_guilloche", DEFAULTS.guilloche, "hide-guilloche");
	panel.hands = check("t_hands", DEFAULTS.hands, "hide-hands");
	panel.moon = check("t_moon", DEFAULTS.moon, "hide-moon");

	panel.parallax = RangeControl({
		id: "parallax",
		value: DEFAULTS.parallax,
		label: DEFAULTS.parallax.toFixed(2),
		min: 0,
		max: 1.5,
		step: 0.05,
	}) as FCComponent<RangeProps, RangeState>;
	panel.guillocheN = RangeControl({
		id: "guillocheN",
		value: DEFAULTS.guillocheN,
		label: String(DEFAULTS.guillocheN),
		min: 12,
		max: 360,
		step: 12,
	}) as FCComponent<RangeProps, RangeState>;

	panel.colors = COLORS.map(
		(c) =>
			ColorPicker({
				value: effectiveColor(DEFAULTS, c.varName, c.def),
				varName: c.varName,
				def: c.def,
				sink,
			}) as FCComponent<ColorProps, object>,
	);

	const motion = div(
		{ class: "motion", ariaLabel: "Motion" },
		div(
			{ class: "clock" },
			clockRow("Real:", panel.realClock),
			clockRow("Sim:", panel.simClock),
		),
		field("Earth", panel.earthSeg),
		field("Case", panel.caseSeg),
		field("Speed", panel.speedSeg),
		field("Material", panel.material),
	);
	const resetBtn = button({ id: "resetBtn", class: "btn" }, "Reset");
	const closeBtn = button({ id: "closeBtn", class: "btn" }, "Close");
	panel.panel = div(
		{ id: "controls", ariaLabel: "Controls" },
		motion,
		details(
			{},
			summary({}, "Motion"),
			row("Parallax", panel.parallaxOn),
			row("Parallax strength", panel.parallax),
			button({ id: "motionBtn", class: "btn" }, "Enable device tilt"),
			div(
				{ class: "note" },
				"Desktop uses the cursor for parallax. On phones, tap “Enable device tilt”.",
			),
		),
		details(
			{},
			summary({}, "Display"),
			row("Orbit discs", panel.orbits),
			row("Disc arms", panel.spokes),
			row("Sign info", panel.occ),
			row("Twilight zone", panel.twilight),
			row("Guilloche", panel.guilloche),
			row("Guilloche lines", panel.guillocheN),
			row("Watch hands", panel.hands),
			row("Moon", panel.moon),
		),
		details(
			{},
			summary({}, "Colors"),
			div(
				{ class: "swatches" },
				...COLORS.map((c, i) => colorSwatch(c.label, panel.colors[i])),
			),
		),
		div({ class: "btnrow" }, resetBtn, closeBtn),
	) as HTMLElement;
	panel.gear = button(
		{ id: "gear", ariaLabel: "Toggle controls" },
		"☰",
	) as HTMLElement;
	panel.strap = div(
		{ id: "strap", ariaHidden: "true" },
		div({ class: "strap-band strap-top" }),
		div({ class: "strap-band strap-bottom" }),
	);

	panel.resetBtn = resetBtn as HTMLElement;

	// Panel toggle: drawer-local UI only. `aria-expanded` reaches assistive tech;
	// the gear stays a pancake (no CONTROLS/CLOSE text swap). Reset's click is a
	// STATE op, so its handler is fanned from the controller's `events.resetBtn`
	// (in the render above) — not wired here.
	const setOpen = (open: boolean) => {
		panel.open = open;
		up(panel.panel, { class: open ? "open" : "!open" });
		up(panel.gear, {
			"aria-expanded": String(open),
			class: open ? "open" : "!open",
		});
	};
	up(panel.gear, { events: { click: () => setOpen(!panel.open) } });
	up(closeBtn, { events: { click: () => setOpen(false) } });

	// Default open on wide viewports, closed on narrow; CSS supplies the same
	// first-paint default. matchMedia is guarded — jsdom lacks it, so it boots closed.
	setOpen(window.matchMedia?.("(min-width:768px)")?.matches ?? false);
	up(panel.panel, { class: "ready" });
	panel.built = true;
}

// --- The controller ---------------------------------------------------------

// Best-effort clear of just the v2 persistence key.
function clearState(): void {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// ignore: storage disabled
	}
}

// Read helpers over the event target (the element the user actually touched).
const targetEl = (e: Event) => e.target as HTMLElement;
const dataValue = (e: Event) => targetEl(e).getAttribute("data-value") ?? "";

// The controller: holds the single ControlsState, persists it, pushes it down
// (drawer.update), and exposes toConfig(state) to the loop. It makes ZERO styling
// decisions and never touches :root — styling is the controls' own job. Its
// per-control event handlers read the value off the event target and call
// setState; the handlers ride down to the leaves via `update({ events })`.
export function initControls(drawer: ControlsDrawerHandle): {
	getConfig: () => Config;
} {
	// A fresh object each time state changes, so the drawer's reference-gated fan
	// fires (a scene frame must not re-render the controls, and vice-versa).
	let state = loadState() ?? { ...DEFAULTS };
	let cfg = toConfig(state);

	function setState(patch: Partial<ControlsState>): void {
		// Picking a NEW material re-seeds every material-driven color to that
		// material (the old applyMaterial behavior): drop the explicit overrides,
		// keeping only the independent --strap-leather.
		let next = patch;
		if (patch.material && patch.material !== state.material) {
			const leather = state.colors["--strap-leather"];
			next = {
				...patch,
				colors: leather ? { "--strap-leather": leather } : {},
			};
		}
		state = { ...state, ...next };
		cfg = toConfig(state); // data for the loop (not styling)
		persist(state); // serialize the state object as-is
		drawer.update({ state }); // push down; controls re-render + re-apply effects
	}

	function reset(): void {
		state = { ...DEFAULTS };
		cfg = toConfig(state);
		drawer.update({ state }); // re-applies every control's own effect
		clearState(); // clear LAST: the fan above does not persist
	}

	const setColor = (varName: string) => (e: Event) =>
		setState({
			colors: {
				...state.colors,
				[varName]: (e.target as HTMLInputElement).value,
			},
		});

	const events: Record<string, EventMap> = {
		earthMode: {
			click: (e) =>
				setState({ earthMode: dataValue(e) as ControlsState["earthMode"] }),
		},
		caseSize: {
			click: (e) => {
				setState({ sizeMode: dataValue(e) as ControlsState["sizeMode"] });
				window.dispatchEvent(new Event("resize")); // re-run the bootstrap's dial sizing
			},
		},
		speed: { click: (e) => setState({ speedStep: Number(dataValue(e)) }) },
		material: {
			click: (e) => {
				const id = targetEl(e).getAttribute("data-material");
				if (id) setState({ material: id as MaterialId });
			},
		},
		parallaxOn: {
			change: (e) =>
				setState({ parallaxOn: (e.target as HTMLInputElement).checked }),
		},
		parallax: {
			input: (e) =>
				setState({
					parallax: Number.parseFloat((e.target as HTMLInputElement).value),
				}),
		},
		t_orbits: {
			change: (e) =>
				setState({ orbits: (e.target as HTMLInputElement).checked }),
		},
		t_spokes: {
			change: (e) =>
				setState({ spokes: (e.target as HTMLInputElement).checked }),
		},
		t_occ: {
			change: (e) =>
				setState({ signInfo: (e.target as HTMLInputElement).checked }),
		},
		t_twilight: {
			change: (e) =>
				setState({ twilight: (e.target as HTMLInputElement).checked }),
		},
		t_guilloche: {
			change: (e) =>
				setState({ guilloche: (e.target as HTMLInputElement).checked }),
		},
		guillocheN: {
			input: (e) =>
				setState({
					guillocheN: Math.round(
						Number.parseFloat((e.target as HTMLInputElement).value),
					),
				}),
		},
		t_hands: {
			change: (e) =>
				setState({ hands: (e.target as HTMLInputElement).checked }),
		},
		t_moon: {
			change: (e) => setState({ moon: (e.target as HTMLInputElement).checked }),
		},
		resetBtn: { click: () => reset() },
	};
	for (const c of COLORS) events[c.varName] = { input: setColor(c.varName) };

	drawer.update({ state, events });
	return { getConfig: () => cfg };
}
