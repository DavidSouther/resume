import { toChildren } from "@davidsouther/jiffies/components/children.ts";
import { Accordion, Panel } from "@davidsouther/jiffies/components/index.ts";
import type { DenormChildren } from "@davidsouther/jiffies/dom/dom.ts";
import { li } from "@davidsouther/jiffies/dom/html.ts";
import { SvgIcon } from "./icons.ts";

// A timeline entry. The icon + `row` form the item's summary; `children` are the
// disclosed detail. Expandable items are a native <details> disclosure (the
// jiffies Accordion) that opens with no client JS; non-expandable items are a
// flat panel (jiffies Panel) with no body. Status (e.g. "To book") is carried by
// a <mark> inside the row, not by a card-level class.
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
	const summary: DenormChildren[] = [SvgIcon(icon), ...toChildren(row)];

	if (!expandable) {
		return li(Panel({}, ...summary));
	}
	return li(Accordion({ summary }, ...children));
}
