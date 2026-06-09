import type { PrepItem } from "./trip-enrichment";

const MS_PER_DAY = 86_400_000;

// Whole-day count between two dates, measured at UTC midnight so a YYYY-MM-DD
// key and an injected clock compare without timezone drift. Positive when
// `to` is after `from`.
function daysBetween(from: Date | string, to: Date | string): number {
	const a = atUtcMidnight(from);
	const b = atUtcMidnight(to);
	return Math.round((b - a) / MS_PER_DAY);
}

function atUtcMidnight(d: Date | string): number {
	const date =
		typeof d === "string" ? new Date(`${d.slice(0, 10)}T00:00:00Z`) : d;
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

// Staleness band of `checkedOn` relative to departure (design Metric 3). The
// tolerated age tightens as departure nears: >90d out tolerates a 90d age;
// within 1 month require <1 month; within 2 weeks <2 weeks; within 1 week
// <1 week; within 1 day always "stale". TESTABILITY INVARIANT: `today` is a
// PARAMETER — never call Date.now() inside, so tests stay deterministic.
export type StalenessBand = "fresh" | "stale";

export function stalenessBand(
	checkedOn: string, // YYYY-MM-DD
	departure: string, // itinerary.trip.start_date, YYYY-MM-DD
	today: Date, // injected clock
): StalenessBand {
	const daysToDeparture = daysBetween(today, departure);
	const age = daysBetween(checkedOn, today);

	// Within 1 day of departure always prompts a re-check, regardless of age.
	if (daysToDeparture <= 1) return "stale";

	// Tolerated age narrows in steps as departure approaches.
	let tolerated: number;
	if (daysToDeparture <= 7) {
		tolerated = 7; // within 1 week
	} else if (daysToDeparture <= 14) {
		tolerated = 14; // within 2 weeks
	} else if (daysToDeparture <= 30) {
		tolerated = 30; // within 1 month
	} else {
		tolerated = 90; // more than 90 days out
	}

	return age <= tolerated ? "fresh" : "stale";
}

// Per-item deadline state from lead_time_days/warn_lead_days (design Metric 6).
// The item's deadline is `lead_time_days` before departure; it WARNS when today
// is within `warn_lead_days` (default 7) of that deadline and status !== "done",
// and ESCALATES once the deadline has passed. Same `today`-injection invariant.
export type DeadlineState = "ok" | "warn" | "overdue";

export function deadlineState(
	item: PrepItem,
	departure: string, // YYYY-MM-DD
	today: Date, // injected clock
): DeadlineState {
	// No declared lead time and a done item are never warned/escalated.
	if (item.lead_time_days == null || item.status === "done") return "ok";

	// Days from today until the item's deadline (lead_time_days before departure).
	const daysToDeparture = daysBetween(today, departure);
	const daysToDeadline = daysToDeparture - item.lead_time_days;
	const warnLead = item.warn_lead_days ?? 7;

	if (daysToDeadline < 0) return "overdue";
	if (daysToDeadline <= warnLead) return "warn";
	return "ok";
}
