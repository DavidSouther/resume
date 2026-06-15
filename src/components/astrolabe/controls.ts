import {
	type MaterialId,
	materialVars,
} from "../../lib/astrolabe/materials.ts";
import { handsHidden, speedToMul } from "../../lib/astrolabe/math.ts";
import type { Config } from "../../lib/astrolabe/types.ts";

const DEFAULT_MATERIAL: MaterialId = "platinum";

export function initControls(): { getConfig: () => Config } {
	let cfg: Config = {
		speed: 1,
		sizeMode: "full",
		earthFixed: true,
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

	function togglePanel(open?: boolean) {
		const o = open ?? !panel.classList.contains("open");
		panel.classList.toggle("open", o);
		gear.textContent = o ? "CLOSE" : "CONTROLS";
	}
	gear.addEventListener("click", () => togglePanel());
	document
		.getElementById("closeBtn")
		?.addEventListener("click", () => togglePanel(false));

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
		cfg = { ...cfg, earthFixed: v === "fixed" };
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
	// Material swatches live in the always-on panel, not the slide-out #controls.
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
	applyMaterial(DEFAULT_MATERIAL);

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
		earthGroup.set("fixed");
		caseGroup.set("full");
	});

	return { getConfig: () => ({ ...cfg }) };
}
