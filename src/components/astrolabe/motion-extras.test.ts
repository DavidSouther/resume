// @vitest-environment jsdom
//
// Functional suite for F3's Step-6 surface: the pure mousemove-parallax math and
// the two #debug ControlsSections (motion + zodiac). One class is the ceiling for
// the parallax math and one for the debug sections — both assert observable
// behavior (the shift scales down with radius; a switch's input writes the
// data-attribute the CSS/engine reads), not implementation.
import { afterEach, describe, expect, it } from "vitest";
import { R_INNER, R_OUTER } from "../../lib/astro-math.ts";
import { mount, resetDom } from "../test-dom.ts";
import { motionSection } from "./motion-section.ts";
import { bindParallax, parallaxShift } from "./parallax.ts";
import { zodiacSection } from "./zodiac-section.ts";

afterEach(resetDom);

/** Toggle a checkbox/switch and fire the `change` event the section listens for. */
function toggle(control: HTMLInputElement, checked: boolean): void {
	control.checked = checked;
	control.dispatchEvent(new Event("change", { bubbles: true }));
}

describe("parallaxShift", () => {
	it("scales the shift DOWN with ring radius so outer groups move less", () => {
		const pointer = { x: 10, y: 0 };
		const inner = parallaxShift(R_INNER, pointer, 1);
		const outer = parallaxShift(R_OUTER, pointer, 1);

		expect(Math.abs(inner.dx)).toBeGreaterThan(Math.abs(outer.dx));
	});

	it("is ~zero at the outer radius (the band barely drifts)", () => {
		const outer = parallaxShift(R_OUTER, { x: 10, y: 10 }, 1);

		expect(outer.dx).toBeCloseTo(0, 6);
		expect(outer.dy).toBeCloseTo(0, 6);
	});

	it("is zero for zero strength regardless of pointer offset", () => {
		const off = parallaxShift(R_INNER, { x: 50, y: -30 }, 0);

		// Zero strength means no shift on either axis (±0 both count as no shift).
		expect(off.dx).toBeCloseTo(0, 10);
		expect(off.dy).toBeCloseTo(0, 10);
	});

	it("shifts both axes proportional to the pointer offset", () => {
		const a = parallaxShift(R_INNER, { x: 10, y: 0 }, 1);
		const b = parallaxShift(R_INNER, { x: 20, y: 0 }, 1);

		// Doubling the pointer offset doubles the shift on that axis.
		expect(b.dx).toBeCloseTo(a.dx * 2, 6);
	});
});

describe("bindParallax", () => {
	it("shifts a [data-body] group on mousemove and stops after unbind", () => {
		const root = document.createElement("div");
		root.innerHTML = `<svg><g data-body="mars" data-radius="${R_INNER}"></g></svg>`;
		document.body.append(root);
		const group = root.querySelector('[data-body="mars"]') as Element;

		const unbind = bindParallax(root);
		root
			.querySelector("svg")
			?.dispatchEvent(new MouseEvent("mousemove", { clientX: 60, clientY: 0 }));
		// Parallax composes via the CSS `translate` property so it never overwrites
		// the engine's SVG `transform` attribute.
		const moved = (group as SVGElement).style.translate;
		expect(moved, "expected a CSS translate after mousemove").not.toBe("");

		unbind();
		(group as SVGElement).style.translate = "";
		root
			.querySelector("svg")
			?.dispatchEvent(new MouseEvent("mousemove", { clientX: 90, clientY: 0 }));
		expect(
			(group as SVGElement).style.translate,
			"expected no translate after unbind",
		).toBe("");
	});
});

describe("motionSection", () => {
	it("is a debugOnly section identified as 'motion'", () => {
		expect(motionSection.id).toBe("motion");
		expect(motionSection.debugOnly).toBe(true);
		expect(typeof motionSection.title).toBe("string");
		expect(motionSection.title.length).toBeGreaterThan(0);
	});

	it("exposes motion + parallax switches and a parallax-strength slider", () => {
		const body = mount(motionSection.render());

		expect(
			body.querySelector('input[data-toggle="motion"]'),
			"expected a motion on/off switch",
		).not.toBeNull();
		expect(
			body.querySelector('input[data-toggle="parallax"]'),
			"expected a parallax on/off switch",
		).not.toBeNull();
		expect(
			body.querySelector('input[type="range"][data-param="parallax-strength"]'),
			"expected a parallax-strength slider",
		).not.toBeNull();
	});

	it("renders a node ControlsSheet can mount without error", () => {
		expect(() => mount(motionSection.render())).not.toThrow();
	});
});

describe("zodiacSection", () => {
	it("is a debugOnly section identified as 'zodiac'", () => {
		expect(zodiacSection.id).toBe("zodiac");
		expect(zodiacSection.debugOnly).toBe(true);
		expect(typeof zodiacSection.title).toBe("string");
		expect(zodiacSection.title.length).toBeGreaterThan(0);
	});

	it("toggles the band/twilight data-attributes on the watch root from its switches", () => {
		// A watch root the section's switches write their visibility attributes onto.
		const watch = document.createElement("div");
		watch.className = "astrolabe";
		document.body.append(watch);

		const body = mount(zodiacSection.render());
		const bandSwitch = body.querySelector<HTMLInputElement>(
			'input[data-toggle="zodiac-band"]',
		);
		const twilightSwitch = body.querySelector<HTMLInputElement>(
			'input[data-toggle="twilight"]',
		);
		expect(bandSwitch, "expected a zodiac-band switch").not.toBeNull();
		expect(twilightSwitch, "expected a twilight switch").not.toBeNull();

		// Switching the band OFF hides it; switching it back ON clears the hide flag.
		toggle(bandSwitch as HTMLInputElement, false);
		expect(watch.hasAttribute("data-hide-zodiac")).toBe(true);
		toggle(bandSwitch as HTMLInputElement, true);
		expect(watch.hasAttribute("data-hide-zodiac")).toBe(false);

		toggle(twilightSwitch as HTMLInputElement, false);
		expect(watch.hasAttribute("data-hide-twilight")).toBe(true);
	});

	it("renders a node ControlsSheet can mount without error", () => {
		expect(() => mount(zodiacSection.render())).not.toThrow();
	});
});
