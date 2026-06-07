import { a } from "@davidsouther/jiffies/dom/html.ts";
import { SvgIcon } from "../icons.ts";

// (href, icon, children) — positional from the original prop object.
export function BtnLink(
	href: string,
	icon: string,
	children: Node | string | (Node | string)[],
): HTMLElement {
	const external = /^https?:/.test(href);
	const childNodes = Array.isArray(children) ? children : [children];
	return a(
		external
			? { class: "btn", href, target: "_blank", rel: "noopener noreferrer" }
			: { class: "btn", href },
		SvgIcon(icon),
		...childNodes,
	);
}
