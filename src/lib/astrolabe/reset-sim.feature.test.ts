import { describe, expect, test } from "vitest";
// Helper does not exist yet — the reset-sim bugfix adds it. Keeps this red.
import { simTimeForNow } from "./math.ts";

/**
 * Reproduction (bugfix shape) for the reset-sim bug:
 *
 *   Observed: double-clicking Earth does nothing; the simulation clock stays
 *             wherever the simulation has wound it.
 *   Expected: double-clicking Earth resets simulated time to the real system
 *             time, so the displayed clock reads "now".
 *
 * The displayed instant is `new Date(bootMs + simT * 1000)`. `simTimeForNow`
 * returns the simT that makes that instant equal the current wall clock — the
 * value the dblclick handler assigns to simT.
 */
describe("astrolabe reset-sim — double-click Earth shows system time", () => {
	test("simTimeForNow makes the displayed clock equal real time", () => {
		const bootMs = 1_700_000_000_000;
		const nowMs = bootMs + 9_876_543; // simulation has drifted ~9876s ahead

		const simT = simTimeForNow(bootMs, nowMs);
		// Round trip: feeding simT back through the displayed-instant formula
		// lands exactly on the real time.
		expect(bootMs + simT * 1000).toBe(nowMs);
	});

	test("resets to zero drift when no real time has elapsed since boot", () => {
		const bootMs = 1_700_000_000_000;
		expect(simTimeForNow(bootMs, bootMs)).toBe(0);
	});
});
