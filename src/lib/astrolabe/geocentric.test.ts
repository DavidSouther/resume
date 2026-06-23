import { assertExists } from "@davidsouther/jiffies/assert.ts";
import { describe, expect, test } from "vitest";
import { BODIES, EARTH, EARTH_YEAR } from "./bodies.ts";
import { geoDirection, radialSpokes } from "./geocentric.ts";
import { helioA } from "./math.ts";

const CX = 500;
const CY = 500;

const mars = assertExists(BODIES.get("mars"));
const moon = assertExists(BODIES.get("moon"));

describe("geoDirection", () => {
	test("matches setGeo's geocentric formula for an outer body", () => {
		const t = 0.5 * EARTH_YEAR;
		const aErad = (helioA(EARTH, t) * Math.PI) / 180;
		const arad = (helioA(mars, t) * Math.PI) / 180;
		const au = mars.au ?? 1;
		const expected =
			(Math.atan2(
				au * Math.sin(arad) - Math.sin(aErad),
				au * Math.cos(arad) - Math.cos(aErad),
			) *
				180) /
			Math.PI;

		expect(geoDirection(mars, t)).toBeCloseTo(expected, 10);
	});

	test("the Moon keeps its own helioA (Earth-orbiting in the model)", () => {
		const t = 0.3 * EARTH_YEAR;
		expect(geoDirection(moon, t)).toBeCloseTo(helioA(moon, t), 10);
	});

	test("the Sun direction is opposite Earth's heliocentric angle", () => {
		const t = 0.7 * EARTH_YEAR;
		const sun = { ...EARTH, key: "sun" };
		expect(geoDirection(sun, t)).toBeCloseTo(helioA(EARTH, t) + 180, 10);
	});

	test("Earth itself returns the Sun direction", () => {
		const t = 0.7 * EARTH_YEAR;
		expect(geoDirection(EARTH, t)).toBeCloseTo(helioA(EARTH, t) + 180, 10);
	});
});

describe("radialSpokes", () => {
	const R_INNER = 30;
	const R_MID = 197.5;
	const R_OUTER = 405;

	const radius = (s: { x1: number; y1: number; x2: number; y2: number }) =>
		Math.hypot(s.x2 - CX, s.y2 - CY);

	test("density doubles at the mid ring (120 inner, 240 outer)", () => {
		const segs = radialSpokes(120, R_INNER, R_MID, R_OUTER);
		// Inner band segments reach to rMid; outer band segments reach beyond.
		const inner = segs.filter((s) => radius(s) <= R_MID + 1e-6);
		const outer = segs.filter((s) => radius(s) > R_MID + 1e-6);
		expect(inner).toHaveLength(120);
		expect(outer).toHaveLength(240);
	});

	test("inner segments span rInner..rMid, outer span rMid..rOuter", () => {
		const segs = radialSpokes(120, R_INNER, R_MID, R_OUTER);
		for (const s of segs) {
			const r1 = Math.hypot(s.x1 - CX, s.y1 - CY);
			const r2 = Math.hypot(s.x2 - CX, s.y2 - CY);
			const lo = Math.min(r1, r2);
			const hi = Math.max(r1, r2);
			const innerBand =
				Math.abs(lo - R_INNER) < 1e-6 && Math.abs(hi - R_MID) < 1e-6;
			const outerBand =
				Math.abs(lo - R_MID) < 1e-6 && Math.abs(hi - R_OUTER) < 1e-6;
			expect(innerBand || outerBand).toBe(true);
		}
	});

	test("endpoints lie on rays from the center (collinear with center)", () => {
		const segs = radialSpokes(120, R_INNER, R_MID, R_OUTER);
		for (const s of segs) {
			// cross product of (p1-center) and (p2-center) is ~0 when collinear.
			const cross = (s.x1 - CX) * (s.y2 - CY) - (s.y1 - CY) * (s.x2 - CX);
			expect(Math.abs(cross)).toBeLessThan(1e-6);
		}
	});

	test("even angular spacing within the inner band", () => {
		const segs = radialSpokes(4, R_INNER, R_MID, R_OUTER);
		const innerAngles = segs
			.filter((s) => Math.hypot(s.x2 - CX, s.y2 - CY) <= R_MID + 1e-6)
			.map((s) => Math.atan2(s.y2 - CY, s.x2 - CX));
		expect(innerAngles).toHaveLength(4);
		// step between consecutive rays is 360/4 = 90deg = PI/2; wrap the diff to
		// (-PI, PI] so the atan2 seam (180->270 reading as -90) reads as +90.
		const wrap = (d: number) =>
			((((d + Math.PI) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI)) -
			Math.PI;
		for (let i = 1; i < innerAngles.length; i++) {
			expect(wrap(innerAngles[i] - innerAngles[i - 1])).toBeCloseTo(
				Math.PI / 2,
				10,
			);
		}
	});
});
