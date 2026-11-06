// @vitest-environment jsdom
//
// Wording rules for the prewritten variants of the election findings report.
// Every variant is rendered with sentinel display strings, so the checks read
// only the words the page itself supplies.
import { describe, expect, it } from "vitest";
import { type Claim, VARIANTS, type VariantContext } from "./page.ts";

const SENTINEL = "§";

function sentinelClaim(value: string): Claim {
	return {
		value,
		rule: "",
		numbers: {},
		display: new Proxy({} as Record<string, string>, {
			get: () => SENTINEL,
		}),
		trigger_fields: [],
		evidence: [],
	};
}

const CONTEXT: VariantContext = {
	office: "house",
	leanDef: "presidential",
	lean: "swing",
	party: "DEM",
	thresholds: {
		min_comparable_races: 5,
		min_seats: 5,
		shift_points: 1,
		p_tiers: [0.05, 0.1],
		k_parity_band: [0.98, 1.02],
		dummymander_points: 1,
		min_group_races: 5,
		min_prior_years: 3,
		nearly_complete_eevp: 95,
	},
};

function rendered(): [string, string, string][] {
	return Object.entries(VARIANTS).flatMap(([family, values]) =>
		Object.entries(values).map(([value, variant]): [string, string, string] => [
			family,
			value,
			(variant(sentinelClaim(value), CONTEXT).textContent ?? "").replaceAll(
				SENTINEL,
				"",
			),
		]),
	);
}

describe("election findings variant wording", () => {
	it("uses no hyphen or dash as punctuation", () => {
		for (const [family, value, text] of rendered()) {
			expect(text, `${family}.${value}`).not.toMatch(/ [-–—] |—|–/);
		}
	});

	it("claims significance only in the Wald test families", () => {
		for (const [family, value, text] of rendered()) {
			if (family === "significance" || family === "incumbency_party_gap") {
				continue;
			}
			expect(text, `${family}.${value}`).not.toMatch(
				/signific(ant|ance) (at|level)|statistically/i,
			);
			expect(text, `${family}.${value}`).not.toMatch(/Wald/);
		}
	});

	it("never calls a difference real or caused", () => {
		for (const [family, value, text] of rendered()) {
			expect(text, `${family}.${value}`).not.toMatch(
				/\breal\b|\bcaused by\b|\bbecause of the\b/i,
			);
		}
	});

	it("states that every value with numbers uses partial or unofficial counts", () => {
		const sparse = new Set(["insufficient_data", "not_tested", "no_2026_data"]);
		for (const [family, value, text] of rendered()) {
			if (sparse.has(value)) continue;
			expect(text, `${family}.${value}`).toMatch(
				/partial|unofficial|certified/i,
			);
		}
	});
});
