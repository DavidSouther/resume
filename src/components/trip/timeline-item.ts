import { Accordion } from "@davidsouther/jiffies/components/index.ts";
import type { DenormChildren } from "@davidsouther/jiffies/dom/dom.ts";
import { div, li, span } from "@davidsouther/jiffies/dom/html.ts";
import { SvgIcon } from "./icons.ts";

// (icon, expandable, isToBook, row, children) — positional from the original
// prop object. Expandable items render as a native <details>/<summary>
// disclosure (the jiffies Accordion) so they open with no client JS;
// non-expandable items are a plain, static row.
export function TimelineItem(
	icon: string,
	expandable: boolean,
	isToBook: boolean | undefined,
	row: DenormChildren | DenormChildren[],
	children?: DenormChildren | DenormChildren[],
): HTMLElement {
	const cardClass = ["card", isToBook ? "tobook" : ""]
		.filter(Boolean)
		.join(" ");

	const rowChildren: DenormChildren[] = Array.isArray(row) ? row : [row];
	const detailChildren: DenormChildren[] = Array.isArray(children)
		? children
		: children
			? [children]
			: [];

	const node = span({ class: "node" }, SvgIcon(icon));
	const rowMain = span({ class: "row-main" }, ...rowChildren);

	if (!expandable) {
		return li(
			{ class: "item" },
			div({ class: cardClass }, div({ class: "row" }, node, rowMain)),
		);
	}

	return li(
		{ class: "item" },
		Accordion(
			{
				class: cardClass,
				// The jiffies accordion renders the disclosure chevron itself
				// (summary::after); no chevron child is needed here.
				summary: [node, rowMain],
			},
			div({ class: "detail" }, ...detailChildren),
		),
	);
}
