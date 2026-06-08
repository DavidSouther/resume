// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { Itinerary } from "../../lib/trip-itinerary";
import { emptyWiki, mount, resetDom } from "../test-dom.ts";
import { TripPage } from "./trip-page.ts";

afterEach(resetDom);

function itinerary(): Itinerary {
	return {
		trip: {
			title: "Test Trip",
			traveler: "David Souther",
			start_date: "2026-07-11",
			end_date: "2026-07-11",
		},
		flights: [],
		hotels: [],
		ground_transportation: [],
		events: [],
	};
}

describe("TripPage hero", () => {
	it("renders the hero in the page <header>, not in <main>", () => {
		const container = mount(
			TripPage({ itinerary: itinerary(), wiki: emptyWiki() }),
		);

		// The hero is the trip title (h1); it lives in the Layout header, not main.
		expect(
			container.querySelector("#root.TripPage > header h1"),
		).not.toBeNull();
		expect(container.querySelector("#root.TripPage > main h1")).toBeNull();
	});

	it("keeps the trip title as the hero heading", () => {
		const container = mount(
			TripPage({ itinerary: itinerary(), wiki: emptyWiki() }),
		);

		const header = container.querySelector("#root.TripPage > header");
		expect(header?.querySelector("h1")?.textContent).toBe("Test Trip");
	});

	it("preserves a home link to / in the header", () => {
		const container = mount(
			TripPage({ itinerary: itinerary(), wiki: emptyWiki() }),
		);

		const header = container.querySelector("#root.TripPage > header");
		expect(header?.querySelector('a[href="/"]')).not.toBeNull();
	});
});
