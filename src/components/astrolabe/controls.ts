import { HANDS_MAX } from "../../lib/astrolabe/bodies.ts";
import { speedLabel, speedToMul } from "../../lib/astrolabe/math.ts";
import type { Config } from "../../lib/astrolabe/types.ts";

export function initControls(): { getConfig: () => Config } {
	const root = document.documentElement;
	const reduce =
		window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

	let cfg: Config = {
		speed: 1,
		earthFixed: true,
		parallaxOn: !reduce,
		parallax: 0.7,
		glow: true,
		occ: true,
		twilight: true,
		conj: true,
		conjDeg: 3,
		conjCurved: true,
		guilloche: true,
		guillocheN: 120,
		hands: true,
		bgMode: "flat",
	};

	function setHide(cls: string, on: boolean) {
		root.classList.toggle(cls, !on);
	}

	function updateHands() {
		setHide("hide-hands", cfg.hands && cfg.speed <= HANDS_MAX);
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

	const cSpeed = bindRange(
		"speed",
		"speedVal",
		(v) => speedLabel(speedToMul(v)),
		(v) => {
			cfg = { ...cfg, speed: speedToMul(v) };
			updateHands();
		},
	);
	const cPx = bindRange(
		"parallax",
		"parallaxVal",
		(v) => v.toFixed(2),
		(v) => {
			cfg = { ...cfg, parallax: v };
		},
	);
	const cConjD = bindRange(
		"conjDeg",
		"conjDegVal",
		(v) => `${v}&deg;`,
		(v) => {
			cfg = { ...cfg, conjDeg: v };
		},
	);
	bindCheck("parallaxOn", (v) => {
		cfg = { ...cfg, parallaxOn: v };
	});
	bindCheck("t_orbits", (v) => setHide("hide-orbits", v));
	bindCheck("t_spokes", (v) => setHide("hide-spokes", v));
	bindCheck("t_zlabels", (v) => setHide("hide-zlabels", v));
	bindCheck("t_dividers", (v) => setHide("hide-dividers", v));
	bindCheck("t_glow", (v) => {
		cfg = { ...cfg, glow: v };
	});
	bindCheck("t_occ", (v) => {
		cfg = { ...cfg, occ: v };
	});
	bindCheck("t_twilight", (v) => {
		cfg = { ...cfg, twilight: v };
		setHide("hide-twilight", v);
	});
	bindCheck("t_conj", (v) => {
		cfg = { ...cfg, conj: v };
		setHide("hide-conj", v);
	});
	bindCheck("t_hands", (v) => {
		cfg = { ...cfg, hands: v };
		updateHands();
	});
	bindCheck("t_moon", (v) => setHide("hide-moon", v));
	bindCheck("t_conj_curved", (v) => {
		cfg = { ...cfg, conjCurved: v };
	});
	bindCheck("t_guilloche", (v) => {
		cfg = { ...cfg, guilloche: v };
		setHide("hide-guilloche", v);
	});
	const cGuilN = bindRange(
		"guillocheN",
		"guillocheNVal",
		(v) => String(Math.round(v)),
		(v) => {
			cfg = { ...cfg, guillocheN: Math.round(v) };
		},
	);

	// Dial finish
	const bgSel = document.getElementById("bgMode") as HTMLSelectElement;
	function applyBg() {
		root.classList.remove("bg-flat", "bg-textured", "bg-sparkle");
		root.classList.add(`bg-${bgSel.value}`);
		cfg = { ...cfg, bgMode: bgSel.value as Config["bgMode"] };
	}
	bgSel.addEventListener("change", applyBg);
	applyBg();

	// Earth frame
	const earthSel = document.getElementById("earthMode") as HTMLSelectElement;
	function applyEarth() {
		cfg = { ...cfg, earthFixed: earthSel.value === "fixed" };
	}
	earthSel.addEventListener("change", applyEarth);
	applyEarth();

	// Reflect reduced-motion into checkbox
	(document.getElementById("parallaxOn") as HTMLInputElement).checked =
		cfg.parallaxOn;

	// Color pickers
	const colorInputs =
		panel.querySelectorAll<HTMLInputElement>("input[type=color]");
	for (const inp of colorInputs) {
		if (inp.dataset.var) {
			root.style.setProperty(inp.dataset.var, inp.value);
		}
		inp.addEventListener("input", () => {
			if (inp.dataset.var) root.style.setProperty(inp.dataset.var, inp.value);
		});
	}

	// Reset button
	document.getElementById("resetBtn")?.addEventListener("click", () => {
		for (const inp of colorInputs) {
			if (inp.dataset.def) inp.value = inp.dataset.def;
			if (inp.dataset.var) root.style.removeProperty(inp.dataset.var);
		}
		cSpeed.value = "0";
		cSpeed.dispatchEvent(new Event("input"));
		cPx.value = "0.7";
		cPx.dispatchEvent(new Event("input"));
		cConjD.value = "3";
		cConjD.dispatchEvent(new Event("input"));
		setChk("t_orbits", true);
		setChk("t_spokes", false);
		setChk("t_zlabels", true);
		setChk("t_dividers", true);
		setChk("t_glow", true);
		setChk("t_occ", true);
		setChk("t_twilight", true);
		setChk("t_conj", true);
		setChk("t_conj_curved", true);
		setChk("t_guilloche", true);
		setChk("t_hands", true);
		setChk("t_moon", true);
		cGuilN.value = "120";
		cGuilN.dispatchEvent(new Event("input"));
		setChk("parallaxOn", !reduce);
		bgSel.value = "flat";
		bgSel.dispatchEvent(new Event("change"));
		earthSel.value = "fixed";
		earthSel.dispatchEvent(new Event("change"));
	});

	return { getConfig: () => ({ ...cfg }) };
}
