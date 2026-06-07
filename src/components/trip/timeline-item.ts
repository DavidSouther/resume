import type { DenormChildren } from "@davidsouther/jiffies/dom/dom.ts";
import { button, div, span } from "@davidsouther/jiffies/dom/html.ts";
import { SvgIcon } from "./icons.ts";

// (icon, expandable, isToBook, row, children) — positional from the original
// prop object. The original is a client component with an `open` toggle; server-
// rendered it starts closed (`item` without `open`, `aria-expanded="false"`).
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
	// `open` is always false in the server render, so the item class is just "item".
	const itemClass = "item";

	const rowChildren: DenormChildren[] = Array.isArray(row) ? row : [row];
	const detailChildren: DenormChildren[] = Array.isArray(children)
		? children
		: children
			? [children]
			: [];

	const btn = button(
		{
			type: "button",
			class: "row",
			disabled: !expandable,
		},
		span({ class: "node" }, SvgIcon(icon)),
		span({ class: "row-main" }, ...rowChildren),
		expandable ? span({ class: "chev" }, SvgIcon("chev")) : null,
	);
	// React renders the initial `open=false` state as aria-expanded="false".
	btn.setAttribute("aria-expanded", "false");

	return div(
		{ class: itemClass },
		div(
			{ class: cardClass },
			btn,
			expandable ? div({ class: "detail" }, ...detailChildren) : null,
		),
	);
}
