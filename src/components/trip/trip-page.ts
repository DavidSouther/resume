import { Card } from "@davidsouther/jiffies/dom/components/index.ts";
import { a, div, h3 } from "@davidsouther/jiffies/dom/html.ts";
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
import { CityBanner } from "./city-banner.ts";
import { DayGroup } from "./day-group.ts";
import { ItineraryHero } from "./itinerary-hero.ts";

export function renderTripPage(
	itinerary: Itinerary,
	enrichment: TripEnrichment | undefined,
): HTMLElement {
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
			sections.push(CityBanner(city, pageCard?.wikipedia?.title));
			lastCity = city;
		}

		sections.push(DayGroup(date, dayItems, on, enrichment));
	}

	const header = h3(
		a({ href: "/" }, "David Souther"),
		` — ${itinerary.trip.title}`,
	);

	const grain = div({ class: "grain" });
	grain.setAttribute("aria-hidden", "true");

	const card = Card(
		{
			header,
			footer: a({ href: "../../" }, "Back"),
		},
		div(
			{ class: "wrap" },
			grain,
			ItineraryHero(itinerary, heroWikiTitle),
			...sections,
		),
	);
	card.className = "TripPage";
	return card;
}
