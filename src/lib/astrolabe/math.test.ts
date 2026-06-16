import { assertExists } from "@davidsouther/jiffies/assert.ts";
import { describe, expect, test } from "vitest";
import { BODIES, EARTH, EARTH_YEAR } from "./bodies.ts";
import {
	dialAngle,
	dirToSign,
	displayedRate,
	dragTimeStep,
	helioA,
	pt,
	SPEED_STEPS,
	speedLabel,
	speedToMul,
	wrap180,
	ZODIAC_DRAG_RATE,
} from "./math.ts";
import { GALILEAN, KEPLERIAN } from "./types.ts";

const MERCURY = assertExists(BODIES.find((b) => b.key === "mercury"));
const SATURN = assertExists(BODIES.find((b) => b.key === "saturn"));
const rateOf = (b: { period: number }) => 360 / (b.period * EARTH_YEAR);

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

	test("step 1 is 30 days per minute (43200×)", () => {
		expect(speedToMul(1)).toBeCloseTo(43_200, 5);
	});

	test("is monotone increasing across the four stops", () => {
		expect(speedToMul(1)).toBeGreaterThan(speedToMul(0));
		expect(speedToMul(2)).toBeGreaterThan(speedToMul(1));
		expect(speedToMul(3)).toBeGreaterThan(speedToMul(2));
	});

	test("clamps out-of-range indices to the nearest stop", () => {
		expect(speedToMul(-1)).toBe(SPEED_STEPS[0].mul);
		expect(speedToMul(99)).toBe(SPEED_STEPS[SPEED_STEPS.length - 1].mul);
	});
});

describe("speedLabel", () => {
	test("labels the four stops by index", () => {
		expect(speedLabel(0)).toBe("real time");
		expect(speedLabel(1)).toBe("30 days / min");
		expect(speedLabel(2)).toBe("120 days / min");
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

describe("dialAngle", () => {
	test("is East-origin clockwise degrees", () => {
		expect(dialAngle(1, 0)).toBeCloseTo(0, 6);
		expect(dialAngle(0, 1)).toBeCloseTo(90, 6); // screen y down => clockwise
		expect(dialAngle(-1, 0)).toBeCloseTo(180, 6);
	});

	test("is scale invariant", () => {
		expect(dialAngle(2, 0)).toBeCloseTo(dialAngle(1, 0), 6);
		expect(dialAngle(5, 5)).toBeCloseTo(dialAngle(1, 1), 6);
	});
});

describe("wrap180", () => {
	test("folds across the seam", () => {
		expect(wrap180(30)).toBe(30);
		expect(wrap180(-330)).toBeCloseTo(30, 6);
		expect(wrap180(190)).toBeCloseTo(-170, 6);
	});

	test("interval is (-180, 180] — upper inclusive", () => {
		expect(wrap180(180)).toBe(180);
		expect(wrap180(-180)).toBe(180);
	});

	test("multiples of 360 fold to 0", () => {
		expect(wrap180(360)).toBe(0);
		expect(wrap180(0)).toBe(0);
	});
});

describe("displayedRate", () => {
	test("synodic rate of an inner planet is positive (GALILEAN)", () => {
		const r = displayedRate(MERCURY, GALILEAN);
		expect(r).toBeGreaterThan(0);
		expect(r).toBeCloseTo(rateOf(MERCURY) - rateOf(EARTH), 12);
	});

	test("sidereal mode (KEPLERIAN) returns the bare positive rate", () => {
		expect(displayedRate(MERCURY, KEPLERIAN)).toBeCloseTo(rateOf(MERCURY), 12);
	});

	test("an outer planet has a negative synodic rate in GALILEAN mode", () => {
		expect(displayedRate(SATURN, GALILEAN)).toBeLessThan(0);
	});

	test("Earth in GALILEAN mode has zero displayed rate", () => {
		expect(displayedRate(EARTH, GALILEAN)).toBe(0);
	});

	test("Earth in KEPLERIAN mode is one turn per year", () => {
		expect(displayedRate(EARTH, KEPLERIAN)).toBeCloseTo(360 / EARTH_YEAR, 12);
	});

	test("GALILEAN matches old earthFixed===true; KEPLERIAN matches old false", () => {
		// GALILEAN carries the old earthFixed===true synodic behavior.
		expect(displayedRate(SATURN, GALILEAN)).toBeCloseTo(
			rateOf(SATURN) - rateOf(EARTH),
			12,
		);
		// KEPLERIAN carries the old earthFixed===false sidereal behavior.
		expect(displayedRate(SATURN, KEPLERIAN)).toBeCloseTo(rateOf(SATURN), 12);
	});
});

describe("dragTimeStep", () => {
	test("is the winding quotient", () => {
		const r = displayedRate(MERCURY, GALILEAN);
		expect(dragTimeStep(360, r)).toBeCloseTo(360 / r, 3);
	});

	test("a negative rate yields a negative step (direction holds)", () => {
		expect(dragTimeStep(30, -2)).toBeLessThan(0);
	});
});

describe("ZODIAC_DRAG_RATE", () => {
	test("is one day per degree, negative", () => {
		expect(ZODIAC_DRAG_RATE).toBe(-1 / 86_400);
	});
});
