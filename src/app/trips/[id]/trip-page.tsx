import type { ReactElement } from "react";
import { Card } from "~/components/Card";
import {
	buildItems,
	dateKeyRange,
	dayCity,
	IATA,
	overnight,
	synthesizeTransfers,
} from "~/lib/itinerary-helpers";
import type { TripEnrichment } from "~/lib/trip-enrichment";
import type { Itinerary } from "~/lib/trip-itinerary";
import { CityBanner } from "./city-banner";
import { DayGroup } from "./day-group";
import { ItineraryHero } from "./itinerary-hero";
import styles from "./trip-page.module.css";

export default async function TripPage({
	itinerary,
	enrichment,
}: {
	itinerary: Itinerary;
	enrichment: TripEnrichment | undefined;
}) {
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
	const sections: ReactElement[] = [];
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
			sections.push(
				<CityBanner
					key={`city-${city}-${date}`}
					city={city}
					wikiTitle={pageCard?.wikipedia?.title}
				/>,
			);
			lastCity = city;
		}

		sections.push(
			<DayGroup
				key={date}
				date={date}
				items={dayItems}
				on={on}
				enrichment={enrichment}
			/>,
		);
	}

	return (
		<>
			<link rel="preconnect" href="https://fonts.googleapis.com" />
			<link
				rel="preconnect"
				href="https://fonts.gstatic.com"
				crossOrigin="anonymous"
			/>
			{/* eslint-disable-next-line @next/next/no-page-custom-font */}
			<link
				href="https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Spectral:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap"
				rel="stylesheet"
			/>
			<Card
				header={
					<>
						<a href="/">David Souther</a> — {itinerary.trip.title}
					</>
				}
				footer={<a href="../../">Back</a>}
				className={styles.TripPage}
			>
				<div className={styles.wrap}>
					<div className={styles.grain} aria-hidden />
					<ItineraryHero itinerary={itinerary} wikiTitle={heroWikiTitle} />
					{sections}
				</div>
			</Card>
		</>
	);
}
