import type { ReactNode } from "react";
import {
	braveSearch,
	fmtClock,
	type ItineraryItem,
	parseDateTime,
	tzAbbr,
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
	const ev = item.data;
	const st = parseDateTime(ev.start?.datetime);
	const isMeal = /meal|dinner|lunch|restaurant/i.test(
		(ev.category ?? "") + (ev.title ?? ""),
	);

	const row: ReactNode = (
		<>
			{st && (
				<span className={styles["timeline-times"]}>
					<span>
						{fmtClock(st.h, st.min)} {tzAbbr(st.date, ev.start?.timezone)}
					</span>
				</span>
			)}
			<span className={styles.title}>
				{ev.title}
				{ev.status === "to_book" && (
					<span className={`${styles.badge} ${styles.book}`}>To book</span>
				)}
			</span>
			{ev.location && <span className={styles.sub}>{ev.location}</span>}
		</>
	);

	const ea = enrichment?.activities?.find((a) => a.event === ev.title);
	const destRef = ea?.destination_ref;
	const dest = destRef
		? enrichment?.destinations?.find((d) => d.name === destRef)
		: null;
	const wikiTitle =
		dest?.wikipedia?.title ??
		(() => {
			const city = enrichment?.page_cards?.find(
				(c) =>
					ev.location &&
					c.city &&
					ev.location.toLowerCase().includes(c.city.toLowerCase()),
			)?.city;
			return city
				? enrichment?.page_cards?.find((c) => c.city === city)?.wikipedia?.title
				: undefined;
		})();

	const searchQuery = [
		(ev.title ?? "").replace(/\s*\(.*?\)/g, "").trim(),
		ev.location,
		"book tickets",
	]
		.filter(Boolean)
		.join(" ");

	const detail: ReactNode = (
		<>
			<Facts>
				{ev.location && <Fact label="Location" value={ev.location} />}
				{ev.notes && <Fact label="Note" value={ev.notes} />}
			</Facts>
			{ea?.blurb && <p className={styles.blurb}>{ea.blurb.trim()}</p>}
			<div className={styles.links}>
				{ea?.official_url && (
					<BtnLink href={ea.official_url} icon="ext">
						Details
					</BtnLink>
				)}
				<BtnLink href={braveSearch(searchQuery)} icon="ext">
					{ev.status === "to_book" ? "Search to book" : "Search"}
				</BtnLink>
			</div>
			{ea?.tips && <div className={styles.tips}>{ea.tips}</div>}
			{wikiTitle && <WikiCard wikiTitle={wikiTitle} />}
		</>
	);

	return (
		<TimelineItem
			icon={isMeal ? "fork" : "compass"}
			expandable={true}
			isToBook={ev.status === "to_book"}
			row={row}
		>
			{detail}
		</TimelineItem>
	);
}
