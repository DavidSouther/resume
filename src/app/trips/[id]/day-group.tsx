import {
	dayOfWeekName,
	IATA,
	type ItineraryItem,
	prettyDate,
} from "~/lib/itinerary-helpers";
import type { TripEnrichment } from "~/lib/trip-enrichment";
import type { Flight, Hotel } from "~/lib/trip-itinerary";
import { EventItem } from "./day-group/event";
import { FlightItem } from "./day-group/flight";
import { GroundItem } from "./day-group/ground";
import { HotelItem } from "./day-group/hotel";
import { TransferItem } from "./day-group/transfer";
import styles from "./day-group.module.css";
import { SvgIcon } from "./icons";

function renderItem(
	item: ItineraryItem,
	enrichment: TripEnrichment | undefined,
) {
	const key = `${item.kind}-${item.date}-${item.sortKey}`;
	switch (item.kind) {
		case "flight":
			return <FlightItem key={key} item={item} enrichment={enrichment} />;
		case "hotel-in":
		case "hotel-out":
			return <HotelItem key={key} item={item} enrichment={enrichment} />;
		case "ground":
			return <GroundItem key={key} item={item} />;
		case "transfer":
			return <TransferItem key={key} item={item} />;
		case "event":
			return <EventItem key={key} item={item} enrichment={enrichment} />;
	}
}

export function DayGroup({
	date,
	items,
	on,
	enrichment,
}: {
	date: string;
	items: ItineraryItem[];
	on: Hotel | Flight | null;
	enrichment: TripEnrichment | undefined;
}) {
	const overnightLabel =
		on == null
			? null
			: "check_in" in on
				? on.name
				: `Overnight flight${on.destination?.airport && IATA[on.destination.airport] ? ` to ${IATA[on.destination.airport]}` : ""}`;

	return (
		<div className={styles.day}>
			<div className={styles["day-head"]}>
				<span className={styles["day-dow"]}>{dayOfWeekName(date)}</span>
				<span className={styles["day-date"]}>{prettyDate(date)}</span>
			</div>
			<div className={styles.tl}>
				{items.map((item) => renderItem(item, enrichment))}
			</div>
			{overnightLabel && (
				<div className={styles.moon}>
					<SvgIcon name="moon" />
					<span>
						<i>{overnightLabel}</i>
					</span>
				</div>
			)}
		</div>
	);
}
