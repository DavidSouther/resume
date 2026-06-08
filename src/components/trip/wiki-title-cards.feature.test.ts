// @vitest-environment jsdom
//
// FEATURE TEST — trip Wikipedia title cards (design.md 2026-06-08-A).
//
// User story: a reader opens the rendered `hvar` trip page. The hero shows a
// real photo of the destination loaded from Wikipedia's CDN, and at least one
// day-event shows a Wikipedia summary card (photo + blurb + link to the
// article).
//
// Render path: getTripItinerary("hvar") now returns a third field, a `wiki`
// lookup (WikiData) built from the committed trips/hvar/wiki-cache.json; the
// synchronous renderTripPage(itinerary, enrichment, wiki) threads it down so
// WikiPhoto emits a real CDN-backed <img> in the hero and WikiCard emits a
// `.wiki` summary card per event. Determinism comes from the committed cache:
// no network, no flake (design §6 "Automated verification").
//
// This is the REAL `hvar` fixture (trips/hvar/*.yaml + wiki-cache.json), the
// same data the page ships. No parallel fixture is invented.
//
// This test encodes the END STATE and stays RED until the whole feature lands:
//   - getTripItinerary must return `wiki` (the 3rd field / WikiData type),
//   - renderTripPage must take a 3rd `wiki` param,
//   - WikiPhoto must emit a real <img> (src on upload.wikimedia.org),
//   - WikiCard must emit a `.wiki` card with thumbnail/title/extract/link,
//   - and trips/hvar/wiki-cache.json must be fetched + committed.
// The 3-arg renderTripPage / WikiData type do not exist yet — that compile-time
// gap is the intended initial RED state (type-first TDD).
import { afterEach, describe, expect, it } from "vitest";
import { getTripItinerary } from "../../lib/trips.ts";
import { mount, resetDom } from "../test-dom.ts";
import { TripPage } from "./trip-page.ts";

afterEach(resetDom);

const WIKIMEDIA_CDN = "https://upload.wikimedia.org/";
const WIKIPEDIA_ARTICLE = /^https:\/\/en\.wikipedia\.org\/wiki\/.+/;

describe("trip page renders Wikipedia title cards", () => {
	it("shows a CDN hero photo and at least one wiki summary card", async () => {
		// Arrange + Act: render the golden `hvar` itinerary with its committed
		// Wikipedia cache. The new 3-arg renderTripPage consumes the `wiki` lookup.
		const { itinerary, enrichment, wiki } = await getTripItinerary("hvar");
		const container = mount(TripPage({ itinerary, enrichment, wiki }));

		// 1. Hero photo: the ItineraryHero region renders into the Card's <header>
		// slot (article > header). It contains a real <img> served from the
		// Wikipedia CDN, sized to avoid layout shift and lazily loaded.
		const hero = container.querySelector("header");
		expect(hero).not.toBeNull();
		const heroImg = hero?.querySelector("img");
		expect(heroImg).not.toBeNull();
		const heroSrc = heroImg?.getAttribute("src") ?? "";
		expect(heroSrc.startsWith(WIKIMEDIA_CDN)).toBe(true);
		expect(heroImg?.getAttribute("loading")).toBe("lazy");
		expect((heroImg?.getAttribute("width") ?? "").length).toBeGreaterThan(0);
		expect((heroImg?.getAttribute("height") ?? "").length).toBeGreaterThan(0);
		// Hero image is informative (a real photo of the place): non-empty alt.
		expect((heroImg?.getAttribute("alt") ?? "").trim().length).toBeGreaterThan(
			0,
		);

		// 2. At least one per-event Wikipedia summary card exists.
		const cards = Array.from(container.querySelectorAll(".wiki"));
		expect(cards.length).toBeGreaterThan(0);
		const card = cards[0];

		// 2a. Thumbnail <img> served from the Wikipedia CDN.
		const cardImg = card.querySelector("img");
		expect(cardImg).not.toBeNull();
		expect(cardImg?.getAttribute("src") ?? "").toContain(
			"upload.wikimedia.org",
		);

		// 2b. External link to the Wikipedia article.
		const link = Array.from(card.querySelectorAll("a")).find((a) =>
			WIKIPEDIA_ARTICLE.test(a.getAttribute("href") ?? ""),
		);
		expect(link).toBeDefined();

		// 2c. The article title text is present (non-empty) and distinct from the
		// long extract blurb — assert the card carries a substantial blurb by
		// checking total text length is more than a bare title.
		const cardText = (card.textContent ?? "").trim();
		expect(cardText.length).toBeGreaterThan(40);
	});
});
