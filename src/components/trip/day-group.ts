import { Panel } from "@davidsouther/jiffies/components/card.ts";
import { i, ol, p, time } from "@davidsouther/jiffies/dom/html.ts";
import {
	dayOfWeekName,
	IATA,
	type ItineraryItem,
	prettyDate,
} from "../../lib/itinerary-helpers.ts";
import type { TripEnrichment } from "../../lib/trip-enrichment";
import type { Flight, Hotel } from "../../lib/trip-itinerary";
import type { WikiData } from "../../lib/wiki-cache.ts";
import { EventItem } from "./day-group/event.ts";
import { FlightItem } from "./day-group/flight.ts";
import { GroundItem } from "./day-group/ground.ts";
import { HotelItem } from "./day-group/hotel.ts";
import { TransferItem } from "./day-group/transfer.ts";
import { SvgIcon } from "./icons.ts";

function renderItem(
	item: ItineraryItem,
	enrichment: TripEnrichment | undefined,
	wiki: WikiData,
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
			return EventItem(item, enrichment, wiki);
	}
}

// (date, items, on, enrichment, wiki) — wiki threads to EventItem; other item
// kinds ignore it.
export function DayGroup(
	date: string,
	items: ItineraryItem[],
	on: Hotel | Flight | null,
	enrichment: TripEnrichment | undefined,
	wiki: WikiData,
): HTMLElement {
	const overnightLabel =
		on == null
			? null
			: "check_in" in on
				? on.name
				: `Overnight flight${on.destination?.airport && IATA[on.destination.airport] ? ` to ${IATA[on.destination.airport]}` : ""}`;

	return Panel(
		{
			header: time(
				{ dateTime: date },
				`${dayOfWeekName(date)} ${prettyDate(date)}`,
			),
			footer: overnightLabel && p(SvgIcon("moon"), i(overnightLabel)),
		},
		ol(...items.map((item) => renderItem(item, enrichment, wiki))),
	);
}
