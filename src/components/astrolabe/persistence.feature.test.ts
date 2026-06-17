// @vitest-environment jsdom

// Feature test for Astrolabe controls persistence: the controls-drawer state is
// saved to localStorage and restored on reload, while the simulation always
// boots fresh and Reset wipes the persisted snapshot. Red until persistence
// lands in controls.ts. See
// .ailly/developer/2026-06-17-A-astrolabe-persistence/design.md.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import page from "../../../pages/astrolabe/page.ts";
import { KEPLERIAN } from "../../lib/astrolabe/types.ts";
import { mount, resetDom } from "../test-dom.ts";
import { initControls } from "./controls.ts";

const STORAGE_KEY = "astrolabe.controls.v1";

afterEach(() => {
	resetDom();
	localStorage.clear();
});

// Drive a representative control off its default: a segmented group, a slider,
// a checkbox, a material swatch, and a color picker. Mirrors how a user touches
// the drawer. Returns the values set so the reload assertions can compare.
function changeRepresentativeControls() {
	// Segmented group: Earth frame -> Keplerian (default galilean).
	const keplerianBtn = document.querySelector<HTMLButtonElement>(
		'#earthMode button[data-value="keplerian"]',
	);
	keplerianBtn?.click();

	// Range slider: parallax strength -> 1.20 (default 0.70).
	const parallax = document.getElementById("parallax") as HTMLInputElement;
	parallax.value = "1.2";
	parallax.dispatchEvent(new Event("input"));

	// Checkbox: disc arms on (default off).
	const spokes = document.getElementById("t_spokes") as HTMLInputElement;
	spokes.checked = true;
	spokes.dispatchEvent(new Event("change"));

	// Material swatch: Gold (default platinum). Gold's --case is #d9a441.
	const gold = document.querySelector<HTMLButtonElement>(
		'button.material-swatch[data-material="gold"]',
	);
	gold?.click();

	// Color picker: the background (--ground), an advanced override.
	const ground = document.querySelector<HTMLInputElement>(
		'input[type=color][data-var="--ground"]',
	);
	if (ground) {
		ground.value = "#123456";
		ground.dispatchEvent(new Event("input"));
	}
}

describe("astrolabe controls persistence", () => {
	beforeEach(() => {
		localStorage.clear();
	});

	it("restores the changed controls across a reload", () => {
		// Arrange: first visit — mount, init, change a representative set.
		mount(page.default());
		const first = initControls();
		changeRepresentativeControls();
		expect(first.getConfig().earthMode).toBe(KEPLERIAN);

		// Act: simulate a reload — tear down the DOM but KEEP localStorage, then
		// re-mount and re-init exactly as a fresh page load would.
		resetDom();
		mount(page.default());
		const second = initControls();

		// Assert: the controls came back with the changed values...
		const earthMode = document.getElementById("earthMode") as HTMLElement;
		expect(earthMode.dataset.value).toBe("keplerian");

		const parallax = document.getElementById("parallax") as HTMLInputElement;
		expect(parseFloat(parallax.value)).toBeCloseTo(1.2, 5);

		const spokes = document.getElementById("t_spokes") as HTMLInputElement;
		expect(spokes.checked).toBe(true);

		const ground = document.querySelector<HTMLInputElement>(
			'input[type=color][data-var="--ground"]',
		);
		expect(ground?.value.toLowerCase()).toBe("#123456");

		// ...the chosen material's accent var is applied to the root...
		expect(
			document.documentElement.style
				.getPropertyValue("--case")
				.trim()
				.toLowerCase(),
		).toBe("#d9a441");

		// ...and getConfig() reflects the restored choices.
		const cfg = second.getConfig();
		expect(cfg.earthMode).toBe(KEPLERIAN);
		expect(cfg.parallax).toBeCloseTo(1.2, 5);
	});

	it("clears the persisted snapshot when Reset is clicked", () => {
		mount(page.default());
		initControls();
		changeRepresentativeControls();
		// Something is persisted before reset.
		expect(localStorage.getItem(STORAGE_KEY)).not.toBeNull();

		(document.getElementById("resetBtn") as HTMLButtonElement).click();

		// Reset leaves storage truly empty: the persistence key is gone.
		expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
	});

	it("survives a malformed stored blob by falling back to defaults", () => {
		// A tampered/stale store where the typed shape is violated: `colors` is a
		// string, not a map. A cast would let this through and crash init at the
		// first `var in colors` (TypeError on a primitive). Parsing at the boundary
		// normalizes it instead, so init proceeds on markup defaults.
		localStorage.setItem(
			STORAGE_KEY,
			JSON.stringify({ inputs: "nope", groups: 5, material: 42, colors: "x" }),
		);

		mount(page.default());
		expect(() => initControls()).not.toThrow();

		// Nothing from the bad blob leaked in: the Earth frame is the markup default.
		const earthMode = document.getElementById("earthMode") as HTMLElement;
		expect(earthMode.dataset.value).toBe("galilean");
	});

	it("persists only controls state, never the simulation", () => {
		mount(page.default());
		initControls();
		changeRepresentativeControls();

		// The persistence key is the only astrolabe key in storage.
		const astrolabeKeys = Object.keys(localStorage).filter((k) =>
			k.startsWith("astrolabe"),
		);
		expect(astrolabeKeys).toEqual([STORAGE_KEY]);

		// The stored snapshot carries no simulation fields.
		const raw = localStorage.getItem(STORAGE_KEY);
		expect(raw).not.toBeNull();
		const flat = JSON.stringify(JSON.parse(raw as string));
		for (const simField of ["simT", "bootMs", "caseOffset"]) {
			expect(flat).not.toContain(simField);
		}
	});
});
