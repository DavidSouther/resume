import type { ReactNode } from "react";
import {
	formatTimeString,
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
	const hotel = item.data;
	const isIn = item.kind === "hotel-in";
	const time = isIn ? hotel.check_in?.after_time : hotel.check_out?.before_time;

	const row: ReactNode = (
		<>
			<span className={styles["timeline-times"]}>
				<span>
					{isIn ? "Check-in" : "Check-out"}
					{time ? ` ${isIn ? "after" : "by"} ${formatTimeString(time)}` : ""}
				</span>
			</span>
			<span className={styles.title}>
				{hotel.name}
				{hotel.status === "to_book" && (
					<span className={`${styles.badge} ${styles.book}`}>To book</span>
				)}
			</span>
			{(hotel.room_type || hotel.brand) && (
				<span className={styles.sub}>{hotel.room_type ?? hotel.brand}</span>
			)}
		</>
	);

	const hotelEnrichment = enrichment?.hotels?.find(
		(enrichedHotel) => enrichedHotel.hotel === hotel.name,
	);
	const city =
		enrichment?.page_cards?.find(
			(card) =>
				card.city && hotel.name.toLowerCase().includes(card.city.toLowerCase()),
		)?.city ?? hotel.name.split(/\s+[— -]\s+|\s+hotel\s+/i)[0].trim();

	const detail: ReactNode = (
		<>
			<Facts>
				{hotel.confirmation && (
					<Fact label="Confirmation" value={hotel.confirmation} />
				)}
				{hotel.check_in && (
					<Fact
						label="Check-in"
						value={`${hotel.check_in.date}${hotel.check_in.after_time ? ` · ${formatTimeString(hotel.check_in.after_time)}` : ""}`}
					/>
				)}
				{hotel.check_out && (
					<Fact
						label="Check-out"
						value={`${hotel.check_out.date}${hotel.check_out.before_time ? ` · ${formatTimeString(hotel.check_out.before_time)}` : ""}`}
					/>
				)}
				{hotel.room_type && <Fact label="Room" value={hotel.room_type} />}
				{hotel.notes && <Fact label="Note" value={hotel.notes} />}
			</Facts>
			{hotelEnrichment?.blurb && (
				<p className={styles.blurb}>{hotelEnrichment.blurb.trim()}</p>
			)}
			<div className={styles.links}>
				{hotelEnrichment?.website && (
					<BtnLink href={hotelEnrichment.website} icon="ext">
						Hotel page
					</BtnLink>
				)}
				{hotelEnrichment?.map_url && (
					<BtnLink href={hotelEnrichment.map_url} icon="pin">
						Map
					</BtnLink>
				)}
				{hotelEnrichment?.phone && (
					<BtnLink
						href={`tel:${hotelEnrichment.phone.replace(/\s/g, "")}`}
						icon="phone"
					>
						{hotelEnrichment.phone}
					</BtnLink>
				)}
				{hotel.status === "to_book" && (
					<BtnLink
						href={ihgSearch(
							city,
							String(hotel.check_in?.date),
							String(hotel.check_out?.date),
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
			isToBook={hotel.status === "to_book"}
			row={row}
		>
			{detail}
		</TimelineItem>
	);
}
