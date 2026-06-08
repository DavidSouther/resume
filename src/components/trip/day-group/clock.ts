import { time } from "@davidsouther/jiffies/dom/html.ts";
import {
	formatClock,
	parseDateTime,
	timezoneAbbreviation,
} from "../../../lib/itinerary-helpers.ts";
import type { DateTimeWithTz } from "../../../lib/trips.ts";

export function Clock(
	wallTime: DateTimeWithTz | undefined | null,
): HTMLElement | null {
	const parsed = parseDateTime(wallTime?.datetime);
	if (!parsed) return null;
	return time(
		`${formatClock(parsed.hours, parsed.minutes)} ${timezoneAbbreviation(parsed.date, wallTime?.timezone)}`,
	);
}
