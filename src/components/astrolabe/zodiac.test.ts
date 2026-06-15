// @vitest-environment jsdom
//
// Functional suite for the zodiac band (F3, Step 2). One functional test class
// (the parsimony ceiling): the band's structure and its occupancy highlight.
//
// The feature test (motion.feature.test.ts) owns the cross-cutting "band rings
// the single <svg>" assertion. This suite covers the band component in isolation:
// twelve [data-sign] groups, none a [data-body], each lit per the pure occupancy
// math, the glyph <symbol> defs, and refreshOccupancy flipping a sign's lit-state
// when given a different positions set.
import { afterEach, describe, expect, it } from "vitest";
import { occupantsBySign, ZODIAC_SIGNS } from "../../lib/astro-zodiac.ts";
import { mount, resetDom } from "../test-dom.ts";
import { ephemerisPositions } from "./ephemeris.ts";
import { refreshOccupancy, ZodiacBand } from "./zodiac.ts";
import { ZODIAC_GLYPH, zodiacSymbolDefs } from "./zodiac-glyphs.ts";

afterEach(resetDom);

// Two dates whose occupancy differs, so refreshOccupancy is exercised both ways.
const DATE_A = new Date("2026-06-14T00:00:00Z");
const DATE_B = new Date("2027-01-01T00:00:00Z");

/** The sign ids lit by occupancy for a date, by the pure math (the oracle). */
function litSignIds(date: Date): string[] {
	const occupants = occupantsBySign(ephemerisPositions(date));
	return ZODIAC_SIGNS.filter(
		(sign) => (occupants.get(sign.id) ?? []).length > 0,
	).map((sign) => sign.id);
}

describe("ZodiacBand rings the dial with twelve signs lit by occupancy", () => {
	it("renders a [data-zodiac-band] of twelve [data-sign] groups, none a [data-body]", () => {
		// Arrange + Act.
		const container = mount(ZodiacBand(ephemerisPositions(DATE_A)));

		// The band wrapper carries the addressable hook.
		const band = container.querySelector("[data-zodiac-band]");
		expect(band, "expected a [data-zodiac-band] wrapper").not.toBeNull();

		// All twelve signs are present, each its own [data-sign] group, and a sign is
		// NEVER a [data-body] group (the F2 thesis invariant must not be perturbed).
		const signGroups = container.querySelectorAll("[data-sign]");
		expect(signGroups.length).toBe(12);
		for (const sign of ZODIAC_SIGNS) {
			const node = container.querySelector(`[data-sign="${sign.id}"]`);
			expect(node, `expected a [data-sign="${sign.id}"] group`).not.toBeNull();
			expect(
				(node as Element).hasAttribute("data-body"),
				`a sign must not also be a [data-body] group (${sign.id})`,
			).toBe(false);
		}
		// No [data-body] markers are introduced by the band.
		expect(container.querySelectorAll("[data-body]").length).toBe(0);
	});

	it("lights exactly the signs the occupancy math marks occupied", () => {
		// Arrange + Act.
		const container = mount(ZodiacBand(ephemerisPositions(DATE_A)));
		const expectedLit = litSignIds(DATE_A);
		expect(expectedLit.length).toBeGreaterThan(0);

		// Assert: each sign's data-occupied presence matches the oracle exactly.
		for (const sign of ZODIAC_SIGNS) {
			const node = container.querySelector(
				`[data-sign="${sign.id}"]`,
			) as Element;
			expect(
				node.hasAttribute("data-occupied"),
				`sign ${sign.id} lit-state must match occupancy math`,
			).toBe(expectedLit.includes(sign.id));
		}
	});

	it("refreshOccupancy flips lit-state both ways when given different positions", () => {
		// Arrange: render at DATE_A, then refresh to DATE_B.
		const band = ZodiacBand(ephemerisPositions(DATE_A));
		mount(band);
		const litA = litSignIds(DATE_A);
		const litB = litSignIds(DATE_B);
		// Sanity: the two dates differ so both off→on and on→off occur.
		const turnsOn = litB.filter((id) => !litA.includes(id));
		const turnsOff = litA.filter((id) => !litB.includes(id));
		expect(turnsOn.length).toBeGreaterThan(0);
		expect(turnsOff.length).toBeGreaterThan(0);

		// Act: re-light from DATE_B's positions (no rebuild).
		refreshOccupancy(band, ephemerisPositions(DATE_B));

		// Assert: every sign now matches DATE_B's oracle.
		for (const sign of ZODIAC_SIGNS) {
			const node = band.querySelector(`[data-sign="${sign.id}"]`) as Element;
			expect(
				node.hasAttribute("data-occupied"),
				`sign ${sign.id} must match DATE_B occupancy after refresh`,
			).toBe(litB.includes(sign.id));
		}
	});

	it("emits a glyph <symbol> per sign that each band wedge references via <use>", () => {
		// The defs block carries one <symbol id="zodiac-<id>"> per sign, with glyph
		// markup, and every sign's glyph string is non-empty (no stub left blank).
		const defsContainer = mount(zodiacSymbolDefs());
		const band = mount(ZodiacBand(ephemerisPositions(DATE_A)));
		for (const sign of ZODIAC_SIGNS) {
			const symbol = defsContainer.querySelector(`#zodiac-${sign.id}`);
			expect(symbol, `expected a <symbol> for ${sign.id}`).not.toBeNull();
			expect((symbol as Element).querySelector("path")).not.toBeNull();
			expect(ZODIAC_GLYPH[sign.id].length).toBeGreaterThan(0);

			// The sign's wedge references its symbol by href.
			const use = band.querySelector(`[data-sign="${sign.id}"] use`);
			expect(use, `expected a <use> in ${sign.id}'s wedge`).not.toBeNull();
			expect((use as Element).getAttribute("href")).toBe(`#zodiac-${sign.id}`);
		}
	});
});
