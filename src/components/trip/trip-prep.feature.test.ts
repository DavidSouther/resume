// @vitest-environment jsdom
//
// FEATURE TEST — trip prep "Before you go" panel
// (design.md 2026-06-10-A-before-you-go-panel, refining 2026-06-07-A-entry-requirements).
//
// User story: a reader opens the rendered `hvar` trip page. The trip's
// enrichment carries a `trip_prep` block whose checklist has at least one
// `action_needed` item. The "Before you go" advisory renders as a full-width
// Card — an <article class="TripPrep"> — whose body is a <details> collapsed by
// default. In its collapsed state the <summary> shows the "Before you go"
// heading, an absolute "Checked 7 June 2026" date, and an "Action needed" <mark>
// badge (because an item needs action). The reader sees NO relative-time phrasing
// anywhere in the region: every date is stated in its own absolute terms. When
// `trip_prep` is absent, the page renders exactly as before (failure-silent
// parity — unchanged Metric 1).
//
// Render path: getTripItinerary("hvar") (src/lib/trips.ts) loads the committed
// trips/hvar/enrichment.yaml into `enrichment: TripEnrichment`
// (src/lib/trip-enrichment.d.ts). TripPage({ itinerary, enrichment, wiki })
// (src/components/trip/trip-page.ts) renders the page via Layout(...). The
// "Before you go" Card is emitted from `enrichment.trip_prep`.
//
// This is the REAL `hvar` fixture (trips/hvar/*.yaml + wiki-cache.json), the same
// data the page ships. The absolute "Checked 7 June 2026" date derives from
// trip_prep.checked_on = "2026-06-07"; it does NOT depend on an injected clock
// (the render path passes no `today`, and the redesign removes the only
// clock-dependent derivation), so the test is deterministic without freezing time.
//
// This test encodes the END STATE of the redesign and stays RED until the whole
// feature lands:
//   - PrepStatus collapses to the binary action_needed | no_action,
//   - TripPrep renders a Card (<article class="TripPrep">) whose <main> holds a
//     collapsed <details> with a <summary> carrying heading + absolute checked
//     date + an aggregate "Action needed" badge,
//   - all relative-time derivation/prose is removed and trips/hvar/enrichment.yaml
//     restates every date absolutely (no in_progress, no "~", no ">= N months").
// None of that exists yet — that compile-time + assertion gap is the intended
// initial RED state (type-first TDD).
//
// OBSERVABLE CONTRACT (markup details beyond the Card/details/summary skeleton
// are the plan's choice; this asserts observable SEMANTICS):
//   - The region is LOCATED by a heading whose text contains "Before you go"
//     (case-insensitive); the region is that heading's nearest enclosing
//     <article> or <section> (failing that, the heading's parent).
//   - The region is an <article class="TripPrep"> (a jiffies Card, not a Panel).
//   - The region's <main> contains a <details> with NO `open` attribute.
//   - The <details>'s own <summary> carries the heading, the absolute checked
//     date "Checked 7 June 2026", and an "Action needed" <mark> badge.
//   - Binary status (action_needed | no_action, raw or humanized) is surfaced.
//   - No relative-time vocabulary renders anywhere in the region.
import { afterEach, describe, expect, it } from "vitest";
import { getTripItinerary } from "../../lib/trips.ts";
import { mount, resetDom } from "../test-dom.ts";
import { TripPage } from "./trip-page.ts";

afterEach(resetDom);

// Authoritative government source: gov.uk (UK ETA) or europa.eu (Schengen).
const GOV_SOURCE = /\.gov(\.uk)?\/|europa\.eu/;
// Binary PrepStatus tokens (raw or humanized) — in_progress is GONE from the type.
const PREP_STATUS = /action[_\s-]?needed|no[_\s-]?action/i;
// Relative-time vocabulary that must NEVER render in the redesigned region. Each
// of these phrasings implies a date relative to another date (or the rejected
// in_progress middle state); the reader must only ever see absolute dates.
const RELATIVE_VOCAB = [
	/>=\s/, // ">= 3 months past departure"
	/months past/i, // staleness / passport-validity prose
	/re-check before/i, // removed staleness suffix
	/approaching/i, // removed DEADLINE_LABEL "Deadline approaching"
	/past deadline/i, // removed DEADLINE_LABEL "Past deadline"
	/in[_\s-]?progress/i, // dropped PrepStatus member (raw attr or humanized text)
];
// A day-group header carries a date-only datetime key (e.g. "2026-07-11"),
// distinct from clock <time> elements that carry a full datetime. Counting these
// gives a stable per-day-group signal that trip_prep must not perturb.
const DAY_KEY = /^\d{4}-\d{2}-\d{2}$/;

