import type { DenormChildren } from "@davidsouther/jiffies/dom/dom.ts";
import { b, div, span } from "@davidsouther/jiffies/dom/html.ts";

// (children) — positional from the original prop object.
export function Facts(
	children: DenormChildren | DenormChildren[],
): HTMLElement {
	const childNodes: DenormChildren[] = Array.isArray(children)
		? children
		: [children];
	return div({ class: "facts" }, ...childNodes);
}

// (label, value) — positional from the original prop object.
export function Fact(label: string, value: string): HTMLElement {
	return div({ class: "fact" }, b(label), span(value));
}
