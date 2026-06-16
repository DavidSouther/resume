// @vitest-environment jsdom

// Feature test for the control-menu merge: the always-on motion card and the
// slide-out expander become one self-scrolling, left-anchored drawer toggled by
// a persistent pancake. Red until the merge lands. See
// .ailly/developer/2026-06-16-E-astrolabe-control-menu/design.md.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import page from "../../../pages/astrolabe/page.ts";
import { ASTROLABE_CSS } from "../../lib/astrolabe/css.ts";
import { mount, resetDom } from "../test-dom.ts";
import { initControls } from "./controls.ts";

afterEach(resetDom);

describe("astrolabe control menu — one merged drawer", () => {
	let drawer: HTMLElement;

	beforeEach(() => {
		mount(page.default());
		initControls();
		drawer = document.getElementById("controls") as HTMLElement;
	});

	it("collapses the always-on motion card into the single drawer", () => {
		// The separate always-on surface no longer exists as its own container...
		expect(document.getElementById("always-controls")).toBeNull();

		// ...and the one drawer now holds every control, motion and expander alike.
		expect(drawer).not.toBeNull();
		for (const id of [
			"realClock",
			"simClock",
			"earthMode",
			"caseSize",
			"speed",
		]) {
			const el = document.getElementById(id);
			expect(el, `#${id} present`).not.toBeNull();
			expect(drawer.contains(el), `#${id} inside the drawer`).toBe(true);
		}
		const swatches = drawer.querySelectorAll<HTMLButtonElement>(
			"button.material-swatch",
		);
		expect(swatches.length).toBeGreaterThan(0);
		// A representative expander control is in the same container.
		expect(drawer.contains(document.getElementById("t_orbits"))).toBe(true);
	});

	it("toggles the one drawer from a persistent pancake, not a text swap", () => {
		const toggle = document.getElementById("gear") as HTMLButtonElement;
		expect(toggle).not.toBeNull();

		const labelText = () => (toggle.textContent ?? "").toUpperCase();
		// The pancake never carries a CONTROLS / CLOSE word label, open or closed.
		expect(labelText()).not.toContain("CONTROLS");
		expect(labelText()).not.toContain("CLOSE");

		const before = drawer.classList.contains("open");
		toggle.click();
		expect(drawer.classList.contains("open")).toBe(!before);
		expect(labelText()).not.toContain("CLOSE");
		// The pancake exposes its open state to assistive tech rather than via text.
		expect(toggle.getAttribute("aria-expanded")).toBe(String(!before));
		toggle.click();
		expect(drawer.classList.contains("open")).toBe(before);
		expect(toggle.getAttribute("aria-expanded")).toBe(String(before));
	});

	// The default-open geometry at >=768px is layout, which jsdom does not compute;
	// the metric is verified manually (Playwright). Here we only assert the CSS
	// carries the width-threshold media query that supplies that default.
	it("drives the default-open state at >=768px from CSS alone", () => {
		expect(ASTROLABE_CSS).toMatch(/@media[^{]*min-width:\s*768px/);
	});
});
