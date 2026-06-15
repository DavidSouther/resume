// @vitest-environment jsdom
//
// FEATURE TEST — F3: Motion & Sky (design.md 2026-06-14-D).
//
// User story (Given/When/Then):
//   GIVEN a reader opens /astrolabe/ on the populated F2 dial,
//   WHEN the Astrolabe renders with motion & sky,
//   THEN a Realtime/Fast button sits ON THE CASE, OUTSIDE the controls sheet
//        (the sanctioned two-state deviation from the spec's exponential slider);
//   AND the dial is ringed by the twelve tropical zodiac signs at the outer
//        radius, inside the SAME single <svg> (no second <svg>, the signs are
//        NOT [data-body] groups — the F2 thesis invariant is preserved);
//   AND at least one sign is lit by occupancy (a body in its arc), and the Moon
//        is NEVER counted as an occupant;
//   AND the always-visible controls carry the geocentric/orbital render-mode
//        switch.
//
// jsdom-friendly and STRUCTURAL by design: the truly visual/motion behavior —
// ~60fps rAF motion, the mousemove parallax shift, hands hiding in Fast, and
// orbital-mode correctness — is browser-verified in the build phase with
// playwright-cli, not unit-asserted here (design §Summary).
//
// It stays RED until F3 is built. It fails for the RIGHT reason at the start:
// the F3 modules (./speed-toggle.ts, ./zodiac.ts, ../../lib/astro-zodiac.ts) and
// their markup do not exist yet — a missing-component failure, not a syntax error.
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { occupantsBySign, ZODIAC_SIGNS } from "../../lib/astro-zodiac.ts";
import { mount, resetDom } from "../test-dom.ts";
import { Astrolabe } from "./astrolabe.ts";
import { ephemerisPositions } from "./ephemeris.ts";

beforeEach(() => {
	// Always-visible vs debugOnly is exercised deterministically off a clean hash.
	window.location.hash = "";
});
afterEach(resetDom);

describe("F3 astrolabe runs the sky forward and rings it with the zodiac", () => {
	it("renders the Realtime/Fast case button, the twelve-sign zodiac band with occupancy, and the always-visible render-mode switch", () => {
		// Arrange + Act: render the full astrolabe (shell + dial + motion & sky).
		const container = mount(Astrolabe());

		// 1. The Realtime/Fast button sits on the case, OUTSIDE the controls sheet.
		//    (F1's shell shipped NO such button; F3 adds it — the design records this
		//    expected feature-progression flip.)
		const toggle = container.querySelector("[data-speed-toggle]");
		expect(
			toggle,
			"expected a Realtime/Fast button on the case",
		).not.toBeNull();
		expect((toggle as Element).tagName.toLowerCase()).toBe("button");
		expect((toggle as Element).textContent ?? "").toMatch(/realtime|fast/i);
		// It is NOT nested inside the controls sheet host.
		const controlsHost = container.querySelector("[data-astrolabe-controls]");
		expect(controlsHost).not.toBeNull();
		expect((controlsHost as Element).contains(toggle)).toBe(false);

		// 2. The F2 single-<svg> invariant holds, and the zodiac band rings it.
		const svgs = container.querySelectorAll("svg");
		expect(svgs.length).toBe(1);
		const band = container.querySelector("[data-zodiac-band]");
		expect(band, "expected a zodiac band on the dial").not.toBeNull();

		// 3. All twelve tropical signs are present as [data-sign] groups, and a sign
		//    is NEVER a [data-body] group (it must not perturb the thesis test's
		//    nine-body count).
		for (const sign of ZODIAC_SIGNS) {
			const node = container.querySelector(`[data-sign="${sign.id}"]`);
			expect(node, `expected a [data-sign="${sign.id}"] group`).not.toBeNull();
			expect(
				(node as Element).hasAttribute("data-body"),
				`a sign must not also be a [data-body] group (${sign.id})`,
			).toBe(false);
		}

		// 4. Occupancy highlight: at least one sign is lit (data-occupied), and the
		//    lit set matches the pure occupancy math over the rendered positions —
		//    with the Moon NEVER an occupant.
		const occupants = occupantsBySign(ephemerisPositions(new Date()));
		const occupiedSignIds = ZODIAC_SIGNS.filter(
			(sign) => (occupants.get(sign.id) ?? []).length > 0,
		).map((sign) => sign.id);
		expect(occupiedSignIds.length).toBeGreaterThan(0);
		for (const sign of ZODIAC_SIGNS) {
			const node = container.querySelector(
				`[data-sign="${sign.id}"]`,
			) as Element;
			const lit = node.hasAttribute("data-occupied");
			expect(lit, `sign ${sign.id} lit-state must match occupancy math`).toBe(
				occupiedSignIds.includes(sign.id),
			);
		}
		// The Moon is excluded from every sign's occupant list.
		for (const sign of ZODIAC_SIGNS) {
			expect(
				occupants.get(sign.id) ?? [],
				`the Moon must never be a sign occupant (${sign.id})`,
			).not.toContain("moon");
		}

		// 5. The always-visible controls carry the geocentric/orbital render-mode
		//    switch (no #debug hash needed).
		const sheetText = (controlsHost as Element).textContent ?? "";
		expect(sheetText.toLowerCase()).toMatch(/geocentric/);
		expect(sheetText.toLowerCase()).toMatch(/orbital/);
	});
});
