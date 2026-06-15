// @vitest-environment jsdom
//
// Unit test for the F1 presentational shell pieces: DialContainer() (the empty
// square host F2 mounts its <svg> into) and WatchCase(dial) (the portrait
// <figure> framing strap-top / platinum case / strap-bottom).
//
// Truly visual behavior — portrait fill on a phone, square aspect, platinum /
// cordovan finish appearance — is browser-verified in Step 5, not asserted here.
// This suite is jsdom-friendly and structural: presence, emptiness, framing.
import { afterEach, describe, expect, it } from "vitest";
import { mount, resetDom } from "../test-dom.ts";
import { WatchCase } from "./case.ts";
import { DialContainer } from "./dial-container.ts";

afterEach(resetDom);

describe("DialContainer", () => {
	it("exposes the data-astrolabe-dial hook and ships empty", () => {
		const container = mount(DialContainer());

		const dial = container.querySelector("[data-astrolabe-dial]");
		expect(dial).not.toBeNull();
		// The slot F2 fills is empty: no <svg> dial, no body groups yet.
		expect(dial?.querySelector("svg")).toBeNull();
		expect(dial?.querySelector("[data-body]")).toBeNull();
	});
});

describe("WatchCase", () => {
	it("wraps the passed dial inside a portrait figure", () => {
		const dial = DialContainer();
		const container = mount(WatchCase(dial));

		const figure = container.querySelector("figure");
		expect(figure).not.toBeNull();
		// The exact dial node passed in is present in the framed tree.
		expect(figure?.contains(dial)).toBe(true);
		// The container still ships empty after framing.
		expect(dial.querySelector("svg")).toBeNull();
	});

	it("frames the case with a strap region above AND below", () => {
		const dial = DialContainer();
		const container = mount(WatchCase(dial));

		const straps = container.querySelectorAll(".astrolabe-strap");
		expect(straps.length).toBe(2);

		// The two straps sit around the case, one on each side of the bezel that
		// wraps the dial — portrait framing.
		const bezel = container.querySelector(".astrolabe-bezel");
		expect(bezel).not.toBeNull();
		expect(bezel?.contains(dial)).toBe(true);
		expect(straps[0]).not.toBe(straps[1]);
	});
});
