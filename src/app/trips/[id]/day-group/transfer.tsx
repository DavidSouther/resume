import type { ReactNode } from "react";
import { type ItineraryItem, mapsDir } from "~/lib/itinerary-helpers";
import styles from "../day-group.module.css";
import { TimelineItem } from "../timeline-item";
import { BtnLink } from "./btn-link";

type TransferItemData = Extract<ItineraryItem, { kind: "transfer" }>;

export function TransferItem({ item }: { item: TransferItemData }) {
	const td = item.data;
	const place = td.city ?? td.airport;

	const row: ReactNode = (
		<>
			<span className={styles.title}>
				{td.dir === "in" ? "Arrival transfer" : "Departure transfer"}
			</span>
			<span className={styles.sub}>
				{td.dir === "in"
					? `${td.airport}  →  ${place}`
					: `${place}  →  ${td.airport}`}
			</span>
		</>
	);

	const ap = `${td.airport} Airport`;
	const origin = td.dir === "in" ? ap : place;
	const dest = td.dir === "in" ? place : ap;

	const detail: ReactNode = (
		<>
			<div className={styles.skel}>Suggested transfer — not booked.</div>
			<div className={styles.links}>
				<BtnLink href={mapsDir(origin, dest, "driving")} icon="car">
					Car · Maps
				</BtnLink>
				<BtnLink href={mapsDir(origin, dest, "transit")} icon="pin">
					Public transit
				</BtnLink>
			</div>
		</>
	);

	return (
		<TimelineItem icon="car" expandable={true} row={row}>
			{detail}
		</TimelineItem>
	);
}
