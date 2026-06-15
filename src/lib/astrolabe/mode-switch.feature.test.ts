import { describe, expect, test } from "vitest";
// Helpers do not exist yet — the mode-switch bugfix adds them. Keeps this red.
import { caseOffsetPreservingRot, dialRotation } from "./math.ts";

/**
 * Reproduction (bugfix shape) for the mode-switch jump:
 *
 *   Observed: toggling Earth between Stationary and Orbital snaps the dial — the
 *             `360 - aE` earth-fixed term appears/disappears, so Earth jumps to a
 *             different screen angle.
 *   Expected: Earth stays put at its current relative angle across the switch;
 *             the case angle (caseOffset) absorbs the difference so the dial
 *             rotation is continuous.
 *
 * `dialRotation` is the rotation applied to the whole dial; `caseOffsetPreservingRot`
 * returns the caseOffset for the new mode that keeps `dialRotation` unchanged.
 */
describe("astrolabe mode switch — Earth holds its angle", () => {
	const cases = [
		{ aE: 0, caseOffset: 0 },
		{ aE: 73.4, caseOffset: 0 },
		{ aE: 215.9, caseOffset: 48 },
		{ aE: 359.99, caseOffset: -130 },
	];

	for (const { aE, caseOffset } of cases) {
		test(`orbital → fixed stays continuous (aE=${aE})`, () => {
			const before = dialRotation(false, aE, caseOffset);
			const next = caseOffsetPreservingRot(true, aE, caseOffset);
			expect(dialRotation(true, aE, next)).toBeCloseTo(before, 9);
		});

		test(`fixed → orbital stays continuous (aE=${aE})`, () => {
			const before = dialRotation(true, aE, caseOffset);
			const next = caseOffsetPreservingRot(false, aE, caseOffset);
			expect(dialRotation(false, aE, next)).toBeCloseTo(before, 9);
		});
	}
});
