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

// Namespaced + versioned localStorage key for the controls-drawer snapshot.
const STORAGE_KEY = "astrolabe.controls.v1";

// The persisted shape: per-control DOM state addressed by DOM handle. No
// simulation fields (simT/bootMs/caseOffset/seeds) ever appear here.
interface ControlSnapshot {
	inputs: Record<string, string | boolean>; // element id -> value | checked
	groups: Record<string, string>; // group id -> dataset.value
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

	function updateHands() {
		document.documentElement.classList.toggle(
			"hide-hands",
			handsHidden(cfg.hands),
		);
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
	// seeding). Per-control: skip any id absent from this DOM version.
	function applySnapshot(snap: ControlSnapshot) {
		for (const [id, v] of Object.entries(snap.inputs)) {
			const el = document.getElementById(id) as HTMLInputElement | null;
			if (!el) continue;
			if (el.type === "checkbox") el.checked = Boolean(v);
			else el.value = String(v);
		}
		for (const [id, v] of Object.entries(snap.groups)) {
			const grp = document.getElementById(id);
			if (grp) grp.dataset.value = v;
		}
	}
	if (restored) applySnapshot(restored);

	// Read the live drawer state into a snapshot. Reads only named control handles
	// (inputs by id, groups by dataset.value, the active material swatch, color
	// pickers by data-var), so simulation state is excluded by construction.
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
			if (grp.dataset.value !== undefined) groups[grp.id] = grp.dataset.value;
		}
		const active = panel.querySelector<HTMLButtonElement>(
			"button.material-swatch.active",
		);
		const material = active?.dataset.material ?? DEFAULT_MATERIAL;
		const colors: Record<string, string> = {};
		for (const inp of panel.querySelectorAll<HTMLInputElement>(
			"input[type=color][data-var]",
		)) {
			if (inp.dataset.var) colors[inp.dataset.var] = inp.value;
		}
		return { inputs, groups, material, colors };
	}

	// Write-on-change persistence writer.
	function persist() {
		writeSnapshot(captureSnapshot());
	}

	function togglePanel(open?: boolean) {
		const o = open ?? !panel.classList.contains("open");
		panel.classList.toggle("open", o);
		// The pancake stays a pancake: reflect open state to assistive tech and via
		// an active class, never a CONTROLS/CLOSE text swap.
		gear.setAttribute("aria-expanded", String(o));
		gear.classList.toggle("open", o);
	}
	gear.addEventListener("click", () => togglePanel());
	document
		.getElementById("closeBtn")
		?.addEventListener("click", () => togglePanel(false));
	// Default open on wide viewports, closed on narrow. The CSS supplies the same
	// default for first paint (the `:not(.ready)` media rule); setting `.open`
	// here makes that class the single source of truth so the toggle closes
	// correctly at every width. matchMedia is guarded — jsdom does not implement
	// it, so the test boots closed.
	togglePanel(window.matchMedia?.("(min-width:768px)")?.matches ?? false);
	panel.classList.add("ready");

	// Range slider helper
	function bindRange(
		id: string,
		valId: string | null,
		fmt: (v: number) => string,
		apply: (v: number) => void,
	): HTMLInputElement {
		const inp = document.getElementById(id) as HTMLInputElement;
		const out = valId ? document.getElementById(valId) : null;
		function upd() {
			const v = parseFloat(inp.value);
			if (out) out.innerHTML = fmt(v);
			apply(v);
		}
		inp.addEventListener("input", upd);
		upd();
		return inp;
	}

	// Checkbox helper
	function bindCheck(
		id: string,
		apply: (v: boolean) => void,
	): HTMLInputElement {
		const inp = document.getElementById(id) as HTMLInputElement;
		function upd() {
			apply(inp.checked);
		}
		inp.addEventListener("change", upd);
		upd();
		return inp;
	}

	function setChk(id: string, v: boolean) {
		const c = document.getElementById(id) as HTMLInputElement;
		c.checked = v;
		c.dispatchEvent(new Event("change"));
	}

	// Segmented single-choice control. Marks the chosen button active, reflects
	// the value on the group's dataset (so non-DOM readers can see it), and runs
	// `apply`. Applies the markup's initial value once on bind.
	function bindGroup(
		id: string,
		apply: (value: string) => void,
	): { set: (value: string) => void } {
		const grp = document.getElementById(id) as HTMLElement;
		const btns = Array.from(
			grp.querySelectorAll<HTMLButtonElement>("button[data-value]"),
		);
		function set(value: string) {
			grp.dataset.value = value;
			for (const b of btns) {
				b.classList.toggle("active", b.dataset.value === value);
			}
			apply(value);
		}
		for (const b of btns) {
			const v = b.dataset.value ?? "";
			b.addEventListener("click", () => set(v));
		}
		set(grp.dataset.value ?? btns[0]?.dataset.value ?? "");
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
	bindCheck("t_orbits", (v) =>
		document.documentElement.classList.toggle("hide-orbits", !v),
	);
	bindCheck("t_spokes", (v) =>
		document.documentElement.classList.toggle("hide-spokes", !v),
	);
	bindCheck("t_occ", (v) => {
		cfg = { ...cfg, occ: v };
	});
	bindCheck("t_twilight", (v) => {
		cfg = { ...cfg, twilight: v };
		document.documentElement.classList.toggle("hide-twilight", !v);
	});
	bindCheck("t_hands", (v) => {
		cfg = { ...cfg, hands: v };
		updateHands();
	});
	bindCheck("t_moon", (v) =>
		document.documentElement.classList.toggle("hide-moon", !v),
	);
	bindCheck("t_guilloche", (v) => {
		cfg = { ...cfg, guilloche: v };
		document.documentElement.classList.toggle("hide-guilloche", !v);
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
		document.documentElement.classList.toggle("full-screen", v === "full");
		window.dispatchEvent(new Event("resize"));
	});

	// Reflect the parallax default into the checkbox
	(document.getElementById("parallaxOn") as HTMLInputElement).checked =
		cfg.parallaxOn;

	// Color pickers
	const colorInputs =
		panel.querySelectorAll<HTMLInputElement>("input[type=color]");
	for (const inp of colorInputs) {
		if (inp.dataset.var) {
			document.documentElement.style.setProperty(inp.dataset.var, inp.value);
		}
		inp.addEventListener("input", () => {
			if (inp.dataset.var)
				document.documentElement.style.setProperty(inp.dataset.var, inp.value);
		});
	}

	// Case materials. Picking a material applies its coordinated variable map to
	// the root and seeds the matching color pickers (which stay as an advanced
	// override), then marks the active button.
	// Material swatches now live in the motion block at the top of the one drawer.
	const matBtns = document.querySelectorAll<HTMLButtonElement>(
		"button.material-swatch",
	);
	function applyMaterial(id: MaterialId) {
		for (const [k, v] of Object.entries(materialVars(id))) {
			document.documentElement.style.setProperty(k, v);
			const picker = panel.querySelector<HTMLInputElement>(
				`input[type=color][data-var="${k}"]`,
			);
			if (picker) {
				picker.value = v;
				picker.dispatchEvent(new Event("input"));
			}
		}
		for (const b of matBtns) {
			b.classList.toggle("active", b.dataset.material === id);
		}
	}
	for (const b of matBtns) {
		b.addEventListener("click", () =>
			applyMaterial(b.dataset.material as MaterialId),
		);
	}

	// Seed the material: the restored one if a snapshot exists and names a known
	// swatch, otherwise the default. applyMaterial re-seeds the material-driven
	// color pickers, so any persisted per-picker overrides (e.g. --ground, the
	// independent --strap-leather) must be layered AFTER, matching the existing
	// "advanced override" behavior.
	const restoredMaterial = restored?.material;
	const hasSwatch = Array.from(matBtns).some(
		(b) => b.dataset.material === restoredMaterial,
	);
	applyMaterial(
		hasSwatch ? (restoredMaterial as MaterialId) : DEFAULT_MATERIAL,
	);
	if (restored?.colors) {
		for (const inp of colorInputs) {
			const varName = inp.dataset.var;
			if (varName && varName in restored.colors) {
				inp.value = restored.colors[varName];
				document.documentElement.style.setProperty(varName, inp.value);
			}
		}
	}

	// Persistence: write the current snapshot on every control change. Listeners
	// attach directly to each control rather than relying on event delegation,
	// because the synthetic input/change events controls dispatch (here and in
	// tests) do not bubble. Color/material changes flow through the color picker
	// inputs; group choices flow through their buttons. No simulation state is
	// ever read by captureSnapshot, so the snapshot stays controls-only.
	for (const inp of panel.querySelectorAll<HTMLInputElement>("input[id]")) {
		inp.addEventListener("input", persist);
		inp.addEventListener("change", persist);
	}
	for (const inp of colorInputs) {
		inp.addEventListener("input", persist);
	}
	// Same generic selector captureSnapshot uses, so a future fourth group is
	// both captured and write-triggered without touching a second hardcoded list.
	for (const grp of panel.querySelectorAll<HTMLElement>(".btn-group[id]")) {
		for (const b of grp.querySelectorAll<HTMLButtonElement>(
			"button[data-value]",
		)) {
			b.addEventListener("click", persist);
		}
	}
	for (const b of matBtns) {
		b.addEventListener("click", persist);
	}

	// Reset button
	document.getElementById("resetBtn")?.addEventListener("click", () => {
		// Restore the default material (which re-seeds every material-driven
		// picker), then reset the independent leather picker.
		applyMaterial(DEFAULT_MATERIAL);
		for (const inp of colorInputs) {
			if (inp.dataset.var === "--strap-leather" && inp.dataset.def) {
				inp.value = inp.dataset.def;
				document.documentElement.style.setProperty(
					"--strap-leather",
					inp.dataset.def,
				);
			}
		}
		speedGroup.set("0");
		cPx.value = "0.7";
		cPx.dispatchEvent(new Event("input"));
		setChk("t_orbits", true);
		setChk("t_spokes", false);
		setChk("t_occ", true);
		setChk("t_twilight", true);
		setChk("t_guilloche", true);
		setChk("t_hands", true);
		setChk("t_moon", true);
		cGuilN.value = "120";
		cGuilN.dispatchEvent(new Event("input"));
		setChk("parallaxOn", false);
		earthGroup.set("galilean");
		caseGroup.set("full");
		// Clear last: the default-applying dispatches above synchronously
		// re-trigger the persistence writer, so removing the key here leaves
		// storage truly empty after a Reset.
		clearSnapshot();
	});

	return { getConfig: () => ({ ...cfg }) };
}
