import { div, i, span } from "@davidsouther/jiffies/dom/html.ts";
import {
	dayOfWeekName,
	IATA,
	type ItineraryItem,
	prettyDate,
} from "../../lib/itinerary-helpers.ts";
import type { TripEnrichment } from "../../lib/trip-enrichment";
import type { Flight, Hotel } from "../../lib/trip-itinerary";
import { EventItem } from "./day-group/event.ts";
import { FlightItem } from "./day-group/flight.ts";
import { GroundItem } from "./day-group/ground.ts";
import { HotelItem } from "./day-group/hotel.ts";
import { TransferItem } from "./day-group/transfer.ts";
import { SvgIcon } from "./icons.ts";

function renderItem(
	item: ItineraryItem,
	enrichment: TripEnrichment | undefined,
): HTMLElement | undefined {
	switch (item.kind) {
		case "flight":
			return FlightItem(item, enrichment);
		case "hotel-in":
		case "hotel-out":
			return HotelItem(item, enrichment);
		case "ground":
			return GroundItem(item);
		case "transfer":
			return TransferItem(item);
		case "event":
			return EventItem(item, enrichment);
	}
}

// (date, items, on, enrichment) — positional from the original prop object.
export function DayGroup(
	date: string,
	items: ItineraryItem[],
	on: Hotel | Flight | null,
	enrichment: TripEnrichment | undefined,
): HTMLElement {
	const overnightLabel =
		on == null
			? null
			: "check_in" in on
				? on.name
				: `Overnight flight${on.destination?.airport && IATA[on.destination.airport] ? ` to ${IATA[on.destination.airport]}` : ""}`;

	return div(
		{ class: "day" },
		div(
			{ class: "day-head" },
			span({ class: "day-dow" }, dayOfWeekName(date)),
			span({ class: "day-date" }, prettyDate(date)),
		),
		div({ class: "tl" }, ...items.map((item) => renderItem(item, enrichment))),
		overnightLabel
			? div({ class: "moon" }, SvgIcon("moon"), span(i(overnightLabel)))
			: null,
	);
}
