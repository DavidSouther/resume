import type { ReactNode } from "react";
import {
	fmtTimeStr,
	type ItineraryItem,
	ihgSearch,
} from "~/lib/itinerary-helpers";
import type { TripEnrichment } from "~/lib/trip-enrichment";
import styles from "../day-group.module.css";
import { TimelineItem } from "../timeline-item";
import { BtnLink } from "./btn-link";
import Fact, { Facts } from "./fact";

type HotelItemData = Extract<ItineraryItem, { kind: "hotel-in" | "hotel-out" }>;

export function HotelItem({
	item,
	enrichment,
}: {
	item: HotelItemData;
	enrichment: TripEnrichment | undefined;
}) {
	const h = item.data;
	const isIn = item.kind === "hotel-in";
	const time = isIn ? h.check_in?.after_time : h.check_out?.before_time;

	const row: ReactNode = (
		<>
			<span className={styles["timeline-times"]}>
				<span>
					{isIn ? "Check-in" : "Check-out"}
					{time ? ` ${isIn ? "after" : "by"} ${fmtTimeStr(time)}` : ""}
				</span>
			</span>
			<span className={styles.title}>
				{h.name}
				{h.status === "to_book" && (
					<span className={`${styles.badge} ${styles.book}`}>To book</span>
				)}
			</span>
			{(h.room_type || h.brand) && (
				<span className={styles.sub}>{h.room_type ?? h.brand}</span>
			)}
		</>
	);

	const eh = enrichment?.hotels?.find((e) => e.hotel === h.name);
	const city =
		enrichment?.page_cards?.find(
			(c) => c.city && h.name.toLowerCase().includes(c.city.toLowerCase()),
		)?.city ?? h.name.split(/\s+[— -]\s+|\s+hotel\s+/i)[0].trim();

	const detail: ReactNode = (
		<>
			<Facts>
				{h.confirmation && <Fact label="Confirmation" value={h.confirmation} />}
				{h.check_in && (
					<Fact
						label="Check-in"
						value={`${h.check_in.date}${h.check_in.after_time ? ` · ${fmtTimeStr(h.check_in.after_time)}` : ""}`}
					/>
				)}
				{h.check_out && (
					<Fact
						label="Check-out"
						value={`${h.check_out.date}${h.check_out.before_time ? ` · ${fmtTimeStr(h.check_out.before_time)}` : ""}`}
					/>
				)}
				{h.room_type && <Fact label="Room" value={h.room_type} />}
				{h.notes && <Fact label="Note" value={h.notes} />}
			</Facts>
			{eh?.blurb && <p className={styles.blurb}>{eh.blurb.trim()}</p>}
			<div className={styles.links}>
				{eh?.website && (
					<BtnLink href={eh.website} icon="ext">
						Hotel page
					</BtnLink>
				)}
				{eh?.map_url && (
					<BtnLink href={eh.map_url} icon="pin">
						Map
					</BtnLink>
				)}
				{eh?.phone && (
					<BtnLink href={`tel:${eh.phone.replace(/\s/g, "")}`} icon="phone">
						{eh.phone}
					</BtnLink>
				)}
				{h.status === "to_book" && (
					<BtnLink
						href={ihgSearch(
							city,
							String(h.check_in?.date),
							String(h.check_out?.date),
						)}
						icon="bed"
					>
						Find on IHG
					</BtnLink>
				)}
			</div>
		</>
	);

	return (
		<TimelineItem
			icon={isIn ? "bed" : "bedout"}
			expandable={true}
			isToBook={h.status === "to_book"}
			row={row}
		>
			{detail}
		</TimelineItem>
	);
}
