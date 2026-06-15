import { describe, expect, it } from "vitest";
import {
	geocentricPositions,
	geocentricTransform,
	logRadius,
	PLANET_ORDER,
	R_INNER,
	R_OUTER,
	SEMI_MAJOR_AXIS_AU,
} from "./astro-math.ts";
import type { BodyName } from "./astro-tokens.ts";

// Step 1 covers the DATE-INDEPENDENT half of the coordinate system (Contract 1):
// the semi-major-axis table, the planet ring ordering, the log-radial map, and the
// polar->Cartesian transform that pins angle 0 onto the +x ray (3 o'clock).
// geocentricPositions (date-dependent) is Step 2 and is not exercised here.
describe("astro-math coordinate constants", () => {
	it("orders the eight planets ascending by semi-major axis, excluding sun and moon", () => {
		expect(PLANET_ORDER).toEqual([
			"mercury",
			"venus",
			"earth",
			"mars",
			"jupiter",
			"saturn",
			"uranus",
			"neptune",
		]);
		// The ring is the eight planets only; the Sun (center) and Moon (rides
		// Earth) are not ringed by their axis.
		expect(PLANET_ORDER).toHaveLength(8);
		expect(PLANET_ORDER).not.toContain("sun");
		expect(PLANET_ORDER).not.toContain("moon");
	});

	it("keeps SEMI_MAJOR_AXIS_AU strictly increasing across PLANET_ORDER", () => {
		for (let i = 1; i < PLANET_ORDER.length; i++) {
			expect(SEMI_MAJOR_AXIS_AU[PLANET_ORDER[i]]).toBeGreaterThan(
				SEMI_MAJOR_AXIS_AU[PLANET_ORDER[i - 1]],
			);
		}
		// The Sun sits at center; its axis sentinel is 0.
		expect(SEMI_MAJOR_AXIS_AU.sun).toBe(0);
	});
});

describe("logRadius", () => {
	it("is strictly increasing across the planet ring", () => {
		const radii = PLANET_ORDER.map((body) =>
			logRadius(SEMI_MAJOR_AXIS_AU[body]),
		);
		for (let i = 1; i < radii.length; i++) {
			expect(radii[i]).toBeGreaterThan(radii[i - 1]);
		}
	});

	it("anchors Mercury's axis to R_INNER and Neptune's to R_OUTER", () => {
		expect(logRadius(0.387)).toBeCloseTo(R_INNER, 5);
		expect(logRadius(30.1)).toBeCloseTo(R_OUTER, 5);
	});

	it("stays within [R_INNER, R_OUTER] for every planet", () => {
		for (const body of PLANET_ORDER) {
			const r = logRadius(SEMI_MAJOR_AXIS_AU[body]);
			expect(r).toBeGreaterThanOrEqual(R_INNER - 1e-6);
			expect(r).toBeLessThanOrEqual(R_OUTER + 1e-6);
		}
	});

	it("is linear in log10(a), not linear in a (catches a linear-in-AU bug)", () => {
		// Hand-computed interior check. The geometric mean of the Mercury and
		// Neptune anchors (sqrt(0.387 * 30.1) ~ 3.4136 AU) sits exactly halfway in
		// log space, so its radius is the midpoint (R_INNER + R_OUTER) / 2.
		// A linear-in-AU map would instead place a ~ 15.24 AU at the midpoint, so
		// this value is wrong under that bug.
		const aMid = Math.sqrt(0.387 * 30.1);
		expect(logRadius(aMid)).toBeCloseTo((R_INNER + R_OUTER) / 2, 5);
		// Mars at 1.524 AU is well below the AU midpoint but above the log midpoint:
		// in a linear-in-AU map its fraction would be ~0.04; in log space it is ~0.31.
		const marsFraction = (logRadius(1.524) - R_INNER) / (R_OUTER - R_INNER);
		expect(marsFraction).toBeGreaterThan(0.25);
		expect(marsFraction).toBeLessThan(0.4);
	});
});

describe("geocentricTransform", () => {
	it("pins angle 0 onto the +x ray (3 o'clock): x > 0, y near 0", () => {
		const { x, y } = geocentricTransform(0, R_OUTER);
		expect(x).toBeGreaterThan(0);
		expect(x).toBeCloseTo(R_OUTER, 5);
		expect(Math.abs(y)).toBeLessThan(1e-9);
	});

	it("returns the center for radius 0 (the Sun)", () => {
		const { x, y } = geocentricTransform(0, 0);
		expect(x).toBeCloseTo(0, 9);
		expect(y).toBeCloseTo(0, 9);
	});

	it("sends a quarter turn to a perpendicular axis with +y downward", () => {
		// A quarter turn from the +x ray lands on the y axis (x near 0). With the
		// SVG +y-down convention, +pi/2 goes DOWN (y > 0), not up.
		const { x, y } = geocentricTransform(Math.PI / 2, R_OUTER);
		expect(Math.abs(x)).toBeLessThan(1e-9);
		expect(y).toBeGreaterThan(0);
		expect(y).toBeCloseTo(R_OUTER, 5);
	});

	it("preserves the radius as the distance from center", () => {
		const { x, y } = geocentricTransform(1.234, 200);
		expect(Math.hypot(x, y)).toBeCloseTo(200, 5);
	});
});

