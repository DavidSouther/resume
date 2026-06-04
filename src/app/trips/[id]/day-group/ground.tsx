import type { ReactNode } from "react";
import {
	fmtClock,
	type ItineraryItem,
	parseDateTime,
	tzAbbr,
} from "~/lib/itinerary-helpers";
import styles from "../day-group.module.css";
import { TimelineItem } from "../timeline-item";
import Fact, { Facts } from "./fact";

type GroundItemData = Extract<ItineraryItem, { kind: "ground" }>;

function capitalize(s: string): string {
	return s.charAt(0).toUpperCase() + s.slice(1);
}

export function GroundItem({ item }: { item: GroundItemData }) {
	const g = item.data;
	const pk = parseDateTime(g.pickup?.datetime);
	const from = g.pickup?.location;
	const to = g.dropoff?.location;
	const isFerry = /ferry|boat/i.test((g.notes ?? "") + (g.type ?? ""));

	const row: ReactNode = (
		<>
			{pk && (
				<span className={styles["timeline-times"]}>
					<span>
						{fmtClock(pk.h, pk.min)} {tzAbbr(pk.date, g.pickup?.timezone)}
					</span>
				</span>
			)}
			<span className={styles.title}>
				{capitalize(g.type ?? "Transfer")}
				{g.status === "to_book" && (
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
			{g.provider && <Fact label="Booked via" value={g.provider} />}
			{g.notes && <Fact label="Note" value={g.notes} />}
		</Facts>
	);

	return (
		<TimelineItem
			icon={isFerry ? "boat" : "car"}
			expandable={!!(g.notes || g.provider)}
			isToBook={g.status === "to_book"}
			row={row}
		>
			{detail}
		</TimelineItem>
	);
}
