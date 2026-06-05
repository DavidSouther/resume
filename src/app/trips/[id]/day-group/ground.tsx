import type { ReactNode } from "react";
import {
	formatClock,
	type ItineraryItem,
	parseDateTime,
	timezoneAbbreviation,
} from "~/lib/itinerary-helpers";
import styles from "../day-group.module.css";
import { TimelineItem } from "../timeline-item";
import Fact, { Facts } from "./fact";

type GroundItemData = Extract<ItineraryItem, { kind: "ground" }>;

function capitalize(input: string): string {
	return input.charAt(0).toUpperCase() + input.slice(1);
}

export function GroundItem({ item }: { item: GroundItemData }) {
	const ground = item.data;
	const pickupDateTime = parseDateTime(ground.pickup?.datetime);
	const from = ground.pickup?.location;
	const to = ground.dropoff?.location;
	const isFerry = /ferry|boat/i.test(
		(ground.notes ?? "") + (ground.type ?? ""),
	);

	const row: ReactNode = (
		<>
			{pickupDateTime && (
				<span className={styles["timeline-times"]}>
					<span>
						{formatClock(pickupDateTime.hours, pickupDateTime.minutes)}{" "}
						{timezoneAbbreviation(pickupDateTime.date, ground.pickup?.timezone)}
					</span>
				</span>
			)}
			<span className={styles.title}>
				{capitalize(ground.type ?? "Transfer")}
				{ground.status === "to_book" && (
					<span className={`${styles.badge} ${styles.book}`}>To book</span>
				)}
			</span>
			{(from || to) && (
				<span className={styles.sub}>
					{[from, to].filter(Boolean).join("  →  ")}
				</span>
			)}
		</>
	);

	const detail: ReactNode = (
		<Facts>
			{ground.provider && <Fact label="Booked via" value={ground.provider} />}
			{ground.notes && <Fact label="Note" value={ground.notes} />}
		</Facts>
	);

	return (
		<TimelineItem
			icon={isFerry ? "boat" : "car"}
			expandable={!!(ground.notes || ground.provider)}
			isToBook={ground.status === "to_book"}
			row={row}
		>
			{detail}
		</TimelineItem>
	);
}
