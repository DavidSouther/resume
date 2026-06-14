// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { ItineraryItem } from "../../lib/itinerary-helpers.ts";
import type { TripEnrichment } from "../../lib/trip-enrichment";
import type { Flight, GroundTransport, Hotel } from "../../lib/trip-itinerary";
import { emptyWiki, mount, resetDom } from "../test-dom.ts";
import { DayGroup } from "./day-group.ts";

afterEach(resetDom);

// A transfer is the lightest item to render: TransferItem only reads dir,
// airport, and city, so the hotel slot can be an empty stand-in.
function transferItem(): ItineraryItem {
	return {
		kind: "transfer",
		date: "2026-07-12",
		sortKey: 100,
		data: { dir: "in", airport: "LHR", hotel: {} as Hotel, city: "London" },
	};
}

describe("DayGroup timeline list", () => {
	it("renders the timeline as an ordered list, not a div", () => {
		const container = mount(
			DayGroup("2026-07-12", [transferItem()], null, undefined, emptyWiki()),
		);

		// The timeline is the Panel body's ordered list (section > main > ol),
		// identified by shape — no `.tl` class.
		expect(container.querySelector("section > main > ol")).not.toBeNull();
	});

	it("renders each timeline entry as a list item", () => {
		const container = mount(
			DayGroup("2026-07-12", [transferItem()], null, undefined, emptyWiki()),
		);

		expect(container.querySelectorAll("ol > li")).toHaveLength(1);
	});

	it("shows the stay name, not just the city, in a departure transfer summary", () => {
		const item: ItineraryItem = {
			kind: "transfer",
			date: "2026-07-14",
			sortKey: 100,
			data: {
				dir: "out",
				airport: "LHR",
				hotel: { name: "Hotel Indigo London - Paddington" } as Hotel,
				city: "London",
			},
		};
		const container = mount(
			DayGroup("2026-07-14", [item], null, undefined, emptyWiki()),
		);

		const text = container.textContent ?? "";
		expect(text).toContain("Hotel Indigo London - Paddington");
		expect(text).toContain("LHR");
	});

	it("adds a leave-by time and an add-to-calendar alarm to a departure transfer", () => {
		const flight: Flight = {
			airline: "Austrian Airlines",
			airline_code: "OS",
			flight_number: "334",
			origin: { airport: "LHR" },
			destination: { airport: "VIE" },
			depart: { datetime: "2026-07-14T12:20:00", timezone: "Europe/London" },
			arrive: { datetime: "2026-07-14T15:35:00", timezone: "Europe/Vienna" },
		};
		const item: ItineraryItem = {
			kind: "transfer",
			date: "2026-07-14",
			sortKey: 100,
			data: {
				dir: "out",
				airport: "LHR",
				hotel: { name: "Hotel Indigo London - Paddington" } as Hotel,
				city: "London",
				flight,
			},
		};
		const enrichment: TripEnrichment = {
			transfers: [{ flight: "OS334", minutes: 30 }],
		};
		const container = mount(
			DayGroup("2026-07-14", [item], null, enrichment, emptyWiki()),
		);

		// 12:20 international departure − 3h buffer − 30m transfer = leave 8:50 AM.
		expect(container.textContent ?? "").toContain("8:50");
		expect(
			container.querySelector('a[href^="data:text/calendar"]'),
		).not.toBeNull();
	});

	it("adds an arrive-by add-to-calendar alarm to a booked airport departure transfer", () => {
		const item: ItineraryItem = {
			kind: "ground",
			date: "2026-07-22",
			sortKey: 600,
			data: {
				type: "transfer",
				provider: "Tzell",
				pickup: { location: "Adriana, Hvar" },
				dropoff: {
					datetime: "2026-07-22T14:10:00",
					timezone: "Europe/Zagreb",
					location: "Split Airport (SPU)",
				},
			} as GroundTransport,
		};
		const container = mount(
			DayGroup("2026-07-22", [item], null, undefined, emptyWiki()),
		);

		expect(
			container.querySelector('a[href^="data:text/calendar"]'),
		).not.toBeNull();
		// Honest semantics: we only know the airport-arrival time, so it's a
		// "be at SPU by 2:10 PM" reminder, not a fabricated leave time.
		expect(container.textContent ?? "").toContain("2:10");
	});
});
