// @vitest-environment jsdom
//
// FEATURE TEST — Clock extraction (design.md 2026-06-08-A).
//
// User story: a reader viewing the rendered trip itinerary sees every scheduled
// clock time — flight departure and arrival, ground pickup, and event start —
// rendered as a semantic <time> element showing the clock time and timezone
// abbreviation (shaped `H:MM AM/PM TZ`, e.g. `7:25 AM EDT`). No scheduled clock
// time leaks out as a non-semantic <span>.
//
// Render path: renderTripPage with the REAL `hvar` fixture (trips/hvar/*.yaml),
// loaded via getTripItinerary — the golden sample (design §Verification). It
// exercises both scheduled-time sites in one tree: five flights with
// depart/arrive datetimes, ground transfers with pickup datetimes, and five
// events each with a `start.datetime` (the Heston dinner at 19:30 Europe/London
// is the event whose start time today renders inside a <span>).
//
// The load-bearing delta is `event.ts`: today it emits the event start time in
// a <span>; after the refactor it must call Clock(tripEvent.start), emitting
// <time>. Assertion 1 (a <time> matches the clock shape) guards the existing
// flight/ground semantics; assertion 2 (no <span> matches) is the assertion
// that stays RED until the event.ts span→time migration lands.
//
// This test stays RED until the refactor lands — it encodes the END STATE.
import { afterEach, describe, expect, it } from "vitest";
import { getTripItinerary } from "../../lib/trips.ts";
import { mount, resetDom } from "../test-dom.ts";
import { renderTripPage } from "./trip-page.ts";

afterEach(resetDom);

// A scheduled clock time, shaped `H:MM AM/PM TZ` (e.g. `7:25 AM EDT`).
const CLOCK = /^\d{1,2}:\d{2}\s(AM|PM)\s\S+/;

describe("trip itinerary scheduled times are semantic <time>", () => {
	it("renders every scheduled clock time as a <time>, never a <span>", async () => {
		// Arrange + Act: render the golden `hvar` itinerary (real, shipped data).
		const { itinerary, enrichment, wiki } = await getTripItinerary("hvar");
		const container = mount(renderTripPage(itinerary, enrichment, wiki));

		// 1. At least one <time> carries a clock string — Clock renders scheduled
		// times (flight depart/arrive, ground pickup, event start) as semantic
		// <time>. Satisfied by flight/ground today; guards against regression.
		const times = Array.from(container.querySelectorAll("time"), (e) =>
			(e.textContent ?? "").trim(),
		);
		expect(times.some((text) => CLOCK.test(text))).toBe(true);

		// 2. No <span> carries a clock string — proves the event-start span→time
		// migration. The hvar Heston dinner start (19:30 Europe/London) renders in
		// a <span> today, so this stays meaningfully RED until event.ts adopts
		// Clock.
		const spans = Array.from(container.querySelectorAll("span"), (e) =>
			(e.textContent ?? "").trim(),
		);
		expect(spans.some((text) => CLOCK.test(text))).toBe(false);
	});
});
