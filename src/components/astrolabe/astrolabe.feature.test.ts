// @vitest-environment jsdom
//
// THESIS FEATURE TEST — F2: Dial & Finish (design.md 2026-06-14-C).
// This is the PROJECT's thesis test; F2 owns it.
//
// User story (Given/When/Then):
//   GIVEN a reader opens /astrolabe/ cold,
//   WHEN the Astrolabe dial renders,
//   THEN they see ONE <svg> dial with the Sun at center; all nine bodies
//        (the eight planets + the Moon) present as [data-body] groups; and
//        EARTH HELD STILL AT 3 O'CLOCK — its translate on the +x ray (y near 0,
//        x > 0). The thesis: a geocentric watch with Earth fixed at 3 o'clock.
//   AND the eight planet ring radii are monotonic by semi-major axis
//        (PLANET_ORDER) — the fixed log-radial map reads outward by distance.
//
// Every assertion is DATE-INVARIANT under the coordinate contract (Contract 1):
// radii are a fixed log scaling of semi-major axis, and Earth's +x ray is the
// constant rotation pinned into geocentricTransform. So this test needs NO date
// fixture and NO snapshot file — it is true for any date.
//
// It stays RED until F2 builds the dial: today F1's Astrolabe() renders the
// EMPTY dial container (no <svg>, no [data-body] groups), and src/lib/astro-math.ts
// (PLANET_ORDER / SEMI_MAJOR_AXIS_AU) does not exist yet. It fails for the RIGHT
// reason — missing dial + missing module — not a syntax error.
//
// Visual finish (guilloché, twilight wedge, lacquer) and live #debug token
// repaint are browser-verified in the build phase, not unit-asserted here.
import { afterEach, describe, expect, it } from "vitest";
import { PLANET_ORDER, SEMI_MAJOR_AXIS_AU } from "../../lib/astro-math.ts";
// BodyName's canonical source is astro-tokens.ts (F1); astro-math.ts re-exports
// it. Annotating the callbacks here keeps the test clean TypeScript so the only
// remaining error is the intended missing astro-math.ts, not implicit-any noise.
import type { BodyName } from "../../lib/astro-tokens.ts";
import { mount, resetDom } from "../test-dom.ts";
import { Astrolabe } from "./astrolabe.ts";

afterEach(resetDom);

// The nine rendered bodies: the eight planets and the Moon. (The Sun is asserted
// separately, by its center position.)
const BODIES = [
	"mercury",
	"venus",
	"earth",
	"moon",
	"mars",
	"jupiter",
	"saturn",
	"uranus",
	"neptune",
] as const;

// Parse the (x, y) out of a `transform="translate(x, y)"` (or "translate(x y)").
// A body with no translate, or translate(0,0), sits at the dial center.
function translateOf(el: Element): { x: number; y: number } {
	const transform = el.getAttribute("transform") ?? "";
	const match = transform.match(
		/translate\(\s*(-?[\d.eE+]+)[ ,]+(-?[\d.eE+]+)\s*\)/,
	);
	if (!match) {
		return { x: 0, y: 0 };
	}
	return { x: Number(match[1]), y: Number(match[2]) };
}

describe("F2 astrolabe dial renders the geocentric sky with Earth at 3 o'clock", () => {
	it("renders one svg dial with the Sun at center and Earth on the +x ray, planets ringed by distance", () => {
		// Arrange + Act: render the full astrolabe (shell + populated dial).
		const container = mount(Astrolabe());

		// 1. Exactly one <svg> dial, with the Sun group at its center.
		const svgs = container.querySelectorAll("svg");
		expect(svgs.length).toBe(1);
		const sun = container.querySelector('[data-body="sun"]');
		expect(sun).not.toBeNull();
		const sunPos = translateOf(sun as Element);
		// The Sun is at radius 0 — center of the viewBox.
		expect(Math.abs(sunPos.x)).toBeLessThan(0.5);
		expect(Math.abs(sunPos.y)).toBeLessThan(0.5);

		// 2. All eight planets and the Moon are present as [data-body] groups.
		for (const body of BODIES) {
			expect(
				container.querySelector(`[data-body="${body}"]`),
				`expected a [data-body="${body}"] group`,
			).not.toBeNull();
		}

		// 3. THE THESIS — Earth's translate is on the +x ray (3 o'clock):
		//    y near 0, x strictly greater than 0.
		const earth = container.querySelector('[data-body="earth"]') as Element;
		const earthPos = translateOf(earth);
		expect(earthPos.x).toBeGreaterThan(0);
		expect(Math.abs(earthPos.y)).toBeLessThan(0.5);

		// 4. The eight planet ring radii are MONOTONIC by semi-major axis: in
		//    PLANET_ORDER (Mercury…Neptune), each body's distance from center is
		//    strictly greater than the previous one — the fixed log-radial map.
		const radii = PLANET_ORDER.map((body: BodyName) => {
			const group = container.querySelector(`[data-body="${body}"]`) as Element;
			const { x, y } = translateOf(group);
			return Math.hypot(x, y);
		});
		// PLANET_ORDER is sorted by semi-major axis, so the contract requires the
		// rendered radii to be strictly increasing.
		const ordered = [...PLANET_ORDER].every(
			(_body, i) => i === 0 || radii[i] > radii[i - 1],
		);
		expect(ordered).toBe(true);

		// Guard the contract source: PLANET_ORDER's semi-major axes are themselves
		// strictly increasing (so assertion 4 is testing render order, not a
		// mis-sorted constant).
		const axesSorted = PLANET_ORDER.every(
			(body: BodyName, i: number) =>
				i === 0 ||
				SEMI_MAJOR_AXIS_AU[body] > SEMI_MAJOR_AXIS_AU[PLANET_ORDER[i - 1]],
		);
		expect(axesSorted).toBe(true);
	});
});
