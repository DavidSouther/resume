import { assertExists } from "@davidsouther/jiffies/assert.ts";
import { describe, expect, test } from "vitest";
import { BODIES, EARTH_YEAR } from "./bodies.ts";
// `geoDirection` does not exist yet — the Ptolemaic feature adds
// src/lib/astrolabe/geocentric.ts. This import keeps the feature test red.
import { geoDirection } from "./geocentric.ts";
import { helioA } from "./math.ts";

/**
 * Feature acceptance for the Ptolemaic (geocentric) Earth frame.
 *
 * User story: in Ptolemaic mode an outer planet tracks forward against the
 * zodiac, slows, REVERSES for a stretch near opposition (apparent retrograde),
 * then resumes forward. The Sun-centered frames show no such reversal — a
 * heliocentric body's dial angle only ever advances.
 *
 * The defining, deterministic observable is the geocentric direction of Mars as
 * a function of simulated time. Sampled across one synodic period it must be
 * non-monotonic (a retrograde reversal is present), while Mars's heliocentric
 * dial angle over the same window is strictly monotonic.
 */
describe("astrolabe Ptolemaic frame — retrograde emerges geocentrically", () => {
	const mars = assertExists(BODIES.get("mars"), "mars missing from BODIES");

	// Mars synodic period ~779.94 days ~ 2.135 Earth years; 2.4 years guarantees
	// the window contains one full retrograde loop regardless of start phase.
	const SPAN = 2.4 * EARTH_YEAR;
	const STEPS = 600;

	// Signed step-to-step change of a degree series, each wrapped to (-180, 180]
	// so a 359->1 rollover reads as +2, not -358. The sign is the body's apparent
	// angular velocity over that step.
	function deltas(series: number[]): number[] {
		const out: number[] = [];
		let prev = series[0];
		for (let i = 1; i < series.length; i++) {
			const d = ((((series[i] - prev + 180) % 360) + 360) % 360) - 180;
			out.push(d);
			prev = series[i];
		}
		return out;
	}

	test("Mars geocentric direction reverses within a synodic period", () => {
		const geo: number[] = [];
		for (let i = 0; i <= STEPS; i++) {
			geo.push(geoDirection(mars, (SPAN * i) / STEPS));
		}
		const d = deltas(geo);
		const maxStep = Math.max(...d);
		const minStep = Math.min(...d);
		// Some steps advance, some retreat: opposite signs prove a reversal.
		expect(maxStep).toBeGreaterThan(0);
		expect(minStep).toBeLessThan(0);
	});

	test("Mars heliocentric dial angle is monotonic over the same window", () => {
		const helio: number[] = [];
		for (let i = 0; i <= STEPS; i++) {
			helio.push(helioA(mars, (SPAN * i) / STEPS));
		}
		const d = deltas(helio);
		// Every step advances in the same direction — no retrograde heliocentrically.
		const allForward = d.every((x) => x > 0);
		const allBackward = d.every((x) => x < 0);
		expect(allForward || allBackward).toBe(true);
	});
});
