import { expect, test } from "vitest";
import { countRedshiftSources, matchCatalog } from "./catalog.ts";
import { unitToSky, type Wcs } from "./wcs.ts";

const wcs: Wcs = {
	ref: [150, 2],
	px: [1000, 500],
	dim: [2000, 1000],
	scale: [-1e-5, 1e-5], // 0.036" per pixel
	rot: 30,
};
const at = (x: number, y: number, z: number): [number, number, number] => [
	...unitToSky(wcs, x / 2000, y / 1000),
	z,
];

test("an object at a catalog position takes that redshift", () => {
	const m = matchCatalog(
		[{ id: 7, cx: 400, cy: 300 }],
		{ wcs, sources: [at(400, 300, 1.23)] },
		2000,
		1000,
	);
	expect(m.get(7)?.z).toBe(1.23);
});

test("matching scales with the loaded image width", () => {
	const m = matchCatalog(
		[{ id: 1, cx: 200, cy: 150 }],
		{ wcs, sources: [at(400, 300, 0.8)] },
		1000,
		500,
	);
	expect(m.get(1)?.z).toBe(0.8);
});

test("a distant catalog source does not match", () => {
	const m = matchCatalog(
		[{ id: 1, cx: 400, cy: 300 }],
		{ wcs, sources: [at(500, 300, 2)] },
		2000,
		1000,
	);
	expect(m.size).toBe(0);
});

test("matching is one to one and the closest pair wins", () => {
	const m = matchCatalog(
		[
			{ id: 1, cx: 400, cy: 300 },
			{ id: 2, cx: 401, cy: 300 },
		],
		{ wcs, sources: [at(400.8, 300, 3)] },
		2000,
		1000,
	);
	expect([...m.keys()]).toEqual([2]);
	expect(m.get(2)?.z).toBe(3);
});

test("redshift sources are split into catalog, estimated and manual", () => {
	const o = (id: number, cls: string, fragment = false, zCat?: number) => ({
		id,
		cls,
		fragment,
		zCat,
	});
	const counts = countRedshiftSources(
		[
			o(1, "far", false, 2),
			o(2, "far", false, 3),
			o(3, "mid"),
			o(4, "mid"),
			o(5, "star"),
			o(6, "near", true),
			o(7, "mid", false, 1),
		],
		new Map([[2, { z: 1 }]]),
	);
	expect(counts).toEqual({ catalog: 2, estimated: 2, manual: 1 });
});
