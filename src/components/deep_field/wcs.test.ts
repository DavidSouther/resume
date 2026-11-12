import { expect, test } from "vitest";
import { arcsecPerPixel, skyToUnit, unitToSky, type Wcs } from "./wcs.ts";

// CEERS11 as published by ESA/Webb.
const ceers: Wcs = {
	ref: [214.96771585829865, 52.857624951398265],
	px: [4224, 2044],
	dim: [8448, 4088],
	scale: [-8.341733565613324e-6, 8.341733565613324e-6],
	rot: 49.6,
};

test("the reference value lands on the reference pixel", () => {
	const [x, y] = skyToUnit(ceers, ...ceers.ref);
	expect(x).toBeCloseTo(0.5, 9);
	expect(y).toBeCloseTo(0.5, 9);
});

test("unitToSky inverts skyToUnit", () => {
	for (const [x, y] of [
		[0.1, 0.2],
		[0.9, 0.8],
		[0.5, 0.01],
	]) {
		const [ra, dec] = unitToSky(ceers, x, y);
		const [x2, y2] = skyToUnit(ceers, ra, dec);
		expect(x2).toBeCloseTo(x, 9);
		expect(y2).toBeCloseTo(y, 9);
	}
});

test("with no rotation north is up and east is left", () => {
	const w: Wcs = { ...ceers, rot: 0 };
	const [, yN] = skyToUnit(w, w.ref[0], w.ref[1] + 0.001);
	const [xE] = skyToUnit(w, w.ref[0] + 0.001, w.ref[1]);
	expect(yN).toBeLessThan(0.5);
	expect(xE).toBeLessThan(0.5);
});

test("pixel scale follows the loaded width", () => {
	expect(arcsecPerPixel(ceers, 8448)).toBeCloseTo(0.0300302, 5);
	expect(arcsecPerPixel(ceers, 1600)).toBeCloseTo(0.158555, 4);
});
