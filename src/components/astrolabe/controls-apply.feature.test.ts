// @vitest-environment jsdom

// Feature test (Astrolabe FCC refactor, Feature 3 — controls drawer state/markup
// separation). This is the definition of done for review_2 #2: a single
// serializable ControlsState is the one source of truth, and every control is a
// pure projection of it. Built the client-bootstrap way (buildStage → mount →
// initControls), it asserts the v2 contract:
//   (a) setting each control's value projects to the right cfg field / root class
//       / root var,
//   (b) the state survives a serialize→reparse→reload by restoring from the v2
//       blob,
//   (c) reset() returns every projection to DEFAULTS and clears storage.
// A stored v1 blob is ignored (the clean break). See
// .ailly/developer/2026-06-23-A-astrolabe-fcc-refactor/controls-redesign.md.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { GALILEAN, KEPLERIAN } from "../../lib/astrolabe/types.ts";
import { mount, resetDom } from "../test-dom.ts";
import { initControls } from "./controls-components.ts";
import { buildStage } from "./stage.ts";

const STORAGE_KEY = "astrolabe.controls.v2";

function fire(el: Element, type: string): void {
	el.dispatchEvent(new Event(type, { bubbles: true }));
}

// Build a fresh stage, mount its root, and init the controls from its handles —
// the same sequence the client bootstrap runs. Returns the controller.
function mountStage() {
	const stage = buildStage();
	mount(stage.root);
	return initControls(stage.root);
}

afterEach(() => {
	resetDom();
	localStorage.clear();
	document.documentElement.className = "";
	document.documentElement.removeAttribute("style");
});

beforeEach(() => localStorage.clear());

describe("astrolabe controls — v2 contract: one state, projected", () => {
	it("each control projects to its cfg field / root class / root var", () => {
		const { getConfig } = mountStage();
		const root = document.documentElement;

		// Checkbox that drives BOTH data and styling: twilight off ⇒ cfg.twilight
		// false AND the hide-twilight root class on.
		const twilight = document.getElementById("t_twilight") as HTMLInputElement;
		twilight.checked = false;
		fire(twilight, "change");
		expect(getConfig().twilight).toBe(false);
		expect(root.classList.contains("hide-twilight")).toBe(true);

		// CSS-only toggle: orbits off ⇒ hide-orbits root class (no cfg field).
		const orbits = document.getElementById("t_orbits") as HTMLInputElement;
		orbits.checked = false;
		fire(orbits, "change");
		expect(root.classList.contains("hide-orbits")).toBe(true);

		// Segmented group → cfg field: Earth frame Keplerian.
		(
			document.querySelector(
				'#earthMode button[data-value="keplerian"]',
			) as HTMLElement
		).click();
		expect(getConfig().earthMode).toBe(KEPLERIAN);

		// Color picker → root var.
		const mars = document.querySelector(
			'input[data-var="--mars"]',
		) as HTMLInputElement;
		mars.value = "#123456";
		fire(mars, "input");
		expect(root.style.getPropertyValue("--mars")).toBe("#123456");

		// Range → cfg field.
		const parallax = document.getElementById("parallax") as HTMLInputElement;
		parallax.value = "1.2";
		fire(parallax, "input");
		expect(getConfig().parallax).toBeCloseTo(1.2, 5);
	});

	it("state survives a serialize→reparse→reload via the v2 blob", () => {
		const first = mountStage();
		(
			document.querySelector(
				'#earthMode button[data-value="keplerian"]',
			) as HTMLElement
		).click();
		const twilight = document.getElementById("t_twilight") as HTMLInputElement;
		twilight.checked = false;
		fire(twilight, "change");
		expect(first.getConfig().earthMode).toBe(KEPLERIAN);

		// Reload: tear down the DOM, KEEP localStorage, re-mount + re-init.
		resetDom();
		const second = mountStage();

		expect(second.getConfig().earthMode).toBe(KEPLERIAN);
		expect(second.getConfig().twilight).toBe(false);
		expect(document.documentElement.classList.contains("hide-twilight")).toBe(
			true,
		);
	});

	it("ignores a stored v1 blob (clean break to v2)", () => {
		// A v1-shaped blob under the v1 key must NOT restore — current users reset.
		localStorage.setItem(
			"astrolabe.controls.v1",
			JSON.stringify({ inputs: { t_twilight: false } }),
		);
		const { getConfig } = mountStage();
		expect(getConfig().twilight).toBe(true); // markup default, not the v1 value
	});

	it("reset returns every projection to DEFAULTS and clears storage", () => {
		const { getConfig } = mountStage();
		const root = document.documentElement;

		// Change a representative spread: a hide-toggle, a cfg segment, a material.
		const twilight = document.getElementById("t_twilight") as HTMLInputElement;
		twilight.checked = false;
		fire(twilight, "change");
		(
			document.querySelector(
				'#earthMode button[data-value="keplerian"]',
			) as HTMLElement
		).click();
		(
			document.querySelector(
				'button.material-swatch[data-material="gold"]',
			) as HTMLElement
		).click();
		expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

		(document.getElementById("resetBtn") as HTMLElement).click();

		// Every projection is back to DEFAULTS...
		expect(getConfig().twilight).toBe(true);
		expect(getConfig().earthMode).toBe(GALILEAN);
		expect(root.classList.contains("hide-twilight")).toBe(false);
		// ...the platinum (default) --case var is restored...
		expect(root.style.getPropertyValue("--case")).toBe("#C7CBD2");
		// ...and storage is truly empty (the default-applying fan must not re-persist).
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
	});
});
