// @vitest-environment jsdom
//
// FEATURE TEST — trip prep "Before you go" panel (design.md 2026-06-07-A-entry-requirements).
//
// User story: a reader opens the rendered `hvar` trip page. Because the trip's
// enrichment now carries a `trip_prep` block (plus a `meta.travelers` registry),
// the page shows a failure-silent "Before you go" panel. The panel lists the
// prep checklist items with their labels, surfaces a visible status for each,
// and — for rule-bearing items — links out to an authoritative government
// source. When the `trip_prep` data is absent, the page renders exactly as it
// did before (failure-silent parity, matching existing enrichment).
//
// Render path: getTripItinerary("hvar") (src/lib/trips.ts) loads the committed
// trips/hvar/enrichment.yaml (failure-silent) into `enrichment: TripEnrichment`
// (src/lib/trip-enrichment.d.ts). TripPage({ itinerary, enrichment, wiki })
// (src/components/trip/trip-page.ts) renders the page via Layout(...). The new
// "Before you go" panel is emitted from `enrichment.trip_prep`; its time signals
// (the departure-relative staleness band of `trip_prep.checked_on`) derive
// against the trip's departure date (itinerary.trip.start_date = 2026-07-11).
//
// This is the REAL `hvar` fixture (trips/hvar/*.yaml + wiki-cache.json), the same
// data the page ships. The asserted values come from the design's Worked Example
// (Hvar): a "UK ETA" checklist item, an action_needed status, and a gov.uk /
// europa.eu source link. No parallel fixture is invented — implementation will
// author meta.travelers + trip_prep into trips/hvar/enrichment.yaml.
//
// This test encodes the END STATE and stays RED until the whole feature lands:
//   - TripEnrichment must gain `trip_prep` (TripPrep) and `meta.travelers`
//     (Traveler[]) in src/lib/trip-enrichment.d.ts,
//   - trips/hvar/enrichment.yaml must carry the Worked-Example trip_prep block,
//   - TripPage must render a "Before you go" region from trip_prep.
// None of that exists yet — that compile-time + assertion gap is the intended
// initial RED state (type-first TDD).
//
// OBSERVABLE CONTRACT (the binding the plan/implementers must honor; markup and
// placement are deferred to the plan phase, so this asserts observable SEMANTICS,
// not brittle markup):
//   - The trip-prep region is LOCATED by a heading whose text contains
//     "Before you go" (case-insensitive); the region is that heading's nearest
//     enclosing <section> (or, failing a <section>, the heading's parent). The
//     plan may choose any markup so long as this heading exists and the checklist
//     content lives inside that enclosing region.
//   - Status is surfaced "somehow" inside the region — as text or as an attribute
//     value — drawn from PrepStatus (action_needed | in_progress | done |
//     no_action). The assertion stays loose: at least one of the four tokens (or
//     a humanized "action needed") appears in the region's text OR in a
//     data-/status attribute on a descendant.
import { afterEach, describe, expect, it } from "vitest";
import { getTripItinerary } from "../../lib/trips.ts";
import { mount, resetDom } from "../test-dom.ts";
import { TripPage } from "./trip-page.ts";

afterEach(resetDom);

// Authoritative government source: gov.uk (UK ETA) or europa.eu (Schengen).
const GOV_SOURCE = /\.gov(\.uk)?\/|europa\.eu/;
// PrepStatus tokens (raw or humanized) — kept loose: the plan picks the treatment.
const PREP_STATUS =
	/action[_\s-]?needed|in[_\s-]?progress|no[_\s-]?action|\bdone\b/i;
// A day-group header carries a date-only datetime key (e.g. "2026-07-11"),
// distinct from clock <time> elements that carry a full datetime. Counting these
// gives a stable per-day-group signal that trip_prep must not perturb.
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