// Step 2: the DATE-DEPENDENT half of the coordinate system (Contract 1).
// geocentricPositions(date) places every body for a given date. The thesis is
// encoded in data: Earth is held on the +x ray (3 o'clock) for EVERY date, the
// Sun sits at center, planet radii are a fixed log scaling of semi-major axis
// (date-invariant), and only the angles change with the date.
describe("geocentricPositions", () => {
	// The ten bodies the dial renders, listed independently of PLANET_ORDER so a
	// drift in the returned set (a dropped Sun or Moon) is caught here.
	const ALL_BODIES: readonly BodyName[] = [
		"sun",
		"mercury",
		"venus",
		"earth",
		"moon",
		"mars",
		"jupiter",
		"saturn",
		"uranus",
		"neptune",
	];

	// Three dates spanning the epoch, the build date, and a future date — the
	// thesis assertions must hold for all of them.
	const DATES = [
		new Date("2000-01-01T12:00:00Z"),
		new Date("2026-06-14T00:00:00Z"),
		new Date("2099-12-31T00:00:00Z"),
	];

	function findBody(date: Date, body: BodyName) {
		const position = geocentricPositions(date).find((p) => p.body === body);
		if (!position) {
			throw new Error(`missing body ${body}`);
		}
		return position;
	}

	it("returns exactly the ten bodies with no duplicates", () => {
		const bodies = geocentricPositions(DATES[1]).map((p) => p.body);
		expect(bodies.sort()).toEqual([...ALL_BODIES].sort());
	});

	it("pins Earth on the +x ray (3 o'clock) for every date — the thesis", () => {
		for (const date of DATES) {
			const earth = findBody(date, "earth");
			expect(earth.x).toBeGreaterThan(0);
			expect(Math.abs(earth.y)).toBeLessThan(0.5);
		}
	});

	it("places the Sun at the center (radius 0) for every date", () => {
		for (const date of DATES) {
			const sun = findBody(date, "sun");
			expect(sun.radius).toBe(0);
			expect(Math.abs(sun.x)).toBeLessThan(0.5);
			expect(Math.abs(sun.y)).toBeLessThan(0.5);
		}
	});

	it("rides the Moon on Earth's anchor: offset from Earth and off-center", () => {
		const earth = findBody(DATES[1], "earth");
		const moon = findBody(DATES[1], "moon");
		// The Moon is distinct from Earth's anchor and from the dial center.
		const offsetFromEarth = Math.hypot(moon.x - earth.x, moon.y - earth.y);
		expect(offsetFromEarth).toBeGreaterThan(0);
		expect(Math.hypot(moon.x, moon.y)).toBeGreaterThan(0.5);
		// It reads as a satellite, not a tenth ring — close to Earth, not flung out.
		expect(offsetFromEarth).toBeLessThan(R_INNER);
	});

	it("sets each planet's radius to logRadius of its semi-major axis", () => {
		for (const body of PLANET_ORDER) {
			const position = findBody(DATES[1], body);
			expect(position.radius).toBeCloseTo(
				logRadius(SEMI_MAJOR_AXIS_AU[body]),
				9,
			);
			// (x, y) is the polar placement of (angle, radius).
			expect(Math.hypot(position.x, position.y)).toBeCloseTo(
				position.radius,
				9,
			);
		}
	});

	it("keeps radii date-invariant but moves angles across dates", () => {
		// A planet whose geocentric direction visibly changes over a century.
		const a = geocentricPositions(DATES[0]);
		const b = geocentricPositions(DATES[2]);
		for (const body of PLANET_ORDER) {
			if (body === "earth") {
				continue; // Earth is pinned; its angle is constant by design.
			}
			const pa = a.find((p) => p.body === body);
			const pb = b.find((p) => p.body === body);
			if (!pa || !pb) {
				throw new Error(`missing body ${body}`);
			}
			// Radius is a fixed function of the axis — identical across dates.
			expect(pb.radius).toBeCloseTo(pa.radius, 9);
			// The angle is date-driven — it moves over a century.
			expect(pb.angle).not.toBeCloseTo(pa.angle, 3);
		}
	});
});
