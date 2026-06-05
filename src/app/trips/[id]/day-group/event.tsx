import type { ReactNode } from "react";
import {
	braveSearch,
	formatClock,
	type ItineraryItem,
	parseDateTime,
	timezoneAbbreviation,
} from "~/lib/itinerary-helpers";
import type { TripEnrichment } from "~/lib/trip-enrichment";
import styles from "../day-group.module.css";
import { TimelineItem } from "../timeline-item";
import { WikiCard } from "../wiki-card";
import { BtnLink } from "./btn-link";
import Fact, { Facts } from "./fact";

type EventItemData = Extract<ItineraryItem, { kind: "event" }>;

export function EventItem({
	item,
	enrichment,
}: {
	item: EventItemData;
	enrichment: TripEnrichment | undefined;
}) {
	const tripEvent = item.data;
	const startDateTime = parseDateTime(tripEvent.start?.datetime);
	const isMeal = /meal|dinner|lunch|restaurant/i.test(
		(tripEvent.category ?? "") + (tripEvent.title ?? ""),
	);

	const row: ReactNode = (
		<>
			{startDateTime && (
				<span className={styles["timeline-times"]}>
					<span>
						{formatClock(startDateTime.hours, startDateTime.minutes)}{" "}
						{timezoneAbbreviation(
							startDateTime.date,
							tripEvent.start?.timezone,
						)}
					</span>
				</span>
			)}
			<span className={styles.title}>
				{tripEvent.title}
				{tripEvent.status === "to_book" && (
					<span className={`${styles.badge} ${styles.book}`}>To book</span>
				)}
			</span>
			{tripEvent.location && (
				<span className={styles.sub}>{tripEvent.location}</span>
			)}
		</>
	);

	const activity = enrichment?.activities?.find(
		(a) => a.event === tripEvent.title,
	);
	const destRef = activity?.destination_ref;
	const destination = destRef
		? enrichment?.destinations?.find((d) => d.name === destRef)
		: null;
	const wikiTitle =
		destination?.wikipedia?.title ??
		(() => {
			const city = enrichment?.page_cards?.find(
				(card) =>
					tripEvent.location &&
					card.city &&
					tripEvent.location.toLowerCase().includes(card.city.toLowerCase()),
			)?.city;
			return city
				? enrichment?.page_cards?.find((card) => card.city === city)?.wikipedia
						?.title
				: undefined;
		})();

	const searchQuery = [
		(tripEvent.title ?? "").replace(/\s*\(.*?\)/g, "").trim(),
		tripEvent.location,
		"book tickets",
	]
		.filter(Boolean)
		.join(" ");

	const detail: ReactNode = (
		<>
			<Facts>
				{tripEvent.location && (
					<Fact label="Location" value={tripEvent.location} />
				)}
				{tripEvent.notes && <Fact label="Note" value={tripEvent.notes} />}
			</Facts>
			{activity?.blurb && (
				<p className={styles.blurb}>{activity.blurb.trim()}</p>
			)}
			<div className={styles.links}>
				{activity?.official_url && (
					<BtnLink href={activity.official_url} icon="ext">
						Details
					</BtnLink>
				)}
				<BtnLink href={braveSearch(searchQuery)} icon="ext">
					{tripEvent.status === "to_book" ? "Search to book" : "Search"}
				</BtnLink>
			</div>
			{activity?.tips && <div className={styles.tips}>{activity.tips}</div>}
			{wikiTitle && <WikiCard wikiTitle={wikiTitle} />}
		</>
	);

	return (
		<TimelineItem
			icon={isMeal ? "fork" : "compass"}
			expandable={true}
			isToBook={tripEvent.status === "to_book"}
			row={row}
		>
			{detail}
		</TimelineItem>
	);
}
