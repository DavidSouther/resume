// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { Itinerary } from "../../lib/trip-itinerary";
import { mount, resetDom } from "../test-dom.ts";
import { renderTripPage } from "./trip-page.ts";

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

describe("renderTripPage hero", () => {
	it("renders the hero in the page <header>, not in <main>", () => {
		const container = mount(renderTripPage(itinerary(), undefined));

		expect(
			container.querySelector("article.TripPage > header .hero"),
		).not.toBeNull();
		expect(container.querySelector("article.TripPage > main .hero")).toBeNull();
	});

	it("keeps the trip title as the hero heading", () => {
		const container = mount(renderTripPage(itinerary(), undefined));

		const header = container.querySelector("article.TripPage > header");
		expect(header?.querySelector("h1")?.textContent).toBe("Test Trip");
	});

	it("preserves a home link to / in the header", () => {
		const container = mount(renderTripPage(itinerary(), undefined));

		const header = container.querySelector("article.TripPage > header");
		expect(header?.querySelector('a[href="/"]')).not.toBeNull();
	});
});
