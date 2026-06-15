import { describe, expect, test } from "vitest";
// Seam does not exist yet — the size toggle adds it. Keeps this red.
import { dialSizePx, mmToPx } from "./math.ts";

/**
 * Feature spec for the case-size toggle.
 *
 * A physical case (90mm / 42mm / 38mm) renders at its true millimeter size via the
 * CSS 96dpi reference (1mm = 96/25.4 px), clamped down to the viewport so a large
 * case cannot overflow a small screen. "Full screen" preserves today's formula
 * (`max(160, min(vw,vh) - 28)`), including its 160px floor; mm modes carry no floor.
 */
describe("astrolabe case size", () => {
	test("mmToPx uses the CSS 96dpi reference", () => {
		expect(mmToPx(25.4)).toBeCloseTo(96, 9);
		expect(mmToPx(0)).toBe(0);
	});

	test("full screen matches today's fill-the-viewport formula", () => {
		expect(dialSizePx("full", 1000, 800)).toBe(772);
	});

	test("full screen honors the 160px floor on tiny viewports", () => {
		expect(dialSizePx("full", 100, 100)).toBe(160);
	});

	test("mm cases render at their physical size when they fit", () => {
		expect(dialSizePx("48", 1000, 800)).toBeCloseTo((48 * 96) / 25.4, 6);
		expect(dialSizePx("38", 1000, 800)).toBeCloseTo((38 * 96) / 25.4, 6);
		expect(dialSizePx("90", 1000, 800)).toBeCloseTo((90 * 96) / 25.4, 6);
	});

	test("mm cases carry no 160px floor (true size below the floor)", () => {
		// 38mm ≈ 143.6px, below the full-screen floor — must not be inflated.
		expect(dialSizePx("38", 1000, 800)).toBeLessThan(160);
	});

	test("a case larger than the viewport clamps down to fit", () => {
		expect(dialSizePx("90", 200, 200)).toBe(172);
	});
});
