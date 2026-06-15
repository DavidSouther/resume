import { describe, expect, test } from "vitest";
import { EARTH, EARTH_YEAR } from "./bodies.ts";
import {
	dirToSign,
	helioA,
	pt,
	SPEED_STEPS,
	speedLabel,
	speedToMul,
} from "./math.ts";

describe("helioA", () => {
	test("one full Earth orbit returns to start angle", () => {
		const angle = helioA(EARTH, EARTH_YEAR);
		expect(angle).toBeCloseTo(EARTH.start, 0);
	});

	test("wraps correctly past 360°", () => {
		const angle = helioA(EARTH, EARTH_YEAR * 2.5);
		expect(angle).toBeGreaterThanOrEqual(0);
		expect(angle).toBeLessThan(360);
	});

	test("t=0 returns start angle", () => {
		expect(helioA(EARTH, 0)).toBeCloseTo(EARTH.start, 5);
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
	test("step 0 is real time (1×)", () => {
		expect(speedToMul(0)).toBe(1);
	});

	test("is monotone increasing across the four stops", () => {
		expect(speedToMul(1)).toBeGreaterThan(speedToMul(0));
		expect(speedToMul(2)).toBeGreaterThan(speedToMul(1));
		expect(speedToMul(3)).toBeGreaterThan(speedToMul(2));
	});

	test("step 2 is one day per minute (1440×)", () => {
		expect(speedToMul(2)).toBeCloseTo(1440, 5);
	});

	test("clamps out-of-range indices to the nearest stop", () => {
		expect(speedToMul(-1)).toBe(SPEED_STEPS[0].mul);
		expect(speedToMul(99)).toBe(SPEED_STEPS[SPEED_STEPS.length - 1].mul);
	});
});

describe("speedLabel", () => {
	test("labels the four stops by index", () => {
		expect(speedLabel(0)).toBe("real time");
		expect(speedLabel(1)).toBe("5×");
		expect(speedLabel(2)).toBe("1 day / min");
		expect(speedLabel(3)).toBe("1 year / min");
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
