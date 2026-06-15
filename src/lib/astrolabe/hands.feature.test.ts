import { describe, expect, test } from "vitest";
// These helpers do not exist yet — the watch-hands bugfix adds them.
// The import keeps this reproduction test red until then.
import { handAngles, handsHidden } from "./math.ts";

/**
 * Reproduction (bugfix shape) for the watch-hands bugs:
 *
 *   Observed: the hour/minute hands rotate with simulated time, and they
 *             auto-hide once the simulation runs fast.
 *   Expected: the hands always reflect the real wall clock, and they hide only
 *             when the user turns the "Watch hands" control off (drag-hiding is
 *             separate and unchanged).
 *
 * `handAngles` is the pure seam: the animation feeds it `new Date()` (system
 * time) rather than the simulation Date, so hand rotation is decoupled from the
 * simulation. `handsHidden` is the hide predicate, now a function of the user
 * toggle alone — speed is no longer an input.
 */
describe("astrolabe watch hands — system time, toggle-only hiding", () => {
	test("handAngles derives rotations from the supplied Date", () => {
		const noon = handAngles(new Date(2026, 0, 1, 12, 0, 0));
		expect(noon.hour).toBeCloseTo(0, 6);
		expect(noon.minute).toBeCloseTo(0, 6);

		// 03:30:00 — hour hand halfway between 3 and 4 (105°), minute at 180°.
		const halfPast = handAngles(new Date(2026, 0, 1, 3, 30, 0));
		expect(halfPast.hour).toBeCloseTo(105, 6);
		expect(halfPast.minute).toBeCloseTo(180, 6);

		// Seconds advance the minute hand continuously: 06:00:30 → minute 3°.
		const withSeconds = handAngles(new Date(2026, 0, 1, 6, 0, 30));
		expect(withSeconds.minute).toBeCloseTo(3, 6);
	});

	test("hand visibility depends on the user toggle only, never speed", () => {
		expect(handsHidden(true)).toBe(false); // toggle on → visible at any speed
		expect(handsHidden(false)).toBe(true); // toggle off → hidden
	});
});
