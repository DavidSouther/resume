import type { DenormChildren } from "@davidsouther/jiffies/dom/dom.ts";
import { a, div } from "@davidsouther/jiffies/dom/html.ts";
import { SvgIcon } from "../icons.ts";

// A horizontal row of action links (BtnLink). The sanctioned `.flex.row` utility
// owns the layout; extracted so that class lives in one place instead of being
// hand-repeated at every detail's action group.
export function Actions(...children: DenormChildren[]): HTMLElement {
	return div({ class: "flex row" }, ...children);
}

// (href, icon, children, opts) — positional from the original prop object.
// `opts.download` names the file for non-http hrefs (e.g. a data: .ics link),
// so the browser saves/opens it instead of navigating.
export function BtnLink(
	href: string,
	icon: string,
	children: Node | string | (Node | string)[],
	opts: { download?: string } = {},
): HTMLElement {
	const external = /^https?:/.test(href);
	const childNodes = Array.isArray(children) ? children : [children];
	return a(
		{
			href,
			role: "button",
			...(external ? { target: "_blank", rel: "noopener noreferrer" } : {}),
			...(opts.download ? { download: opts.download } : {}),
		},
		SvgIcon(icon),
		...childNodes,
	);
}
