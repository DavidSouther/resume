import { div, span } from "@davidsouther/jiffies/dom/html.ts";
import {
	formatClock,
	type ItineraryItem,
	parseDateTime,
	timezoneAbbreviation,
} from "../../../lib/itinerary-helpers.ts";
import type { TripEnrichment } from "../../../lib/trip-enrichment";
import { TimelineItem } from "../timeline-item.ts";
import { BtnLink } from "./btn-link.ts";
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

	const row = [
		departure
			? span(
					{ class: "timeline-times" },
					span(
						`${formatClock(departure.hours, departure.minutes)} ${timezoneAbbreviation(departure.date, flight.depart?.timezone)}`,
					),
					span({ class: "arrow" }, "—"),
					arrival
						? span(
								`${formatClock(arrival.hours, arrival.minutes)} ${timezoneAbbreviation(arrival.date, flight.arrive?.timezone)}`,
							)
						: null,
					isNextDay ? span({ class: "plus1" }, "+1 day") : null,
				)
			: null,
		span(
			{ class: "title" },
			span({ class: "route" }, flight.origin?.airport ?? ""),
			span({ class: "arrow" }, "→"),
			span({ class: "route" }, flight.destination?.airport ?? ""),
			flight.status === "to_book"
				? span({ class: "badge book" }, "To book")
				: null,
		),
		span(
			{ class: "sub" },
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
		Facts([
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
		]),
		flightEnrichment &&
		(flightEnrichment.airline_status_url || flightEnrichment.tracker_url)
			? div(
					{ class: "links" },
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

	return TimelineItem("plane", true, flight.status === "to_book", row, detail);
}
