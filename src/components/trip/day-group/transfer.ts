import { div, span } from "@davidsouther/jiffies/dom/html.ts";
import { type ItineraryItem, mapsDir } from "../../../lib/itinerary-helpers.ts";
import { TimelineItem } from "../timeline-item.ts";
import { BtnLink } from "./btn-link.ts";

type TransferItemData = Extract<ItineraryItem, { kind: "transfer" }>;

// (item) — positional from the original prop object.
export function TransferItem(item: TransferItemData): HTMLElement {
	const td = item.data;
	const place = td.city ?? td.airport;

	const row = [
		span(
			{ class: "title" },
			td.dir === "in" ? "Arrival transfer" : "Departure transfer",
		),
		span(
			{ class: "sub" },
			td.dir === "in"
				? `${td.airport}  →  ${place}`
				: `${place}  →  ${td.airport}`,
		),
	];

	const ap = `${td.airport} Airport`;
	const origin = td.dir === "in" ? ap : place;
	const dest = td.dir === "in" ? place : ap;

	const detail = [
		div({ class: "skel" }, "Suggested transfer — not booked."),
		div(
			{ class: "links" },
			BtnLink(mapsDir(origin, dest, "driving"), "car", "Car · Maps"),
			BtnLink(mapsDir(origin, dest, "transit"), "pin", "Public transit"),
		),
	];

	return TimelineItem("car", true, undefined, row, detail);
}
