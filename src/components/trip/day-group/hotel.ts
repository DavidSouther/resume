import {
	mark,
	p,
	small,
	span,
	strong,
} from "@davidsouther/jiffies/dom/html.ts";
import {
	formatTimeString,
	type ItineraryItem,
	ihgSearch,
} from "../../../lib/itinerary-helpers.ts";
import type { TripEnrichment } from "../../../lib/trip-enrichment";
import { TimelineItem } from "../timeline-item.ts";
import { Actions, BtnLink } from "./btn-link.ts";
import { Fact, Facts } from "./fact.ts";

type HotelItemData = Extract<ItineraryItem, { kind: "hotel-in" | "hotel-out" }>;

// (item, enrichment) — positional from the original prop object.
export function HotelItem(
	item: HotelItemData,
	enrichment: TripEnrichment | undefined,
): HTMLElement {
	const hotel = item.data;
	const isIn = item.kind === "hotel-in";
	const time = isIn ? hotel.check_in?.after_time : hotel.check_out?.before_time;

	const row = [
		span(
			`${isIn ? "Check-in" : "Check-out"}${
				time ? ` ${isIn ? "after" : "by"} ${formatTimeString(time)}` : ""
			}`,
		),
		span(
			strong(hotel.name),
			hotel.status === "to_book" ? mark("To book") : null,
		),
		hotel.room_type || hotel.brand
			? small(hotel.room_type ?? hotel.brand ?? "")
			: null,
	];

	const hotelEnrichment = enrichment?.hotels?.find(
		(enrichedHotel) => enrichedHotel.hotel === hotel.name,
	);
	const city =
		enrichment?.page_cards?.find(
			(card) =>
				card.city && hotel.name.toLowerCase().includes(card.city.toLowerCase()),
		)?.city ?? hotel.name.split(/\s+[— -]\s+|\s+hotel\s+/i)[0].trim();

	const detail = [
		Facts(
			hotel.confirmation ? Fact("Confirmation", hotel.confirmation) : null,
			hotel.check_in
				? Fact(
						"Check-in",
						`${hotel.check_in.date}${hotel.check_in.after_time ? ` · ${formatTimeString(hotel.check_in.after_time)}` : ""}`,
					)
				: null,
			hotel.check_out
				? Fact(
						"Check-out",
						`${hotel.check_out.date}${hotel.check_out.before_time ? ` · ${formatTimeString(hotel.check_out.before_time)}` : ""}`,
					)
				: null,
			hotel.room_type ? Fact("Room", hotel.room_type) : null,
			hotel.notes ? Fact("Note", hotel.notes) : null,
		),
		hotelEnrichment?.blurb ? p(hotelEnrichment.blurb.trim()) : null,
		Actions(
			hotelEnrichment?.website
				? BtnLink(hotelEnrichment.website, "ext", "Hotel page")
				: null,
			hotelEnrichment?.map_url
				? BtnLink(hotelEnrichment.map_url, "pin", "Map")
				: null,
			hotelEnrichment?.phone
				? BtnLink(
						`tel:${hotelEnrichment.phone.replace(/\s/g, "")}`,
						"phone",
						hotelEnrichment.phone,
					)
				: null,
			hotel.status === "to_book"
				? BtnLink(
						ihgSearch(
							city,
							String(hotel.check_in?.date),
							String(hotel.check_out?.date),
						),
						"bed",
						"Find on IHG",
					)
				: null,
		),
	];

	return TimelineItem({ icon: isIn ? "bed" : "bedout", row }, ...detail);
}
