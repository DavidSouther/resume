import { abbr, mark, p, small, span } from "@davidsouther/jiffies/dom/html.ts";
import {
	IATA,
	type ItineraryItem,
	parseDateTime,
} from "../../../lib/itinerary-helpers.ts";
import type { TripEnrichment } from "../../../lib/trip-enrichment";
import { TimelineItem } from "../timeline-item.ts";
import { Actions, BtnLink } from "./btn-link.ts";
import { Clock } from "./clock.ts";
import { Fact, Facts } from "./fact.ts";

type FlightItemData = Extract<ItineraryItem, { kind: "flight" }>;

// (item, enrichment) — positional from the original prop object.
export function FlightItem(
	item: FlightItemData,
	enrichment: TripEnrichment | undefined,
): HTMLElement {
	const flight = item.data;
	const departure = parseDateTime(flight.depart?.datetime);
	const arrival = parseDateTime(flight.arrive?.datetime);
	const isNextDay = arrival && departure && arrival.date > departure.date;
	const origin = flight.origin?.airport ?? "";
	const dest = flight.destination?.airport ?? "";

	const row = [
		departure &&
			p(
				Clock(flight.depart),
				span("→"),
				Clock(flight.arrive),
				isNextDay ? small("+1 day") : null,
			),
		p(
			abbr({ title: IATA[origin] ?? origin }, origin),
			span("→"),
			abbr({ title: IATA[dest] ?? dest }, dest),
			flight.status === "to_book" ? mark("To book") : null,
		),
		p(
			[
				flight.airline_code && flight.flight_number
					? `${flight.airline_code} ${flight.flight_number}`
					: null,
				flight.airline,
				flight.cabin,
				flight.seat ? `Seat ${flight.seat}` : null,
			]
				.filter(Boolean)
				.join("  ·  "),
		),
	];

	const flightKey = `${flight.airline_code ?? ""}${flight.flight_number ?? ""}`;
	const flightEnrichment = enrichment?.flights?.find(
		(enrichedFlight) => enrichedFlight.flight === flightKey,
	);

	const detail = [
		Facts(
			flight.confirmation ? Fact("Confirmation", flight.confirmation) : null,
			flight.origin?.terminal
				? Fact("Departs", `${flight.origin.airport} T${flight.origin.terminal}`)
				: null,
			flight.destination?.terminal
				? Fact(
						"Arrives",
						`${flight.destination.airport} T${flight.destination.terminal}`,
					)
				: null,
			flight.cabin ? Fact("Cabin", flight.cabin) : null,
			flight.seat ? Fact("Seat", flight.seat) : null,
		),
		flightEnrichment &&
		(flightEnrichment.airline_status_url || flightEnrichment.tracker_url)
			? Actions(
					flightEnrichment.airline_status_url
						? BtnLink(
								flightEnrichment.airline_status_url,
								"ext",
								"Flight status",
							)
						: null,
					flightEnrichment.tracker_url
						? BtnLink(flightEnrichment.tracker_url, "ext", "Track live")
						: null,
				)
			: null,
	];

	return TimelineItem({ icon: "plane", row }, ...detail);
}
