import {
	formatClock,
	type ItineraryItem,
	parseDateTime,
} from "../../../lib/itinerary-helpers.ts";
import { icsDataUri } from "../../../lib/transfer-alarm.ts";
import { TimelineItem } from "../timeline-item.ts";
import { Actions, BtnLink } from "./btn-link.ts";
import { Clock } from "./clock.ts";
import { Fact, Facts } from "./fact.ts";
import { SummaryRow } from "./summary-row.ts";

type GroundItemData = Extract<ItineraryItem, { kind: "ground" }>;

function capitalize(input: string): string {
	return input.charAt(0).toUpperCase() + input.slice(1);
}

// A booked transfer whose dropoff is an airport gets a visible time + an
// add-to-calendar alarm. When a pickup time is booked we anchor "leave by" to
// it; otherwise we only know the airport-arrival time, so it is an honest "be at
// <airport> by" reminder rather than a fabricated leave time.
type AlarmParts = { fact: [HTMLElement, HTMLElement]; button: HTMLElement };

function airportAlarm(ground: GroundItemData["data"]): AlarmParts | null {
	const code = String(ground.dropoff?.location ?? "").match(
		/\(([A-Z]{3})\)/,
	)?.[1];
	if (!code) return null;
	const pickupAt = parseDateTime(ground.pickup?.datetime);
	const dropoffAt = parseDateTime(ground.dropoff?.datetime);
	const anchor = pickupAt ?? dropoffAt;
	if (!anchor) return null;

	const time = formatClock(anchor.hours, anchor.minutes);
	const via = ground.provider ? ` (${ground.provider})` : "";
	const { fact, event } = pickupAt
		? {
				fact: Fact("Leave by", `${time} — booked pickup for ${code}`),
				event: {
					uid: `leave-${code}-${anchor.date}`,
					title: `Leave for ${code}`,
					start: anchor,
					end: dropoffAt ?? undefined,
					description: `Booked transfer to ${ground.dropoff?.location}${via}.`,
					location: ground.pickup?.location,
				},
			}
		: {
				fact: Fact("Be at airport", `${code} by ${time}`),
				event: {
					uid: `arrive-${code}-${anchor.date}`,
					title: `Be at ${code} by ${time}`,
					start: anchor,
					description: `Booked transfer arrives ${ground.dropoff?.location}${via}.`,
					location: ground.dropoff?.location,
				},
			};
	return {
		fact,
		button: BtnLink(icsDataUri(event), "bell", "Add alarm", {
			download: `transfer-${code}.ics`,
		}),
	};
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

	const alarm = airportAlarm(ground);
	const facts =
		ground.provider || ground.notes || alarm
			? Facts(
					alarm ? alarm.fact : null,
					ground.provider ? Fact("Booked via", ground.provider) : null,
					ground.notes ? Fact("Note", ground.notes) : null,
				)
			: null;

	return TimelineItem(
		{
			icon: isFerry ? "boat" : "car",
			expandable: !!(ground.notes || ground.provider || alarm),
			row,
		},
		facts,
		alarm ? Actions(alarm.button) : null,
	);
}
