// The Astrolabe controls drawer. Every form construction, value binding,
// listener, and class/style/dataset write flows through Jiffies builders +
// `events:`/`class`/`style` attrs (via `setAttrs()` / element `.update()`), never a raw
// DOM mutation call. `localStorage` persistence (read/write/clear/capture) stays —
// it is not a DOM mutation. See
// .ailly/developer/2026-06-23-A-astrolabe-fcc-refactor/design.md.
import { type DenormAttrs, up } from "@davidsouther/jiffies/dom/dom.ts";
import {
	type MaterialId,
	materialVars,
} from "../../lib/astrolabe/materials.ts";
import { handsHidden, speedToMul } from "../../lib/astrolabe/math.ts";
import {
	type Config,
	type EarthMode,
	GALILEAN,
	KEPLERIAN,
	PTOLEMAIC,
} from "../../lib/astrolabe/types.ts";

// Map the earthMode segmented control's string data-value to the EarthMode enum.
const EARTH_MODE_BY_VALUE: Record<string, EarthMode> = {
	ptolemaic: PTOLEMAIC,
	galilean: GALILEAN,
	keplerian: KEPLERIAN,
};

const DEFAULT_MATERIAL: MaterialId = "platinum";

// Loose attr payload for the Jiffies `setAttrs()` write path. The HTML builder/element
// `Attrs` type only names an element's own properties (plus class/style/events/
// role), so `data-*`/`for`/`aria-*` attribute keys — all valid SVG/HTML
// attributes the engine writes verbatim — need a wider payload type. Every value
// here flows through `setAttrs()` (a Jiffies write), never a raw setAttribute.
type Attr = Record<string, unknown>;
function setAttrs(
	el: Element,
	attrs: Attr,
	...children: (Node | string)[]
): void {
	up(el as Omit<Element, "update">, attrs as DenormAttrs<Element>, ...children);
}

// Namespaced + versioned localStorage key for the controls-drawer snapshot.
const STORAGE_KEY = "astrolabe.controls.v1";

// The persisted shape: per-control DOM state addressed by DOM handle. No
// simulation fields (simT/bootMs/caseOffset/seeds) ever appear here.
interface ControlSnapshot {
	inputs: Record<string, string | boolean>; // element id -> value | checked
	groups: Record<string, string>; // group id -> data-value
	material: string; // selected material id
	colors: Record<string, string>; // data-var -> picker value
}

// Keep only the string-valued entries of an unknown blob. A non-object (or a
// nested non-string value from a tampered/stale store) yields an empty map.
function parseStringMap(v: unknown): Record<string, string> {
	const out: Record<string, string> = {};
	if (typeof v === "object" && v !== null) {
		for (const [k, val] of Object.entries(v)) {
			if (typeof val === "string") out[k] = val;
		}
	}
	return out;
}

// Parse an unknown blob into a known-good ControlSnapshot, dropping any field or
// entry that does not match the declared shape. The returned value is a real
// proof of its type — every map is an object, every value the right primitive —
// so the restore paths below need no further shape guards. Returns null only
// when the top level is not an object.
function parseSnapshot(raw: unknown): ControlSnapshot | null {
	if (typeof raw !== "object" || raw === null) return null;
	const o = raw as Record<string, unknown>;
	const inputs: Record<string, string | boolean> = {};
	if (typeof o.inputs === "object" && o.inputs !== null) {
		for (const [k, val] of Object.entries(o.inputs)) {
			if (typeof val === "string" || typeof val === "boolean") inputs[k] = val;
		}
	}
	return {
		inputs,
		groups: parseStringMap(o.groups),
		material: typeof o.material === "string" ? o.material : DEFAULT_MATERIAL,
		colors: parseStringMap(o.colors),
	};
}

// Best-effort read, then parse (not cast) at the storage boundary. A
// missing/unparseable/throwing access -> null (fall back to markup defaults);
// a present blob is normalized to a valid snapshot by parseSnapshot.
function readSnapshot(): ControlSnapshot | null {
	try {
		const raw = localStorage.getItem(STORAGE_KEY);
		if (!raw) return null;
		return parseSnapshot(JSON.parse(raw));
	} catch {
		return null;
	}
}

