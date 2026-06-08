import { toChildren } from "@davidsouther/jiffies/components/children.ts";
import type { DenormChildren } from "@davidsouther/jiffies/dom/dom.ts";
import { hgroup, mark, small, strong } from "@davidsouther/jiffies/dom/html.ts";

// The uniform itinerary summary row: an optional leading <time> followed by an
// <hgroup> of a bold title (the to-book <mark> inline) and an optional subtitle.
// Returns the flat [time?, hgroup] child list the timeline grid places by column,
// so the row shape lives in one place instead of being hand-repeated across the
// five day-group builders. `title` accepts a composite child list (the flight
// route is abbr → abbr); every other builder passes a scalar string.
export function SummaryRow({
	time = null,
	title,
	toBook = false,
	subtitle = null,
}: {
	time?: DenormChildren;
	title: DenormChildren | DenormChildren[];
	toBook?: boolean;
	subtitle?: string | null | false;
}): DenormChildren[] {
	return [
		time,
		hgroup(
			strong(...toChildren(title), toBook ? mark("To book") : null),
			subtitle ? small(subtitle) : null,
		),
	];
}
