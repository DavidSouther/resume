import { toChildren } from "@davidsouther/jiffies/components/children.ts";
import { Accordion, Panel } from "@davidsouther/jiffies/components/index.ts";
import type { DenormChildren } from "@davidsouther/jiffies/dom/dom.ts";
import { li } from "@davidsouther/jiffies/dom/html.ts";
import { SvgIcon } from "./icons.ts";

// A timeline entry. The icon sits in the day's left timeline gutter (a direct
// child of the <li>, a sibling of the card), so a continuous vertical line can
// thread through every day's icons without crossing the card surfaces; `row`
// is the card's summary and `children` are the disclosed detail. Expandable
// items are a native <details> disclosure (the jiffies Accordion) that opens
// with no client JS; non-expandable items are a flat panel (jiffies Panel) with
// no body. Status (e.g. "To book") is carried by a <mark> inside the row, not by
// a card-level class.
//
// `row` is a singular slot in the attrs object (like Accordion's `summary`),
// per the jiffies component API: attrs object with named slots, then a flat
// list of body children.
export function TimelineItem(
	{
		icon,
		expandable = true,
		row,
	}: {
		icon: string;
		expandable?: boolean;
		row: DenormChildren | DenormChildren[];
	},
	...children: DenormChildren[]
): HTMLElement {
	const summary = toChildren(row);

	if (!expandable) {
		return li(SvgIcon(icon), Panel({}, ...summary));
	}
	return li(SvgIcon(icon), Accordion({ summary }, ...children));
}
