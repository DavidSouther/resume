// @vitest-environment jsdom
//
// FEATURE TEST — trip semantic-HTML refactor (design.md 2026-06-07-C).
//
// User story: a reader views a rendered trip itinerary and its markup is
// semantic. Trip facts are a description list (dl > dt + dd); "To book" items
// are <mark>; timeline items are native disclosures (li > details > summary) or
// flat panels (li > section > header) — never hand-built div.card/div.row;
// actions are button-role links (a[role="button"]); the timeline is ol > li
// with NO presentational classes. No orphaned class from the deleted trip.css
// survives in the trip DOM.
//
// Render path: renderTripPage with the REAL `hvar` fixture (trips/hvar/*.yaml),
// loaded via getTripItinerary — the golden sample (design §6). It exercises the
// whole story in one tree: Facts (confirmed events carry Location/Note pairs),
// to-book flags (3 to_book events), expandable disclosures (every item with a
// detail), and action groups (BtnLink rows from enrichment activities). No
// parallel fixture is invented; this is the same data the page ships.
//
// This test stays RED until the entire refactor lands — it encodes the END
// STATE, not an increment.
import { afterEach, describe, expect, it } from "vitest";
import { getTripItinerary } from "../../lib/trips.ts";
import { mount, resetDom } from "../test-dom.ts";
import { renderTripPage } from "./trip-page.ts";

afterEach(resetDom);

describe("trip itinerary markup is semantic", () => {
	it("renders the whole story as semantic markup", async () => {
		// Arrange + Act: render the golden `hvar` itinerary (real, shipped data).
		const { itinerary, enrichment, wiki } = await getTripItinerary("hvar");
		const container = mount(renderTripPage(itinerary, enrichment, wiki));

		// 1. Facts are a description list: dl > dt + dd, equal non-zero counts.
		// Assert across ALL dt/dd (not the first dl) so the check does not depend
		// on which facts block renders first. The Location pair from the Heston
		// dinner event proves the label/value semantics carry through.
		const dts = Array.from(container.querySelectorAll("dl > dt"), (e) =>
			(e.textContent ?? "").trim(),
		);
		const dds = Array.from(container.querySelectorAll("dl > dd"), (e) =>
			(e.textContent ?? "").trim(),
		);
		expect(dts.length).toBeGreaterThan(0);
		expect(dts.length).toBe(dds.length);
		expect(dts).toContain("Location");
		expect(dds).toContain("Mandarin Oriental Hyde Park, London");
		expect(container.querySelector("ul.facts")).toBeNull();

		// 2. The "To book" status flag is a <mark>; no .badge class survives.
		const marks = Array.from(container.querySelectorAll("mark"));
		expect(marks.some((m) => (m.textContent ?? "").includes("To book"))).toBe(
			true,
		);
		expect(container.querySelector(".badge")).toBeNull();

		// 3. At least one expandable timeline item is a native disclosure.
		expect(
			container.querySelector("ol > li > details > summary"),
		).not.toBeNull();

		// 4. No hand-built div.card, and the inert `card` class is gone from the
		// details surfaces (timeline items use jiffies primitives — Accordion's
		// `details` and Panel's `section`, neither of which carries `.card`).
		// NB: a bare `div.row` is NOT forbidden — the action group is the
		// sanctioned `.flex.row` utility (§3); the hand-built timeline row is
		// caught by `div.card` / `.card` being absent instead.
		expect(container.querySelector("div.card")).toBeNull();
		expect(container.querySelector("details.card")).toBeNull();
		expect(container.querySelector(".card")).toBeNull();

		// 5. Action group: button-role links present; old `.links` container gone.
		expect(container.querySelector('a[role="button"]')).not.toBeNull();
		expect(container.querySelector(".links")).toBeNull();

		// 6. Timeline is ol > li with NO presentational classes anywhere in the
		// rendered subtree.
		expect(container.querySelector("ol > li")).not.toBeNull();
		for (const cls of [
			"li.item",
			".tl",
			".title",
			".sub",
			".facts",
			".route",
			".eyebrow",
			".node",
			".row-main",
		]) {
			expect(container.querySelector(cls)).toBeNull();
		}
	});
});
