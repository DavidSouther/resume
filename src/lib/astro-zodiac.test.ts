import { describe, expect, it } from "vitest";
import type { BodyName, BodyPosition } from "./astro-math.ts";
import { occupantsBySign, signOf, ZODIAC_SIGNS } from "./astro-zodiac.ts";

// Step 1 covers the PURE tropical-sign math (Contract 1: BodyPosition.angle, BodyName).
// The twelve signs each own a 30° (π/6) arc of the ecliptic anchored to the +x ray
// (angle 0 = Aries' start), increasing with angle — the geocentricTransform
// convention. signOf floors an angle into a sign; occupantsBySign buckets non-Moon
// bodies by their direction. No DOM here; the band rendering is Step 2.

/** A π/6 arc (30°). The width of one tropical sign. */
const ARC = Math.PI / 6;

/** Build a BodyPosition carrying only the fields the zodiac math reads (body, angle);
 *  x/y/radius are inert for sign math, so they are filled with sentinels. */
function at(body: BodyName, angle: number): BodyPosition {
	return { body, angle, x: 0, y: 0, radius: 0 };
}

describe("ZODIAC_SIGNS", () => {
	it("is the twelve tropical signs Aries→Pisces, each on its own 30° arc from +x", () => {
		expect(ZODIAC_SIGNS).toHaveLength(12);
		expect(ZODIAC_SIGNS.map((s) => s.id)).toEqual([
			"aries",
			"taurus",
			"gemini",
			"cancer",
			"leo",
			"virgo",
			"libra",
			"scorpio",
			"sagittarius",
			"capricorn",
			"aquarius",
			"pisces",
		]);
		// Each sign's arc starts a π/6 step further round, anchored so Aries starts
		// at the +x ray (angle 0) — Contract 1's 0 rad = 3 o'clock convention.
		ZODIAC_SIGNS.forEach((sign, i) => {
			expect(sign.startAngle).toBeCloseTo(i * ARC, 9);
		});
		// ids are unique (no accidental duplicate in the table).
		expect(new Set(ZODIAC_SIGNS.map((s) => s.id)).size).toBe(12);
	});
});

describe("signOf", () => {
	it("places an angle in the sign whose 30° arc contains it (hand-derived)", () => {
		// Mid-arc samples, derived by hand from the +x-anchored layout:
		// 0 rad starts Aries; π (= 6·π/6) starts Libra (the 7th sign, index 6).
		expect(signOf(0.1)).toBe("aries");
		expect(signOf(Math.PI)).toBe("libra"); // exactly Libra's start
		expect(signOf(Math.PI + 0.1)).toBe("libra"); // mid-Libra
		expect(signOf(11 * ARC + 0.1)).toBe("pisces"); // last arc
	});

	it("assigns an angle exactly on an arc boundary to the higher sign", () => {
		// The boundary belongs to the arc it opens, not the one it closes.
		expect(signOf(0)).toBe("aries"); // opens Aries
		expect(signOf(ARC)).toBe("taurus"); // π/6 opens Taurus, not Aries
		expect(signOf(7 * ARC)).toBe("scorpio"); // 7π/6 opens Scorpio (index 7)
	});

	it("normalizes negative angles and angles ≥ 2π into [0, 2π)", () => {
		// -0.1 wraps to just under 2π — the top of Pisces' arc.
		expect(signOf(-0.1)).toBe("pisces");
		// 2π wraps back to 0 (Aries); 2π + a Taurus offset lands in Taurus.
		expect(signOf(2 * Math.PI)).toBe("aries");
		expect(signOf(2 * Math.PI + ARC + 0.1)).toBe("taurus");
	});

	it("keeps a value within rounding error of 2π in Pisces (no index overflow)", () => {
		// A tiny negative angle normalizes to just under 2π; the boundary-epsilon
		// nudge must not push the index to a nonexistent 13th sign.
		expect(signOf(-1e-12)).toBe("pisces");
	});
});

describe("occupantsBySign", () => {
	it("buckets bodies by sign and never counts the Moon as an occupant", () => {
		const result = occupantsBySign([
			at("mars", 0.1), // Aries
			at("moon", 0.1), // Aries' arc, but the Moon is excluded
		]);
		expect(result.get("aries")).toEqual(["mars"]);
		for (const sign of ZODIAC_SIGNS) {
			expect(result.get(sign.id) ?? []).not.toContain("moon");
		}
	});

	it("counts the Sun (only the Moon is excluded)", () => {
		const result = occupantsBySign([at("sun", Math.PI + 0.1)]); // Libra
		expect(result.get("libra")).toEqual(["sun"]);
	});

	it("returns multiple occupants of one sign in input order", () => {
		const result = occupantsBySign([
			at("venus", 0.1), // Aries
			at("mercury", 0.2), // Aries
		]);
		expect(result.get("aries")).toEqual(["venus", "mercury"]);
	});

	it("yields no occupants for an empty position set", () => {
		const result = occupantsBySign([]);
		expect(result.size).toBe(0);
		for (const sign of ZODIAC_SIGNS) {
			expect(result.get(sign.id) ?? []).toEqual([]);
		}
	});
});
