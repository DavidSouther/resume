import { b, div, span } from "@davidsouther/jiffies/dom/html.ts";

// (children) — positional from the original prop object.
export function Facts(
	children: Node | string | (Node | string)[],
): HTMLElement {
	const childNodes = Array.isArray(children) ? children : [children];
	return div({ class: "facts" }, ...childNodes);
}

// (label, value) — positional from the original prop object.
export function Fact(label: string, value: string): HTMLElement {
	return div({ class: "fact" }, b(label), span(value));
}
