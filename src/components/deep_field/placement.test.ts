import { afterEach, expect, it } from "vitest";
import { estimate } from "./placement.ts";
import { type Obj, S } from "./state.ts";

afterEach(() => {
	S.objs = [];
	S.over.clear();
});

it("respects a fragment's zero redshift while unoverridden fragments follow their leader", () => {
	S.objs = [
		{ id: 1, group: 1, det: "near", fragment: false },
		{ id: 2, group: 1, det: "near", fragment: true },
		{ id: 3, group: 1, det: "near", fragment: true },
	] as Obj[];
	S.over.set(1, { z: 0.3 });
	S.over.set(2, { z: 0 });
	estimate();
	expect(S.objs.map((o) => o.z)).toEqual([0.3, 0, 0.3]);
});

it("places a catalog-matched source at its catalog redshift and an override still wins", () => {
	S.objs = [
		{
			id: 1,
			group: 1,
			det: "far",
			fragment: false,
			area: 10,
			color: 0,
			zCat: 3.2,
		},
		{
			id: 2,
			group: 2,
			det: "far",
			fragment: false,
			area: 20,
			color: 0,
			zCat: 1.1,
		},
		{ id: 3, group: 3, det: "far", fragment: false, area: 30, color: 0 },
	] as Obj[];
	S.over.set(2, { z: 5 });
	estimate();
	expect(S.objs[0].z).toBe(3.2);
	expect(S.objs[1].z).toBe(5);
	expect(S.objs[2].z).toBeGreaterThanOrEqual(2);
});
