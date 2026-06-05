import { describe, expect, it } from "vitest";
import type { Flight, Hotel, Itinerary } from "~/lib/trip-itinerary";
import {
	buildItems,
	type ItineraryItem,
	synthesizeTransfers,
} from "./itinerary-helpers";

// Minimal fixture builders. Only the fields the helpers read are populated.
function flight(partial: Partial<Flight>): Flight {
	return {
		airline: "Austrian Airlines",
		airline_code: "OS",
		flight_number: "334",
		origin: { airport: "LHR" },
		destination: { airport: "VIE" },
		depart: { datetime: "2026-07-14T12:20:00", timezone: "Europe/London" },
		arrive: { datetime: "2026-07-14T15:35:00", timezone: "Europe/Vienna" },
		...partial,
	};
}

function hotel(partial: Partial<Hotel>): Hotel {
	return {
		name: "InterContinental Vienna",
		timezone: "Europe/Vienna",
		check_in: { date: "2026-07-14", after_time: "15:00" },
		check_out: { date: "2026-07-18", before_time: "12:00" },
		...partial,
	};
}

function itinerary(partial: Partial<Itinerary>): Itinerary {
	return {
		trip: {
			title: "T",
			traveler: "D",
			start_date: "2026-07-14",
			end_date: "2026-07-18",
		},
		flights: [],
		hotels: [],
		ground_transportation: [],
		events: [],
		...partial,
	};
}

// Reproduces the trip-page pipeline: build base items, synthesize airport
// transfers, then sort one day by sortKey.
function orderedKinds(itin: Itinerary, date: string): string[] {
	return synthesizeTransfers(itin, buildItems(itin))
		.filter((i) => i.date === date)
		.sort((a, b) => a.sortKey - b.sortKey)
		.map((i) => i.kind);
}

function transfer(
	itin: Itinerary,
	date: string,
	dir: "in" | "out",
): Extract<ItineraryItem, { kind: "transfer" }> | undefined {
	return synthesizeTransfers(itin, buildItems(itin)).find(
		(i): i is Extract<ItineraryItem, { kind: "transfer" }> =>
			i.kind === "transfer" && i.date === date && i.data.dir === dir,
	);
}

// A synthesized airport transfer connects the airport and the hotel. It must
// therefore always sort between the flight and the hotel check-in/out, even
// when the hotel's policy after_time / before_time falls on the wrong side of
// the actual flight time.
describe("synthesizeTransfers ordering", () => {
	it("sorts an arrival transfer after the flight and before check-in", () => {
		// Flight lands 15:35; check-in floor is 15:00. Clock-time sorting would
		// place the 15:00 hotel before the 15:35 transfer — the reported bug.
		const itin = itinerary({ flights: [flight({})], hotels: [hotel({})] });
		expect(orderedKinds(itin, "2026-07-14")).toEqual([
			"flight",
			"transfer",
			"hotel-in",
		]);
	});

	it("sorts a departure transfer after check-out and before the flight", () => {
		const itin = itinerary({
			flights: [
				flight({
					origin: { airport: "VIE" },
					destination: { airport: "SPU" },
					depart: {
						datetime: "2026-07-18T13:05:00",
						timezone: "Europe/Vienna",
					},
					arrive: {
						datetime: "2026-07-18T14:15:00",
						timezone: "Europe/Zagreb",
					},
				}),
			],
			hotels: [hotel({})],
		});
		expect(orderedKinds(itin, "2026-07-18")).toEqual([
			"hotel-out",
			"transfer",
			"flight",
		]);
	});

	it("clamps a late arrival transfer to just before the check-in key", () => {
		// arrival 15:35 + 5 = 940 would land after the 900 check-in; clamp to 899.
		const itin = itinerary({ flights: [flight({})], hotels: [hotel({})] });
		expect(transfer(itin, "2026-07-14", "in")?.sortKey).toBe(899);
	});

	it("keeps the natural arrival key when the flight lands before check-in", () => {
		// Early arrival 09:00 + 5 = 545 is below the 900 check-in, so no clamp.
		const itin = itinerary({
			flights: [
				flight({
					depart: {
						datetime: "2026-07-14T06:00:00",
						timezone: "Europe/London",
					},
					arrive: {
						datetime: "2026-07-14T09:00:00",
						timezone: "Europe/Vienna",
					},
				}),
			],
			hotels: [hotel({})],
		});
		expect(transfer(itin, "2026-07-14", "in")?.sortKey).toBe(545);
		expect(orderedKinds(itin, "2026-07-14")).toEqual([
			"flight",
			"transfer",
			"hotel-in",
		]);
	});
});
