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
