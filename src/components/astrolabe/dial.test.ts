// @vitest-environment jsdom
//
// Functional suite for the populated dial. The project feature test
// (astrolabe.feature.test.ts) already covers the geocentric layout contract
// (one svg, Sun center, Earth +x, monotonic radii). This suite covers only the
// dial-specific structure the feature test does not assert: each body group
// carries a <circle> whose fill references that body's --color-<body> token
// (Contract 3). One functional class, no per-body multiplication.
import { afterEach, describe, expect, it } from "vitest";
import { mount, resetDom } from "../test-dom.ts";
import { Dial } from "./dial.ts";

afterEach(resetDom);

describe("Dial body markers reference their color tokens", () => {
	it("fills each body's circle with its --color-<body> token via var()", () => {
		// Arrange + Act: render the populated dial.
		const container = mount(Dial(new Date()));

		// Assert: representative center, ringed, and Earth-riding bodies each fill
		// their circle with the matching color token (Contract 3). Checking three
		// distinct roles guards the bodyColorVar wiring without per-body redundancy.
		for (const body of ["sun", "earth", "moon"] as const) {
			const marker = container.querySelector(`[data-body="${body}"] circle`);
			expect(marker, `expected a circle in the ${body} group`).not.toBeNull();
			expect(marker?.getAttribute("fill")).toBe(`var(--color-${body})`);
		}
	});
});

describe("Dial carries the guilloché finish and twilight wedge", () => {
	it("renders a guilloché <image>, a twilight <path> wedge, and keeps the ten body groups", () => {
		// Arrange + Act: render the populated dial with its finish (Step 4).
		const container = mount(Dial(new Date()));

		// The prebaked guilloché finish is an <image> layer (the data-URI literal is
		// generated in Step 6; the <image> element is present regardless).
		expect(
			container.querySelector("image"),
			"expected a guilloché <image> finish layer",
		).not.toBeNull();

		// The twilight dead-zone is a <path> wedge — NOT a [data-body] group — so the
		// body count invariant the feature test relies on still holds.
		expect(
			container.querySelector('path[data-finish="twilight"]'),
			"expected a twilight <path> wedge",
		).not.toBeNull();

		// The ten body groups stay addressable and unchanged in count: the finish
		// and the wedge are not [data-body] groups.
		expect(container.querySelectorAll("[data-body]").length).toBe(10);
	});

	it("layers the finish and wedge BEHIND the bodies so bodies stay on top", () => {
		// Arrange + Act.
		const container = mount(Dial(new Date()));
		const dial = container.querySelector("svg") as Element;
		const children = Array.from(dial.children);

		// The finish image and the twilight wedge precede every body group in
		// document order (last-painted wins → bodies render on top, addressable for
		// F3 interaction).
		const firstBodyIndex = children.findIndex((el) =>
			el.hasAttribute("data-body"),
		);
		const imageIndex = children.findIndex((el) => el.tagName === "image");
		const wedgeIndex = children.findIndex(
			(el) => el.getAttribute("data-finish") === "twilight",
		);
		expect(imageIndex).toBeGreaterThanOrEqual(0);
		expect(wedgeIndex).toBeGreaterThanOrEqual(0);
		expect(imageIndex).toBeLessThan(firstBodyIndex);
		expect(wedgeIndex).toBeLessThan(firstBodyIndex);
	});
});