// Locate the "Before you go" region: find the heading by its text, then return
// its nearest enclosing <section> (falling back to the heading's parent). This
// is the chosen stable contract; everything else inside is the plan's choice.
function findPrepRegion(container: HTMLElement): HTMLElement | null {
	const headings = Array.from(
		container.querySelectorAll("h1,h2,h3,h4,h5,h6"),
	) as HTMLElement[];
	const heading = headings.find((h) =>
		/before you go/i.test(h.textContent ?? ""),
	);
	if (!heading) return null;
	return (
		(heading.closest("section") as HTMLElement | null) ?? heading.parentElement
	);
}

function dayGroupCount(container: HTMLElement): number {
	return Array.from(container.querySelectorAll("time[datetime]")).filter((t) =>
		DAY_KEY.test(t.getAttribute("datetime") ?? ""),
	).length;
}

describe("trip page renders a failure-silent Before-you-go prep panel", () => {
	it("shows the prep checklist with labels, status, and gov source links, and is absent without trip_prep", async () => {
		// Arrange + Act: render the golden `hvar` itinerary with its committed
		// enrichment (which will carry the Worked-Example trip_prep block).
		const { itinerary, enrichment, wiki } = await getTripItinerary("hvar");
		const withPrep = mount(TripPage({ itinerary, enrichment, wiki }));

		// 1. The "Before you go" region exists (the chosen heading contract).
		const region = findPrepRegion(withPrep);
		expect(region).not.toBeNull();
		const regionText = region?.textContent ?? "";

		// 2. At least one checklist item is present with its label text. The
		// Worked Example (Hvar) authors a "UK ETA" item for the two US travelers.
		expect(regionText).toMatch(/UK ETA/i);

		// 3. At least one rule-bearing item links out to an authoritative
		// government source (gov.uk for the UK ETA, europa.eu for Schengen).
		const govLink = Array.from(region?.querySelectorAll("a") ?? []).find((a) =>
			GOV_SOURCE.test(a.getAttribute("href") ?? ""),
		);
		expect(govLink).toBeDefined();

		// 4. A status indication is observable for items — as text or as a
		// data-/status attribute on a descendant. (design PrepStatus surfacing.)
		const statusInText = PREP_STATUS.test(regionText);
		const statusInAttr = Array.from(region?.querySelectorAll("*") ?? []).some(
			(el) =>
				Array.from(el.attributes).some(
					(attr) =>
						/status|state|data-/i.test(attr.name) &&
						PREP_STATUS.test(attr.value),
				),
		);
		expect(statusInText || statusInAttr).toBe(true);

		// 5. Freshness signal: trip_prep.checked_on must be present in the
		// committed fixture so the panel can derive a departure-relative staleness
		// band against itinerary.trip.start_date. Assert the loaded data carries it.
		expect(enrichment?.trip_prep?.checked_on).toBeTruthy();

		// Capture the day-group count + hero presence WITH prep, to compare to the
		// stripped render below (the rest of the page must be unaffected).
		const dayGroupsWith = dayGroupCount(withPrep);
		expect(dayGroupsWith).toBeGreaterThan(0);
		expect(withPrep.querySelector("header")).not.toBeNull();

		// 6. Failure-silent parity (design Metric 1): strip trip_prep and
		// meta.travelers from the enrichment, render again, and assert the
		// "Before you go" region is ABSENT while the rest of the page (day groups
		// + hero) is unchanged.
		const strippedMeta = enrichment?.meta
			? { ...enrichment.meta, travelers: undefined }
			: enrichment?.meta;
		const stripped = enrichment
			? { ...enrichment, meta: strippedMeta, trip_prep: undefined }
			: enrichment;
		const withoutPrep = mount(
			TripPage({ itinerary, enrichment: stripped, wiki }),
		);

		expect(findPrepRegion(withoutPrep)).toBeNull();
		expect(dayGroupCount(withoutPrep)).toBe(dayGroupsWith);
		expect(withoutPrep.querySelector("header")).not.toBeNull();
	});
});
