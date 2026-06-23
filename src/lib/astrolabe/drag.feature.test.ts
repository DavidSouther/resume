import { assertExists } from "@davidsouther/jiffies/assert.ts";
import { describe, expect, test } from "vitest";
import { BODIES, EARTH_YEAR } from "./bodies.ts";
// These helpers do not exist yet — the drag-mode build phase adds them.
// The import keeps this feature test red until then.
import { dialAngle, displayedRate, dragTimeStep, wrap180 } from "./math.ts";
import { GALILEAN } from "./types.ts";

const DAY = 86_400;

const MERCURY = assertExists(
	BODIES.get("mercury"),
	"mercury missing from BODIES",
);

/**
 * Primary user story (the acceptance example from research):
 *
 *   Given the dial in earth-fixed mode,
 *   When the user grabs Mercury and drags it three full turns clockwise
 *        around the Sun,
 *   Then simulated time advances by three Mercury synodic periods
 *        (3 x ~115.85 d, about 347.5 days), with no jump.
 *
 * The drag harness winds an unbounded angle by accumulating the shortest signed
 * per-frame delta (wrap180) and converts each delta to a simT step via the
 * body's signed displayed rate. This test drives that whole seam through the
 * pure helpers: cursor points on a circle -> dialAngle -> wrap180 -> dragTimeStep.
 */
describe("astrolabe drag mode — Mercury three turns advances time", () => {
	test("winding Mercury 3x clockwise in earth-fixed mode ~ 347.5 days", () => {
		const rate = displayedRate(MERCURY, GALILEAN); // synodic, deg per sim-second
		expect(rate).toBeGreaterThan(0); // inner planet: clockwise advances time

		// 36 frames of 30 deg = 1080 deg = three full clockwise turns, taken
		// modulo 360 so the winding crosses the 0/360 seam twice.
		let simT = 0;
		let prevAngle = 0; // press recorded Mercury at 3 o'clock (East, 0 deg)
		for (let k = 1; k <= 36; k++) {
			const deg = (k * 30) % 360;
			const rad = (deg * Math.PI) / 180;
			// Cursor point relative to dial center (East origin, clockwise).
			const theta = dialAngle(Math.cos(rad), Math.sin(rad));
			const dTheta = wrap180(theta - prevAngle);
			simT += dragTimeStep(dTheta, rate);
			prevAngle = theta;
		}

		// Exact winding identity: 1080 deg / synodic rate.
		const expectedExact = 1080 / rate;
		expect(simT).toBeCloseTo(expectedExact, 3);

		// Human-facing acceptance number: three synodic periods, ~347.5 days.
		const synodicDays = EARTH_YEAR / (1 / MERCURY.period - 1) / DAY;
		expect(simT / DAY).toBeCloseTo(3 * synodicDays, 1);
		expect(simT / DAY).toBeGreaterThan(347);
		expect(simT / DAY).toBeLessThan(348);
	});
});
