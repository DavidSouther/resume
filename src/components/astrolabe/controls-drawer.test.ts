// @vitest-environment jsdom

// Unit guard (Astrolabe FCC refactor — the stage component): the drawer composes
// the leaf controls and is the single DOWN path for state. `update({ state })`
// re-renders every control from its slice (the one programmatic path reset/restore
// use); `update({ events })` fans each control's handler map to its leaf; panel
// open/close is drawer-local UI (gear/close, no state write). State is fanned only
// when the state OBJECT changes (reference-gated), so each `update` here passes a
// fresh object — exactly as the real controller does. The dial + overlays the
// component now also owns are built internally; this suite exercises the controls.
// See .ailly/developer/2026-06-23-A-astrolabe-fcc-refactor/dial-redesign.md.
import { afterEach, describe, expect, it } from "vitest";
import { ControlsDrawer, DEFAULTS } from "./controls-components.ts";

afterEach(() => {
	// The drawer applies its effects to the real documentElement; reset between.
	document.documentElement.className = "";
	document.documentElement.removeAttribute("style");
});

describe("ControlsDrawer — fans state down to every control", () => {
	it("re-renders each control's effect from state on update({ state })", () => {
		const drawer = ControlsDrawer({ state: { ...DEFAULTS } });
		const root = document.documentElement;
		expect(root.classList.contains("hide-orbits")).toBe(false); // orbits on ⇒ shown

		drawer.update({
			state: { ...DEFAULTS, orbits: false, twilight: false, material: "gold" },
		});
		expect(root.classList.contains("hide-orbits")).toBe(true);
		expect(root.classList.contains("hide-twilight")).toBe(true);
		const activeSwatch = drawer.querySelector(
			".material-swatch.active",
		) as HTMLElement;
		expect(activeSwatch.getAttribute("data-material")).toBe("gold");
		expect(root.style.getPropertyValue("--case")).toBe("#D9A441");
	});

	it("is the only path that moves a control programmatically (restore)", () => {
		const drawer = ControlsDrawer({ state: { ...DEFAULTS } });
		const moon = drawer.querySelector("#t_moon") as HTMLInputElement;
		expect(moon.checked).toBe(true);

		drawer.update({ state: { ...DEFAULTS, moon: false } });
		expect(moon.checked).toBe(false);
		expect(document.documentElement.classList.contains("hide-moon")).toBe(true);
	});
});

describe("ControlsDrawer — fans each control's events map to its leaf", () => {
	it("wires a checkbox's change handler from the events collection", () => {
		let seen: boolean | null = null;
		const drawer = ControlsDrawer({ state: { ...DEFAULTS } });
		drawer.update({
			state: { ...DEFAULTS },
			events: {
				t_orbits: {
					change: (e) => {
						seen = (e.target as HTMLInputElement).checked;
					},
				},
			},
		});
		const orbits = drawer.querySelector("#t_orbits") as HTMLInputElement;
		orbits.checked = false;
		orbits.dispatchEvent(new Event("change", { bubbles: true }));
		expect(seen).toBe(false);
	});

	it("wires the reset button from events.resetBtn", () => {
		let reset = 0;
		const drawer = ControlsDrawer({ state: { ...DEFAULTS } });
		drawer.update({
			state: { ...DEFAULTS },
			events: { resetBtn: { click: () => reset++ } },
		});
		(drawer.querySelector("#resetBtn") as HTMLElement).click();
		expect(reset).toBe(1);
	});
});

describe("ControlsDrawer — panel open/close is drawer-local UI", () => {
	it("toggles .open + aria-expanded on gear/panel from the gear/close clicks", () => {
		const drawer = ControlsDrawer({ state: { ...DEFAULTS } });
		const gear = drawer.querySelector("#gear") as HTMLElement;
		const panel = drawer.querySelector("#controls") as HTMLElement;
		// jsdom has no matchMedia ⇒ boots closed.
		expect(panel.classList.contains("open")).toBe(false);

		gear.click();
		expect(panel.classList.contains("open")).toBe(true);
		expect(gear.getAttribute("aria-expanded")).toBe("true");

		(drawer.querySelector("#closeBtn") as HTMLElement).click();
		expect(panel.classList.contains("open")).toBe(false);
	});
});
