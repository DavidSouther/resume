import { describe, expect, it } from "vitest";
import { fitsTable, type ScatterData, traces } from "./regression.ts";

const data: ScatterData = {
	n: 2,
	points: {
		geoid: ["36005000100", "36005000200"],
		electDist: [1001, 1002],
		poverty: [10.5, 40],
		miles: [0.2, 0.9],
	},
	fits: [1, 2, 3].map((degree) => ({
		degree,
		label: ["Linear", "Quadratic", "Cubic"][degree - 1],
		r2: 0.1 * degree,
		adjR2: 0.1 * degree,
		bic: 100 - degree,
		vertex: null,
		x: [0, 100],
		y: [0.5, 0.5],
	})),
	tests: [
		{ degrees: "1 to 2", f: 12.5, df1: 1, df2: 7000, p: 0.0004 },
		{ degrees: "2 to 3", f: 0.5, df1: 1, df2: 6999, p: 0.4 },
	],
	bestByBic: 3,
};

describe("traces", () => {
	it("plots the points, then one line per degree with the best by BIC thickest", () => {
		const t = traces(data) as { mode: string; line?: { width: number } }[];

		expect(t.map((x) => x.mode)).toEqual([
			"markers",
			"lines",
			"lines",
			"lines",
		]);
		expect(t.slice(1).map((x) => x.line?.width)).toEqual([2, 2, 4]);
	});
});

describe("fitsTable", () => {
	it("has a row per degree and the F test on every row but the first", () => {
		const rows = fitsTable(data).querySelectorAll("tbody tr");

		expect(rows).toHaveLength(3);
		expect(rows[1].textContent).toContain("p 0.0004");
		expect(rows[2].textContent).toContain("best by BIC");
	});
});
