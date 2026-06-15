import { describe, expect, test } from "vitest";
import { BODIES, EARTH_YEAR } from "./bodies.ts";
import { dirToSign, helioA, pt, speedLabel, speedToMul } from "./math.ts";

const earth = BODIES.find((b) => b.key === "earth")!;

describe("helioA", () => {
	test("one full Earth orbit returns to start angle", () => {
		const angle = helioA(earth, EARTH_YEAR);
		expect(angle).toBeCloseTo(earth.start, 0);
	});

	test("wraps correctly past 360°", () => {
		const angle = helioA(earth, EARTH_YEAR * 2.5);
		expect(angle).toBeGreaterThanOrEqual(0);
		expect(angle).toBeLessThan(360);
	});

	test("t=0 returns start angle", () => {
		expect(helioA(earth, 0)).toBeCloseTo(earth.start, 5);
	});
});

describe("pt", () => {
	test("angle 0 returns point directly above centre (cx, cy - R)", () => {
		const { x, y } = pt(0, 100);
		expect(x).toBeCloseTo(500, 1);
		expect(y).toBeCloseTo(400, 1);
	});

	test("angle 90 returns point to the right of centre (cx + R, cy)", () => {
		const { x, y } = pt(90, 100);
		expect(x).toBeCloseTo(600, 1);
		expect(y).toBeCloseTo(500, 1);
	});

	test("angle 180 returns point directly below centre (cx, cy + R)", () => {
		const { x, y } = pt(180, 100);
		expect(x).toBeCloseTo(500, 1);
		expect(y).toBeCloseTo(600, 1);
	});

	test("angle 270 returns point to the left of centre (cx - R, cy)", () => {
		const { x, y } = pt(270, 100);
		expect(x).toBeCloseTo(400, 1);
		expect(y).toBeCloseTo(500, 1);
	});
});

describe("speedToMul", () => {
	test("v=0 returns 1 (real time)", () => {
		expect(speedToMul(0)).toBeCloseTo(1, 5);
	});

	test("is monotone increasing", () => {
		expect(speedToMul(1)).toBeGreaterThan(speedToMul(0.5));
		expect(speedToMul(0.5)).toBeGreaterThan(speedToMul(0.25));
	});
});

describe("speedLabel", () => {
	test("returns 'real time' for multiplier below 1.5", () => {
		expect(speedLabel(1)).toBe("real time");
		expect(speedLabel(1.4)).toBe("real time");
	});

	test("returns multiplier with × for 2–3600", () => {
		expect(speedLabel(100)).toBe("100×");
	});

	test("returns hr/s for 3600–86400", () => {
		expect(speedLabel(7200)).toBe("2.0 hr/s");
	});

	test("returns day/s above 86400", () => {
		expect(speedLabel(172_800)).toBe("2.0 day/s");
	});
});

describe("dirToSign", () => {
	test("straight up from centre returns sign index 0 (Aries) with no rotation", () => {
		// Up from centre (500,500) means target at (500, 400) — 12 o'clock = 0°
		const { si, deg } = dirToSign(500, 500, 500, 400, 0);
		expect(si).toBe(0);
		expect(deg).toBeGreaterThanOrEqual(0);
		expect(deg).toBeLessThan(30);
	});
});
