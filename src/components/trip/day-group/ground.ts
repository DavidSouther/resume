import { span } from "@davidsouther/jiffies/dom/html.ts";
import {
	formatClock,
	type ItineraryItem,
	parseDateTime,
	timezoneAbbreviation,
} from "../../../lib/itinerary-helpers.ts";
import { kids } from "../../children.ts";
import { TimelineItem } from "../timeline-item.ts";
import { Fact, Facts } from "./fact.ts";

type GroundItemData = Extract<ItineraryItem, { kind: "ground" }>;

function capitalize(input: string): string {
	return input.charAt(0).toUpperCase() + input.slice(1);
}

// (item) — positional from the original prop object.
export function GroundItem(item: GroundItemData): HTMLElement {
	const ground = item.data;
	const pickupDateTime = parseDateTime(ground.pickup?.datetime);
	const from = ground.pickup?.location;
	const to = ground.dropoff?.location;
	const isFerry = /ferry|boat/i.test(
		(ground.notes ?? "") + (ground.type ?? ""),
	);

	const row = kids(
		pickupDateTime
			? span(
					{ class: "timeline-times" },
					span(
						`${formatClock(pickupDateTime.hours, pickupDateTime.minutes)} ${timezoneAbbreviation(pickupDateTime.date, ground.pickup?.timezone)}`,
					),
				)
			: null,
		span(
			{ class: "title" },
			capitalize(ground.type ?? "Transfer"),
			...kids(
				ground.status === "to_book"
					? span({ class: "badge book" }, "To book")
					: null,
			),
		),
		from || to
			? span({ class: "sub" }, [from, to].filter(Boolean).join("  →  "))
			: null,
	);

	const detail = Facts(
		kids(
			ground.provider ? Fact("Booked via", ground.provider) : null,
			ground.notes ? Fact("Note", ground.notes) : null,
		),
	);

	return TimelineItem(
		isFerry ? "boat" : "car",
		!!(ground.notes || ground.provider),
		ground.status === "to_book",
		row,
		detail,
	);
}
