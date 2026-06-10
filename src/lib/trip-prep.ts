import type { PrepItem } from "./trip-enrichment";

const MS_PER_DAY = 86_400_000;

// UTC-midnight epoch ms for a Date or a YYYY-MM-DD key, so a date key and any
// arithmetic compare without timezone drift.
function atUtcMidnight(d: Date | string): number {
	const date =
		typeof d === "string" ? new Date(`${d.slice(0, 10)}T00:00:00Z`) : d;
	return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
}

// Fixed en-GB, UTC formatter so the rendered date never drifts with the host
// timezone (the only date form the reader ever sees — design §3).
const PREP_DATE_FORMAT = new Intl.DateTimeFormat("en-GB", {
	day: "numeric",
	month: "long",
	year: "numeric",
	timeZone: "UTC",
});

// Render a YYYY-MM-DD key as an absolute "D MMMM YYYY" string ("22 October
// 2026"). Pure. Parses at UTC midnight (reusing atUtcMidnight) and formats with
// the fixed UTC formatter so the output never drifts with the host timezone.
export function formatPrepDate(iso: string): string {
	return PREP_DATE_FORMAT.format(atUtcMidnight(iso));
}

// The absolute apply-by deadline for an item carrying lead_time_days: the date
// `leadTimeDays` days before `departure` (both UTC-midnight), rendered through
// formatPrepDate. e.g. departure 2026-07-11 − 7 = "4 July 2026". Pure; no clock.
export function deadlineDate(departure: string, leadTimeDays: number): string {
	const deadlineMs = atUtcMidnight(departure) - leadTimeDays * MS_PER_DAY;
	return PREP_DATE_FORMAT.format(deadlineMs);
}

// True iff any checklist item needs action — drives the aggregate "Action
// needed" badge in the collapsed summary (design §2). Pure; an empty checklist
// is false.
export function anyActionNeeded(checklist: PrepItem[]): boolean {
	return checklist.some((i) => i.status === "action_needed");
}
