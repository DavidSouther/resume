import type { ItineraryItem } from "../../../lib/itinerary-helpers.ts";
import { TimelineItem } from "../timeline-item.ts";
import { Clock } from "./clock.ts";
import { Fact, Facts } from "./fact.ts";
import { SummaryRow } from "./summary-row.ts";

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

	const row = SummaryRow({
		time: Clock(ground.pickup),
		title: capitalize(ground.type ?? "Transfer"),
		toBook: ground.status === "to_book",
		subtitle: from || to ? [from, to].filter(Boolean).join("  →  ") : null,
	});

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
