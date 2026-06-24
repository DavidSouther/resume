// @vitest-environment jsdom

// Regression guard (Astrolabe FCC refactor, Feature 2 — controls drawer): a
// control's CHANGE must actually APPLY its effect, not merely persist. Jiffies
// keeps a single event-listener per type (a second registration replaces the
// first), so wiring persistence as a separate `change`/`input` listener silently
// clobbered each control's apply handler — display toggles and color swatches
// "did nothing" while still writing to localStorage. The sibling control-menu /
// persistence tests never asserted the apply effect, so they could not catch it.
//
// This drives the drawer through the SSG serialize→reparse round-trip (so it also
// proves controls.ts works against raw page elements, not a build-time `.update`
// graft) and asserts both the apply AND the persist happen. See
// .ailly/developer/2026-06-23-A-astrolabe-fcc-refactor/design.md.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import page from "../../../pages/astrolabe/page.ts";
import { resetDom } from "../test-dom.ts";
import { initControls } from "./controls.ts";

afterEach(resetDom);

// Render → serialize → reparse: strips the build-time graft, reproducing the
// browser's view of the SSG output.
function mountRoundTripped(): void {
	const html = page.default().outerHTML;
	const container = document.createElement("div");
	container.innerHTML = html;
	document.body.append(container);
}

function fire(el: Element, type: string): void {
	el.dispatchEvent(new Event(type, { bubbles: true }));
}

describe("astrolabe controls drawer — changes apply, not just persist", () => {
	beforeEach(() => {
		localStorage.clear();
		mountRoundTripped();
		initControls();
	});

	it("display toggles add/remove their root class on change", () => {
		const root = document.documentElement;
		const orbits = document.getElementById("t_orbits") as HTMLInputElement;

		// Default checked → not hidden.
		expect(root.classList.contains("hide-orbits")).toBe(false);

		// Unchecking actually hides (the apply handler runs, not just persist).
		orbits.checked = false;
		fire(orbits, "change");
		expect(root.classList.contains("hide-orbits")).toBe(true);

		// Re-checking restores.
		orbits.checked = true;
		fire(orbits, "change");
		expect(root.classList.contains("hide-orbits")).toBe(false);

		// A second display toggle is independent and also applies.
		const twilight = document.getElementById("t_twilight") as HTMLInputElement;
		twilight.checked = false;
		fire(twilight, "change");
		expect(root.classList.contains("hide-twilight")).toBe(true);
	});

	it("a color swatch drives its CSS custom property on the root", () => {
		const root = document.documentElement;
		const mars = document.querySelector<HTMLInputElement>(
			'input[type=color][data-var="--mars"]',
		);
		expect(mars).not.toBeNull();

		(mars as HTMLInputElement).value = "#123456";
		fire(mars as HTMLInputElement, "input");

		expect(root.style.getPropertyValue("--mars")).toBe("#123456");
	});

	it("still persists the change to localStorage", () => {
		const orbits = document.getElementById("t_orbits") as HTMLInputElement;
		orbits.checked = false;
		fire(orbits, "change");

		const raw = localStorage.getItem("astrolabe.controls.v1");
		expect(raw).not.toBeNull();
		const snap = JSON.parse(raw as string);
		expect(snap.inputs.t_orbits).toBe(false);
	});
});
