// @vitest-environment jsdom
//
// Functional suite for the Realtime/Fast case button (F3, Step 4). One functional
// test class (the parsimony ceiling): the button is a <button data-speed-toggle>
// labelled "Realtime", clicking it toggles Realtime/Fast and writes/removes
// FAST_ATTR on the watch root, two clicks return to Realtime, and SPEED_FACTOR
// carries realtime = 1 and the year-per-minute fast factor.
//
// The hand-hiding and the motion engine's setSpeed re-anchor are browser-/engine-
// verified (design §Summary), not asserted here; this suite covers the button's
// structure and the attribute round-trip the CSS and engine read.
import { div } from "@davidsouther/jiffies/dom/html.ts";
import { afterEach, describe, expect, it } from "vitest";
import { mount, resetDom } from "../test-dom.ts";
import { FAST_ATTR, SPEED_FACTOR, SpeedToggle } from "./speed-toggle.ts";

afterEach(resetDom);

/** Mount the toggle inside a real `.astrolabe` watch root, returning both. */
function mountInRoot(): { root: HTMLElement; toggle: HTMLButtonElement } {
	const root = div({ class: "astrolabe" });
	const toggle = SpeedToggle();
	root.append(toggle);
	mount(root);
	return { root, toggle };
}

describe("SpeedToggle is the Realtime/Fast case button", () => {
	it("is a <button data-speed-toggle> labelled Realtime by default", () => {
		const toggle = SpeedToggle();
		expect(toggle.tagName.toLowerCase()).toBe("button");
		expect(toggle.hasAttribute("data-speed-toggle")).toBe(true);
		expect((toggle.textContent ?? "").toLowerCase()).toMatch(/realtime/);
	});

	it("writes FAST_ATTR onto the watch root and flips to Fast on click", () => {
		const { root, toggle } = mountInRoot();

		toggle.click();

		expect(root.hasAttribute(FAST_ATTR)).toBe(true);
		expect((toggle.textContent ?? "").toLowerCase()).toMatch(/fast/);
	});

	it("removes FAST_ATTR and returns to Realtime after two clicks", () => {
		const { root, toggle } = mountInRoot();

		toggle.click();
		toggle.click();

		expect(root.hasAttribute(FAST_ATTR)).toBe(false);
		expect((toggle.textContent ?? "").toLowerCase()).toMatch(/realtime/);
	});

	it("carries a realtime factor of 1 and a year-per-minute fast factor", () => {
		expect(SPEED_FACTOR.realtime).toBe(1);
		// One sidereal-ish year (31_557_600 s) per real minute (60 s).
		expect(SPEED_FACTOR.fast).toBeCloseTo(31_557_600 / 60, 0);
		expect(SPEED_FACTOR.fast).toBeGreaterThan(SPEED_FACTOR.realtime);
	});
});
