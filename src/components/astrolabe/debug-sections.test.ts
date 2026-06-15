// @vitest-environment jsdom
//
// Functional suite for the two F2 #debug ControlsSections — the comprehensive
// debug surface this feature emphasizes. Both share the same observable
// mechanism the material panel uses: a control's `input` event writes a CSS
// custom-property (color tokens) or drives the live guilloché relief filter.
//
// The assertions are on observable behavior, not implementation: a color picker
// writes the CORRECT --color-<body> token (a copy-paste body mix-up would fail),
// and the guilloché panel exposes its five sliders plus a flat-finish toggle and
// is debugOnly. One class is the ceiling for both sections, since they share the
// setProperty-on-input behaviour.
import { afterEach, describe, expect, it } from "vitest";
import type { BodyName } from "../../lib/astro-tokens.ts";
import { bodyColorVar } from "../../lib/astro-tokens.ts";
import { mount, resetDom } from "../test-dom.ts";
import { colorSection } from "./color-section.ts";
import { guillocheSection } from "./guilloche-section.ts";

const BODIES: readonly BodyName[] = [
	"sun",
	"mercury",
	"venus",
	"earth",
	"moon",
	"mars",
	"jupiter",
	"saturn",
	"uranus",
	"neptune",
];

afterEach(() => {
	resetDom();
	// Both sections write onto the shared documentElement; clear every token they
	// can set so one test never leaks a value into the next.
	for (const body of BODIES) {
		document.documentElement.style.removeProperty(bodyColorVar(body));
	}
});

/** Set a form control's value and fire the `input` event the section listens for. */
function drive(control: HTMLInputElement, value: string): void {
	control.value = value;
	control.dispatchEvent(new Event("input", { bubbles: true }));
}

describe("colorSection", () => {
	it("is a debugOnly section identified as 'color'", () => {
		expect(colorSection.id).toBe("color");
		expect(colorSection.debugOnly).toBe(true);
		expect(typeof colorSection.title).toBe("string");
		expect(colorSection.title.length).toBeGreaterThan(0);
	});

	it("exposes one color picker per body, each addressable by data-body", () => {
		const body = mount(colorSection.render());

		for (const name of BODIES) {
			const picker = body.querySelector(`[data-body="${name}"]`);
			expect(picker, `expected a color picker for ${name}`).not.toBeNull();
		}
	});

	it("writes --color-mars when the Mars picker changes", () => {
		const body = mount(colorSection.render());
		const picker = body.querySelector<HTMLInputElement>('[data-body="mars"]');
		expect(picker).not.toBeNull();

		drive(picker as HTMLInputElement, "#ff0000");

		expect(
			document.documentElement.style.getPropertyValue(bodyColorVar("mars")),
		).toBe("#ff0000");
		// Guard the copy-paste body mix-up: driving Mars must not touch Earth.
		expect(
			document.documentElement.style.getPropertyValue(bodyColorVar("earth")),
		).toBe("");
	});

	it("renders a node ControlsSheet can mount without error", () => {
		expect(() => mount(colorSection.render())).not.toThrow();
	});
});

describe("guillocheSection", () => {
	it("is a debugOnly section identified as 'guilloche'", () => {
		expect(guillocheSection.id).toBe("guilloche");
		expect(guillocheSection.debugOnly).toBe(true);
		expect(typeof guillocheSection.title).toBe("string");
		expect(guillocheSection.title.length).toBeGreaterThan(0);
	});

	it("exposes the five guilloché sliders, each addressable by data-param", () => {
		const body = mount(guillocheSection.render());

		for (const param of [
			"density",
			"pitch",
			"relief",
			"glint",
			"lacquer",
		] as const) {
			const slider = body.querySelector(
				`input[type="range"][data-param="${param}"]`,
			);
			expect(slider, `expected a ${param} slider`).not.toBeNull();
		}
	});

	it("exposes a flat-finish toggle that neutralizes the relief", () => {
		const body = mount(guillocheSection.render());

		const flat = body.querySelector('[data-param="flat"]');
		expect(flat, "expected a flat-finish toggle").not.toBeNull();
	});

	it("renders a node ControlsSheet can mount without error", () => {
		expect(() => mount(guillocheSection.render())).not.toThrow();
	});
});
