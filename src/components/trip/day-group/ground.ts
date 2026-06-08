import { mark, small, span, strong } from "@davidsouther/jiffies/dom/html.ts";
import type { ItineraryItem } from "../../../lib/itinerary-helpers.ts";
import { TimelineItem } from "../timeline-item.ts";
import { Clock } from "./clock.ts";
import { Fact, Facts } from "./fact.ts";

type GroundItemData = Extract<ItineraryItem, { kind: "ground" }>;

function capitalize(input: string): string {
	return input.charAt(0).toUpperCase() + input.slice(1);
}

// (item) — positional from the original prop object.
export function GroundItem(item: GroundItemData): HTMLElement {
	const ground = item.data;
	const from = ground.pickup?.location;
	const to = ground.dropoff?.location;
	const isFerry = /ferry|boat/i.test(
		(ground.notes ?? "") + (ground.type ?? ""),
	);

	const row = [
		Clock(ground.pickup),
		span(
			strong(capitalize(ground.type ?? "Transfer")),
			ground.status === "to_book" ? mark("To book") : null,
		),
		from || to ? small([from, to].filter(Boolean).join("  →  ")) : null,
	];

	const detail = Facts(
		ground.provider ? Fact("Booked via", ground.provider) : null,
		ground.notes ? Fact("Note", ground.notes) : null,
	);

	return TimelineItem(
		{
			icon: isFerry ? "boat" : "car",
			expandable: !!(ground.notes || ground.provider),
			row,
		},
		detail,
	);
}
