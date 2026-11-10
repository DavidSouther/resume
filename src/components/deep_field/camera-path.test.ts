import { expect, it } from "vitest";
import {
	cameraPosition,
	nearestOrbitSide,
	OBLIQUE_ZOOM_TICKS,
	ORBIT_LEG_MS,
	orbitPose,
	orbitStart,
	orbitStep,
	zoomOut,
} from "./camera-path.ts";

it("moves from the telescope to a raised oblique view with four extra zoom ticks", () => {
	const start = orbitStart({ az: 0, el: 0, radius: 3 }, [0, 0, -3], 0);
	expect(orbitStep(start, 0).pose).toEqual({ az: 0, el: 0, radius: 3 });
	const end = orbitStep(start, ORBIT_LEG_MS).pose;
	expect(end.az).toBeGreaterThan(0);
	expect(end.el).toBeGreaterThan(0);
	expect(end.radius).toBeCloseTo(3 * zoomOut(OBLIQUE_ZOOM_TICKS + 4));
	expect(orbitStep(start, ORBIT_LEG_MS / 2).pose.radius).toBeGreaterThan(3);
});

it("returns through the telescope between two elevated endpoints without going below it", () => {
	const start = orbitStart({ az: 0, el: 0, radius: 3 }, [0, 0, -3], 0);
	const right = orbitStep(start, ORBIT_LEG_MS).pose;
	const telescope = orbitStep(start, ORBIT_LEG_MS * 2).pose;
	const left = orbitStep(start, ORBIT_LEG_MS * 3).pose;
	expect(telescope.az).toBeCloseTo(0);
	expect(telescope.el).toBeCloseTo(0);
	expect(telescope.radius).toBeCloseTo(3);
	expect(left.az).toBeCloseTo(-right.az);
	expect(left.el).toBeCloseTo(right.el);
	expect(left.radius).toBeCloseTo(right.radius);
	for (let t = 0; t <= ORBIT_LEG_MS * 8; t += 100) {
		expect(orbitStep(start, t).pose.el).toBeGreaterThanOrEqual(0);
	}
});

it.each([
	-1, 1,
] as const)("joins the nearer endpoint from a user view on side %s", (side) => {
	const pose = { az: side * 0.5, el: -0.3, radius: 4 };
	expect(nearestOrbitSide(pose, [0.2, 0.4, -3])).toBe(side);
	const start = orbitStart(pose, [0.2, 0.4, -3], 100);
	expect(orbitStep(start, 100).pose).toEqual(pose);
	expect(orbitStep(start, 100).target).toEqual([0.2, 0.4, -3]);
	const end = orbitStep(start, 100 + ORBIT_LEG_MS);
	expect(end.pose).toEqual(orbitPose(side, 3));
	expect(end.target).toEqual([0, 0, -3]);
	expect(orbitStep(start, 100 + ORBIT_LEG_MS * 3).pose).toEqual(
		orbitPose(-side, 3),
	);
});

it("samples the same path independently of frame rate", () => {
	const start = orbitStart({ az: 0, el: 0, radius: 3 }, [0, 0, -3], 0);
	for (let t = 0; t < 12_000; t += 1000 / 30) orbitStep(start, t);
	const slow = orbitStep(start, 12_000);
	for (let t = 0; t < 12_000; t += 1000 / 144) orbitStep(start, t);
	expect(orbitStep(start, 12_000)).toEqual(slow);
});

it("traces a U in world XY with no sideways reversal before an endpoint", () => {
	const endpoint = cameraPosition(orbitPose(1, 3), [0, 0, -3]);
	for (let i = -10; i <= 10; i++) {
		const s = i / 10;
		const position = cameraPosition(orbitPose(s, 3), [0, 0, -3]);
		expect(position[0]).toBeCloseTo(endpoint[0] * s);
		expect(position[1]).toBeCloseTo(endpoint[1] * s * s);
	}
});
