// @vitest-environment jsdom
import { describe, expect, it } from "vitest";
import { card, cardRows } from "./cards.ts";

describe("nyc polling cards", () => {
	it("a piece shows its site, distance, then tract facts", () => {
		const rows = cardRows({
			name: "36005000200 / AD 85 ED 002",
			kind: "piece",
			site: "1980 Lafayette Avenue",
			miles: 0.884,
			population: 5061,
			povertyPct: 12.94,
			incomeUsd: 123729,
		});

		expect(rows).toEqual([
			["Assigned site", "1980 Lafayette Avenue"],
			["Distance", "0.88 miles"],
			["Population", "5,061"],
			["Poverty rate", "12.9%"],
			["Median income", "$123,729"],
		]);
	});

	it("a zero population tract shows only its population", () => {
		expect(
			cardRows({
				name: "x",
				kind: "tract",
				geoid: "36005000100",
				population: 0,
			}),
		).toEqual([
			["GEOID", "36005000100"],
			["Population", "0"],
		]);
	});

	it("a site shows margins and says when income is missing", () => {
		const rows = cardRows({
			name: "99 Terrace View Avenue",
			kind: "site",
			siteName: "John F Kennedy HS",
			geoid: "36061030900",
			population: 10253,
			povertyPct: 36.7,
			povertyMoe: 10.1,
		});

		expect(rows).toContainEqual(["Poverty rate", "36.7% (±10.1)"]);
		expect(rows).toContainEqual(["Median income", "not available"]);
	});

	it("a site outside every tract says so and has no facts", () => {
		expect(cardRows({ name: "x", kind: "site" })).toEqual([
			["Tract", "not found (outside tract boundaries)"],
		]);
	});

	it("renders text, never markup", () => {
		const el = card({
			name: "<img src=x onerror=alert(1)>",
			kind: "tract",
			geoid: "1",
			population: 0,
		});

		expect(el.querySelector("img")).toBeNull();
		expect(el.textContent).toContain("<img src=x");
	});
});
