import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cwd } from "node:process";
import { describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";
import { parseItinerary } from "~/lib/itinerary";
import type { Move, Stay } from "~/lib/timeline";
import { deriveTimeline } from "~/lib/timeline";

describe("deriveTimeline — hvar golden timeline", () => {
	it("projects the hvar trip into 4 stays and 5 moves, strictly alternating", async () => {
		const raw = await readFile(
			join(cwd(), "trips/hvar/itinerary.yaml"),
			"utf-8",
		);
		const itinerary = parseItinerary(parseYaml(raw));
		const timeline = deriveTimeline(itinerary);

		// 4 hotels → 4 stays; 5 inter-stay gaps (including home anchors) → 5 moves
		expect(timeline.segments).toHaveLength(9);

		// Strict alternation: move, stay, move, stay, …, move
		for (let i = 0; i < timeline.segments.length; i++) {
			expect(timeline.segments[i].kind, `segment[${i}]`).toBe(
				i % 2 === 0 ? "move" : "stay",
			);
		}

		const stays = timeline.segments.filter(
			(s): s is { kind: "stay" } & Stay => s.kind === "stay",
		);
		const moves = timeline.segments.filter(
			(s): s is { kind: "move" } & Move => s.kind === "move",
		);

		// Stays land at the right cities in trip order
		expect(stays[0].place.city).toBe("London");
		expect(stays[1].place.city).toBe("Vienna");
		expect(stays[2].place.city).toBe("Hvar");
		expect(stays[3].place.city).toBe("London");

		// Moves connect the right city pairs; home anchors at "New York" (JFK)
		expect(moves[0].from.city).toBe("New York");
		expect(moves[0].to.city).toBe("London");
		expect(moves[1].from.city).toBe("London");
		expect(moves[1].to.city).toBe("Vienna");
		expect(moves[2].from.city).toBe("Vienna");
		expect(moves[2].to.city).toBe("Hvar");
		expect(moves[3].from.city).toBe("Hvar");
		expect(moves[3].to.city).toBe("London");
		expect(moves[4].from.city).toBe("London");
		expect(moves[4].to.city).toBe("New York");

		// Vienna → Hvar is a multi-leg move (OS611 + SPU→Hvar ferry)
		expect(moves[2].legs.length).toBeGreaterThanOrEqual(2);
	});
});

describe("parseItinerary", () => {
	it("assigns absent booking status to to_book (D5 invariant)", () => {
		const itinerary = parseItinerary({
			trip: {
				title: "Minimal",
				traveler: "T",
				start_date: "2026-07-01",
				end_date: "2026-07-02",
			},
			flights: [
				{
					airline: "Test Air",
					airline_code: "TX",
					flight_number: "1",
					origin: { airport: "JFK" },
					destination: { airport: "LHR" },
					depart: {
						datetime: "2026-07-01T10:00:00",
						timezone: "America/New_York",
					},
					arrive: {
						datetime: "2026-07-01T22:00:00",
						timezone: "Europe/London",
					},
					// status deliberately absent — D5 requires this defaults to to_book
				},
			],
			hotels: [],
			transfers: [],
			events: [],
		});
		expect(itinerary.flights[0].status.kind).toBe("to_book");
	});
});
