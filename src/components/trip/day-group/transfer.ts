import { small } from "@davidsouther/jiffies/dom/html.ts";
import {
	formatClock,
	type ItineraryItem,
	mapsDir,
} from "../../../lib/itinerary-helpers.ts";
import {
	departureLeaveBy,
	icsDataUri,
	type WallClock,
} from "../../../lib/transfer-alarm.ts";
import type { TripEnrichment } from "../../../lib/trip-enrichment";
import { TimelineItem } from "../timeline-item.ts";
import { Actions, BtnLink } from "./btn-link.ts";
import { Fact, Facts } from "./fact.ts";
import { SummaryRow } from "./summary-row.ts";

type TransferItemData = Extract<ItineraryItem, { kind: "transfer" }>;

const clockLabel = (c: WallClock): string => formatClock(c.hours, c.minutes);

// (item, enrichment) — enrichment supplies the door-to-airport estimate that
// turns a departure transfer into a leave-by + add-to-calendar alarm.
export function TransferItem(
	item: TransferItemData,
	enrichment?: TripEnrichment,
): HTMLElement {
	const td = item.data;
	// Prefer the stay's name over the bare city, falling back to the airport
	// when no hotel name is available.
	const place = td.hotel?.name ?? td.city ?? td.airport;

	const row = SummaryRow({
		title: td.dir === "in" ? "Arrival transfer" : "Departure transfer",
		subtitle:
			td.dir === "in"
				? `${td.airport}  →  ${place}`
				: `${place}  →  ${td.airport}`,
	});

	const ap = `${td.airport} Airport`;
	const origin = td.dir === "in" ? ap : place;
	const dest = td.dir === "in" ? place : ap;

	// Departure leave-by: work back from the flight by the airport buffer
	// (3h international / 2h domestic) plus the enrichment's Maps-estimated
	// door-to-airport minutes. No estimate → no alarm (display layer).
	const flight = td.dir === "out" ? td.flight : undefined;
	const flightCode = flight
		? `${flight.airline_code}${flight.flight_number}`
		: undefined;
	const transferMin = flightCode
		? enrichment?.transfers?.find((t) => t.flight === flightCode)?.minutes
		: undefined;
	const plan =
		flight && transferMin != null
			? departureLeaveBy(flight, transferMin)
			: null;

	let leaveByFact: HTMLElement | null = null;
	let alarm: HTMLElement | null = null;
	if (plan && flightCode) {
		const leaveByLabel = clockLabel(plan.leaveBy);
		const arriveByLabel = clockLabel(plan.arriveBy);
		const hours = plan.bufferMin / 60;
		leaveByFact = Facts(
			Fact(
				"Leave by",
				`${leaveByLabel} — to reach ${td.airport} ${hours}h before departure (${arriveByLabel}) with ~${plan.transferMin} min transfer`,
			),
		);
		const uri = icsDataUri({
			uid: `leave-${flightCode}-${plan.leaveBy.date}`,
			title: `Leave ${place} for ${td.airport}`,
			start: plan.leaveBy,
			end: plan.arriveBy,
			description: `Arrive at ${ap} by ${arriveByLabel} for ${flightCode}. ~${plan.transferMin} min transfer + ${hours}h airport time.`,
			location: place,
		});
		alarm = BtnLink(uri, "bell", "Add alarm", {
			download: `leave-for-${td.airport}.ics`,
		});
	}

	const detail = [
		small("Suggested transfer — not booked."),
		leaveByFact,
		Actions(
			BtnLink(mapsDir(origin, dest, "driving"), "car", "Car · Maps"),
			BtnLink(mapsDir(origin, dest, "transit"), "pin", "Public transit"),
			alarm,
		),
	];

	return TimelineItem({ icon: "car", row }, ...detail);
}