// Best-effort write. A disabled or full store is swallowed.
function writeSnapshot(snap: ControlSnapshot): void {
	try {
		localStorage.setItem(STORAGE_KEY, JSON.stringify(snap));
	} catch {
		// ignore: storage disabled or over quota
	}
}

// Best-effort clear of just the persistence key.
function clearSnapshot(): void {
	try {
		localStorage.removeItem(STORAGE_KEY);
	} catch {
		// ignore: storage disabled
	}
}

export function initControls(): { getConfig: () => Config } {
	let cfg: Config = {
		speed: 1,
		sizeMode: "full",
		earthMode: GALILEAN,
		parallaxOn: false,
		parallax: 0.7,
		occ: true,
		twilight: true,
		guilloche: true,
		guillocheN: 120,
		hands: true,
	};

	const docRoot = document.documentElement;

	// --- Root-scoped class + CSS-var application (via Jiffies, never raw style) ---
	// `setAttrs(root, { class })` adds/removes only the named class, leaving every other
	// class (and the document's own) untouched — the incremental classList.toggle
	// replacement. Custom-property writes must go through a cssText string (the
	// object-style path cannot set `--*`), so the owned vars are tracked here and
	// the full cssText is rebuilt on each change. `--dial-px` (owned by client.ts'
	// host sizing) is read fresh via getComputedStyle and re-emitted so the
	// cssText replace never drops it.
	const rootVars = new Map<string, string>();
	function applyRootClass(name: string, on: boolean) {
		setAttrs(docRoot, { class: on ? name : `!${name}` });
	}
	// Write the full owned-var cssText to the root in ONE pass. cssText replaces
	// all inline style, so `--dial-px` (owned by client.ts' host sizing) is read
	// fresh and re-emitted. Callers that change many vars at once (applyMaterial)
	// mutate `rootVars` then flush once, rather than flushing per var — a per-var
	// flush forces a getComputedStyle reflow + full-document restyle each time,
	// which is what made material switching slow.
	function flushRootVars() {
		const dialPx = getComputedStyle(docRoot).getPropertyValue("--dial-px");
		const parts: string[] = [];
		if (dialPx?.trim()) parts.push(`--dial-px:${dialPx.trim()}`);
		for (const [k, v] of rootVars) parts.push(`${k}:${v}`);
		setAttrs(docRoot, { style: parts.join(";") });
	}
	function applyRootVar(name: string, value: string) {
		rootVars.set(name, value);
		flushRootVars();
	}

	function updateHands() {
		applyRootClass("hide-hands", handsHidden(cfg.hands));
	}

	// Panel open/close
	const gear = document.getElementById("gear") as HTMLButtonElement;
	const panel = document.getElementById("controls") as HTMLDivElement;

	// Persistence: restore the saved drawer snapshot onto the DOM controls BEFORE
	// the bind/apply pass below replays initial values, so binds observe the
	// restored DOM rather than the markup defaults. A null snapshot (first visit,
	// disabled storage, or unparseable blob) leaves markup defaults in place.
	const restored = readSnapshot();

	// Write each persisted input/group/color value back onto its DOM control.
	// Material is handled separately at applyMaterial (it has its own var/picker
	// seeding). Per-control: skip any id absent from this DOM version. Input
	// value/checked are element-state properties (not setAttribute/class/style),
	// so direct assignment is permitted; the group data-value goes through `up`.
	function applySnapshot(snap: ControlSnapshot) {
		for (const [id, v] of Object.entries(snap.inputs)) {
			const el = document.getElementById(id) as HTMLInputElement | null;
			if (!el) continue;
			if (el.type === "checkbox") el.checked = Boolean(v);
			else el.value = String(v);
		}
		for (const [id, v] of Object.entries(snap.groups)) {
			const grp = document.getElementById(id);
			if (grp) setAttrs(grp, { "data-value": v });
		}
	}
	if (restored) applySnapshot(restored);

	// Read the live drawer state into a snapshot. Reads only named control handles
	// (inputs by id, groups by data-value, the active material swatch, color
	// pickers by data-var), so simulation state is excluded by construction.
	// Dataset reads move to getAttribute (a permitted read; only set/remove/toggle
	// attribute are forbidden, and the guard's /\.dataset\./ trips on reads too).
	function captureSnapshot(): ControlSnapshot {
		const inputs: Record<string, string | boolean> = {};
		for (const inp of panel.querySelectorAll<HTMLInputElement>(
			"input[id]:not([type=color])",
		)) {
			if (inp.type === "checkbox") inputs[inp.id] = inp.checked;
			else inputs[inp.id] = inp.value;
		}
		const groups: Record<string, string> = {};
		for (const grp of panel.querySelectorAll<HTMLElement>(".btn-group[id]")) {
			const v = grp.getAttribute("data-value");
			if (v !== null) groups[grp.id] = v;
		}
		const active = panel.querySelector<HTMLButtonElement>(
			"button.material-swatch.active",
		);
		const material = active?.getAttribute("data-material") ?? DEFAULT_MATERIAL;
		const colors: Record<string, string> = {};
		for (const inp of panel.querySelectorAll<HTMLInputElement>(
			"input[type=color][data-var]",
		)) {
			const varName = inp.getAttribute("data-var");
			if (varName) colors[varName] = inp.value;
		}
		return { inputs, groups, material, colors };
	}

	// Write-on-change persistence writer.
	function persist() {
		writeSnapshot(captureSnapshot());
	}

	// `aria-expanded` reflects the open state; the pancake stays a pancake — open
	// state reaches assistive tech and an `open` class, never a CONTROLS/CLOSE text
	// swap. Class reads use classList? No — open state is the single source of
	// truth tracked here.
	let panelOpen = false;
	function togglePanel(open?: boolean) {
		const o = open ?? !panelOpen;
		panelOpen = o;
		setAttrs(panel, { class: o ? "open" : "!open" });
		setAttrs(gear, { "aria-expanded": String(o), class: o ? "open" : "!open" });
	}
	setAttrs(gear, { events: { click: () => togglePanel() } });
	const closeBtn = document.getElementById("closeBtn");
	if (closeBtn)
		setAttrs(closeBtn, { events: { click: () => togglePanel(false) } });
	// Default open on wide viewports, closed on narrow. The CSS supplies the same
	// default for first paint (the `:not(.ready)` media rule); setting `.open`
	// here makes that class the single source of truth so the toggle closes
	// correctly at every width. matchMedia is guarded — jsdom does not implement
	// it, so the test boots closed.
	togglePanel(window.matchMedia?.("(min-width:768px)")?.matches ?? false);
	setAttrs(panel, { class: "ready" });

	// Range slider helper. The output text updates via a text-node child (`update`
	// reconcile), and the `input` listener via an `events:` attr.
	function bindRange(
		id: string,
		valId: string | null,
		fmt: (v: number) => string,
		apply: (v: number) => void,
	): HTMLInputElement {
		const inp = document.getElementById(id) as HTMLInputElement;
		const out = valId ? document.getElementById(valId) : null;
		function upd(persistOnChange: boolean) {
			const v = parseFloat(inp.value);
			if (out) setAttrs(out, {}, fmt(v));
			apply(v);
			if (persistOnChange) persist();
		}
		// Apply AND persist in the one input handler. A separate persist listener
		// would replace this one — Jiffies keeps a single handler per event type.
		setAttrs(inp, { events: { input: () => upd(true) } });
		upd(false);
		return inp;
	}

	// Checkbox helper.
	function bindCheck(
		id: string,
		apply: (v: boolean) => void,
	): HTMLInputElement {
		const inp = document.getElementById(id) as HTMLInputElement;
		// Apply AND persist in the one change handler (see bindRange).
		setAttrs(inp, {
			events: {
				change: () => {
					apply(inp.checked);
					persist();
				},
			},
		});
		apply(inp.checked);
		return inp;
	}

	// Set a checkbox to a value and run its bound apply directly (no synthetic
	// DOM event round-trip). `.checked` is an element-state property, not an
	// attribute/class/style write, so direct assignment is permitted.
	function setChk(id: string, v: boolean, apply: (v: boolean) => void) {
		const c = document.getElementById(id) as HTMLInputElement;
		c.checked = v;
		apply(v);
		persist();
	}

	// Segmented single-choice control. Marks the chosen button active, reflects
	// the value on the group's data-value (so non-DOM readers can see it), and
	// runs `apply`. Applies the markup's initial value once on bind.
	function bindGroup(
		id: string,
		apply: (value: string) => void,
	): { set: (value: string) => void } {
		const grp = document.getElementById(id) as HTMLElement;
		const btns = Array.from(
			grp.querySelectorAll<HTMLButtonElement>("button[data-value]"),
		);
		function set(value: string) {
			setAttrs(grp, { "data-value": value });
			for (const b of btns) {
				const on = b.getAttribute("data-value") === value;
				setAttrs(b, { class: on ? "active" : "!active" });
			}
			apply(value);
		}
		for (const b of btns) {
			const v = b.getAttribute("data-value") ?? "";
			setAttrs(b, {
				events: {
					click: () => {
						set(v);
						persist();
					},
				},
			});
		}
		set(
			grp.getAttribute("data-value") ??
				btns[0]?.getAttribute("data-value") ??
				"",
		);
		return { set };
	}

	const cPx = bindRange(
		"parallax",
		"parallaxVal",
		(v) => v.toFixed(2),
		(v) => {
			cfg = { ...cfg, parallax: v };
		},
	);
	bindCheck("parallaxOn", (v) => {
		cfg = { ...cfg, parallaxOn: v };
	});
	bindCheck("t_orbits", (v) => applyRootClass("hide-orbits", !v));
	bindCheck("t_spokes", (v) => applyRootClass("hide-spokes", !v));
	bindCheck("t_occ", (v) => {
		cfg = { ...cfg, occ: v };
	});
	bindCheck("t_twilight", (v) => {
		cfg = { ...cfg, twilight: v };
		applyRootClass("hide-twilight", !v);
	});
	bindCheck("t_hands", (v) => {
		cfg = { ...cfg, hands: v };
		updateHands();
	});
	bindCheck("t_moon", (v) => applyRootClass("hide-moon", !v));
	bindCheck("t_guilloche", (v) => {
		cfg = { ...cfg, guilloche: v };
		applyRootClass("hide-guilloche", !v);
	});
	const cGuilN = bindRange(
		"guillocheN",
		"guillocheNVal",
		(v) => String(Math.round(v)),
		(v) => {
			cfg = { ...cfg, guillocheN: Math.round(v) };
		},
	);

	// Animation speed — segmented index into SPEED_STEPS.
	const speedGroup = bindGroup("speed", (v) => {
		cfg = { ...cfg, speed: speedToMul(Number(v)) };
		updateHands();
	});

	// Earth frame.
	const earthGroup = bindGroup("earthMode", (v) => {
		cfg = { ...cfg, earthMode: EARTH_MODE_BY_VALUE[v] ?? GALILEAN };
	});

	// Case size — re-run the dial sizing (which reads the group's value) on
	// change. The strap mock only reads as a watch at the millimeter case sizes,
	// so hide it when the dial fills the screen.
	const caseGroup = bindGroup("caseSize", (v) => {
		cfg = { ...cfg, sizeMode: v as Config["sizeMode"] };
		applyRootClass("full-screen", v === "full");
		window.dispatchEvent(new Event("resize"));
	});

	// Reflect the parallax default into the checkbox (element-state property).
	(document.getElementById("parallaxOn") as HTMLInputElement).checked =
		cfg.parallaxOn;

	// Color pickers. Each picker drives its CSS var on the root; the picker value
	// itself is read off the live element (`.value`, a permitted property read).
	const colorInputs =
		panel.querySelectorAll<HTMLInputElement>("input[type=color]");
	function applyColor(inp: HTMLInputElement) {
		const varName = inp.getAttribute("data-var");
		if (varName) applyRootVar(varName, inp.value);
	}
	for (const inp of colorInputs) {
		applyColor(inp);
		// Apply AND persist in the one input handler (a separate persist listener
		// would replace this one — Jiffies keeps a single handler per event type).
		setAttrs(inp, {
			events: {
				input: () => {
					applyColor(inp);
					persist();
				},
			},
		});
	}

	// Case materials. Picking a material applies its coordinated variable map to
	// the root and seeds the matching color pickers (which stay as an advanced
	// override), then marks the active button.
	const matBtns = document.querySelectorAll<HTMLButtonElement>(
		"button.material-swatch",
	);
	function applyMaterial(id: MaterialId) {
		// Stage every material var into the map, seed the matching pickers, then
		// flush the root cssText ONCE — not once per var.
		for (const [k, v] of Object.entries(materialVars(id))) {
			rootVars.set(k, v);
			const picker = panel.querySelector<HTMLInputElement>(
				`input[type=color][data-var="${k}"]`,
			);
			if (picker) picker.value = v;
		}
		flushRootVars();
		for (const b of matBtns) {
			const on = b.getAttribute("data-material") === id;
			setAttrs(b, { class: on ? "active" : "!active" });
		}
	}
	for (const b of matBtns) {
		setAttrs(b, {
			events: {
				click: () => {
					applyMaterial(b.getAttribute("data-material") as MaterialId);
					persist();
				},
			},
		});
	}

	// Seed the material: the restored one if a snapshot exists and names a known
	// swatch, otherwise the default. applyMaterial re-seeds the material-driven
	// color pickers, so any persisted per-picker overrides (e.g. --ground, the
	// independent --strap-leather) must be layered AFTER, matching the existing
	// "advanced override" behavior.
	const restoredMaterial = restored?.material;
	const hasSwatch = Array.from(matBtns).some(
		(b) => b.getAttribute("data-material") === restoredMaterial,
	);
	applyMaterial(
		hasSwatch ? (restoredMaterial as MaterialId) : DEFAULT_MATERIAL,
	);
	if (restored?.colors) {
		for (const inp of colorInputs) {
			const varName = inp.getAttribute("data-var");
			if (varName && varName in restored.colors) {
				inp.value = restored.colors[varName];
				applyRootVar(varName, inp.value);
			}
		}
	}

	// Persistence is wired INTO each control's own apply handler (bindRange,
	// bindCheck, the color-input loop, bindGroup, and the material buttons) so the
	// write happens in the same listener as the apply. A separate persist listener
	// per control is NOT used: Jiffies keeps a single handler per event type, so a
	// second `input`/`change` registration would silently replace the apply one.

	// Reset button.
	const resetBtn = document.getElementById("resetBtn");
	if (resetBtn) {
		setAttrs(resetBtn, {
			events: {
				click: () => {
					// Restore the default material (which re-seeds every material-driven
					// picker), then reset the independent leather picker.
					applyMaterial(DEFAULT_MATERIAL);
					for (const inp of colorInputs) {
						if (
							inp.getAttribute("data-var") === "--strap-leather" &&
							inp.getAttribute("data-def")
						) {
							inp.value = inp.getAttribute("data-def") as string;
							applyRootVar("--strap-leather", inp.value);
						}
					}
					speedGroup.set("0");
					cPx.value = "0.7";
					cfg = { ...cfg, parallax: 0.7 };
					setAttrs(
						document.getElementById("parallaxVal") as HTMLElement,
						{},
						"0.70",
					);
					setChk("t_orbits", true, (v) => applyRootClass("hide-orbits", !v));
					setChk("t_spokes", false, (v) => applyRootClass("hide-spokes", !v));
					setChk("t_occ", true, (v) => {
						cfg = { ...cfg, occ: v };
					});
					setChk("t_twilight", true, (v) => {
						cfg = { ...cfg, twilight: v };
						applyRootClass("hide-twilight", !v);
					});
					setChk("t_guilloche", true, (v) => {
						cfg = { ...cfg, guilloche: v };
						applyRootClass("hide-guilloche", !v);
					});
					setChk("t_hands", true, (v) => {
						cfg = { ...cfg, hands: v };
						updateHands();
					});
					setChk("t_moon", true, (v) => applyRootClass("hide-moon", !v));
					cGuilN.value = "120";
					cfg = { ...cfg, guillocheN: 120 };
					setAttrs(
						document.getElementById("guillocheNVal") as HTMLElement,
						{},
						"120",
					);
					setChk("parallaxOn", false, (v) => {
						cfg = { ...cfg, parallaxOn: v };
					});
					earthGroup.set("galilean");
					caseGroup.set("full");
					// Clear last: the default-applying paths above synchronously
					// re-trigger the persistence writer, so removing the key here leaves
					// storage truly empty after a Reset.
					clearSnapshot();
				},
			},
		});
	}

	return { getConfig: () => ({ ...cfg }) };
}