// Locate the "Before you go" region: find the heading by its text, then return
// its nearest enclosing <article> or <section> (falling back to the heading's
// parent). The redesign nests the <h2> inside a <summary> inside a <details>
// inside the Card's <main>, so closest("article, section") resolves the Card.
function findPrepRegion(container: HTMLElement): HTMLElement | null {
	const headings = Array.from(
		container.querySelectorAll("h1,h2,h3,h4,h5,h6"),
	) as HTMLElement[];
	const heading = headings.find((h) =>
		/before you go/i.test(h.textContent ?? ""),
	);
	if (!heading) return null;
	return (
		(heading.closest("article, section") as HTMLElement | null) ??
		heading.parentElement
	);
}

function dayGroupCount(container: HTMLElement): number {
	return Array.from(container.querySelectorAll("time[datetime]")).filter((t) =>
		DAY_KEY.test(t.getAttribute("datetime") ?? ""),
	).length;
}

describe("trip page renders the Before-you-go prep as a collapsible Card", () => {
	it("is a full-width Card with a collapsed details body, an absolute-dated action-needed summary, no relative time, and is absent without trip_prep", async () => {
		// Arrange + Act: render the golden `hvar` itinerary with its committed
		// enrichment (which carries the trip_prep block).
		const { itinerary, enrichment, wiki } = await getTripItinerary("hvar");
		const withPrep = mount(TripPage({ itinerary, enrichment, wiki }));

		// 1. The "Before you go" region exists and is the Card: an
		// <article class="TripPrep"> (a jiffies Card, NOT a Panel <section>).
		const region = findPrepRegion(withPrep);
		expect(region).not.toBeNull();
		const article = region as HTMLElement;
		expect(article.tagName).toBe("ARTICLE");
		expect(article.classList.contains("TripPrep")).toBe(true);

		// 2. The Card body is a <details> collapsed by default (no `open` attr).
		// jsdom keeps <details> children in the DOM regardless of `open`, so the
		// collapsed content below is still queryable.
		const details = article.querySelector("details");
		expect(details).not.toBeNull();
		expect((details as HTMLDetailsElement).hasAttribute("open")).toBe(false);

		// 3. The collapsed <summary> carries the heading, an ABSOLUTE checked date,
		// and an aggregate "Action needed" <mark> badge (hvar has action_needed
		// items). Absolute form is "Checked 7 June 2026" — never the raw ISO.
		const summary = (details as HTMLDetailsElement).querySelector("summary");
		expect(summary).not.toBeNull();
		const summaryText = summary?.textContent ?? "";
		expect(summaryText).toMatch(/before you go/i);
		expect(summaryText).toMatch(/Checked 7 June 2026/);
		const badge = Array.from(summary?.querySelectorAll("mark") ?? []).find(
			(m) => /action[_\s-]?needed/i.test(m.textContent ?? ""),
		);
		expect(badge).toBeDefined();

		// 4. At least one checklist item is present with its label text (revealed
		// on expand; still in the DOM). The hvar checklist authors a "UK ETA" item.
		const regionText = article.textContent ?? "";
		expect(regionText).toMatch(/UK ETA/i);

		// 5. At least one rule-bearing item links out to an authoritative
		// government source (gov.uk for the UK ETA, europa.eu for Schengen).
		const govLink = Array.from(article.querySelectorAll("a")).find((a) =>
			GOV_SOURCE.test(a.getAttribute("href") ?? ""),
		);
		expect(govLink).toBeDefined();

		// 6. Binary status is surfaced (raw or humanized) somewhere in the region.
		const statusInText = PREP_STATUS.test(regionText);
		const statusInAttr = Array.from(article.querySelectorAll("*")).some((el) =>
			Array.from(el.attributes).some(
				(attr) =>
					/status|state|data-/i.test(attr.name) && PREP_STATUS.test(attr.value),
			),
		);
		expect(statusInText || statusInAttr).toBe(true);

		// 7. ABSOLUTE DATES ONLY: no relative-time vocabulary renders anywhere in
		// the region — neither in visible text nor in serialized markup (so a
		// raw `in_progress` status attribute or a relative detail string trips it).
		const regionMarkup = `${regionText}\n${article.innerHTML}`;
		for (const pattern of RELATIVE_VOCAB) {
			expect(regionMarkup).not.toMatch(pattern);
		}

		// 8. Freshness signal: trip_prep.checked_on must be present in the
		// committed fixture so the panel can render the absolute checked date.
		expect(enrichment?.trip_prep?.checked_on).toBeTruthy();

		// Capture the day-group count + hero presence WITH prep, to compare to the
		// stripped render below (the rest of the page must be unaffected).
		const dayGroupsWith = dayGroupCount(withPrep);
		expect(dayGroupsWith).toBeGreaterThan(0);
		expect(withPrep.querySelector("header")).not.toBeNull();

		// 9. Failure-silent parity (unchanged Metric 1): strip trip_prep and
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
