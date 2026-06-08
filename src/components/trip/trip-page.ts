import {
	buildItems,
	dateKeyRange,
	dayCity,
	IATA,
	overnight,
	synthesizeTransfers,
} from "../../lib/itinerary-helpers.ts";
import type { TripEnrichment } from "../../lib/trip-enrichment";
import type { Itinerary } from "../../lib/trip-itinerary";
import type { WikiData } from "../../lib/wiki-cache.ts";
import { Layout } from "../layout.ts";
import { CityBanner } from "./city-banner.ts";
import { DayGroup } from "./day-group.ts";
import { ItineraryHero } from "./itinerary-hero.ts";

export function TripPage({
	itinerary,
	enrichment,
	wiki,
}: {
	itinerary: Itinerary;
	enrichment?: TripEnrichment;
	wiki: WikiData;
}): HTMLElement {
	const allItems = synthesizeTransfers(itinerary, buildItems(itinerary));
	const start = String(itinerary.trip.start_date).slice(0, 10);
	const end = String(itinerary.trip.end_date).slice(0, 10);
	const dates = dateKeyRange(start, end);

	// Hero wikipedia image: first non-home destination page card
	const homeCity = IATA[itinerary.flights?.[0]?.origin?.airport ?? ""] ?? null;
	const heroCard =
		enrichment?.page_cards?.find((c) => c.city !== homeCity) ??
		enrichment?.page_cards?.[0];
	const heroWikiTitle = heroCard?.wikipedia?.title;

	// Build the day/city-banner sequence
	const sections: HTMLElement[] = [];
	let lastCity: string | null = null;

	for (const date of dates) {
		const dayItems = allItems
			.filter((i) => i.date === date)
			.sort((a, b) => a.sortKey - b.sortKey);
		const on = overnight(itinerary, date);
		if (!dayItems.length && !on) continue;

		const city = dayCity(itinerary, date, enrichment);
		if (city && city !== lastCity) {
			const pageCard = enrichment?.page_cards?.find((c) => c.city === city);
			sections.push(CityBanner(city, wiki.get(pageCard?.wikipedia?.title)));
			lastCity = city;
		}

		sections.push(DayGroup(date, dayItems, on, enrichment, wiki));
	}

	return Layout(
		{
			class: "TripPage",
			header: [ItineraryHero(itinerary, wiki.get(heroWikiTitle))],
			lastUpdate: Date.now().toString(),
		},
		...sections,
	);
}
