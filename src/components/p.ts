import { toHTML } from "@davidsouther/jiffdown";
import { a, div, span } from "@davidsouther/jiffies/dom/html.ts";

// MD renders a markdown string to an HTML <div>. Mirrors the React component's
// dangerouslySetInnerHTML: jiffdown converts the text, the result is assigned
// as innerHTML so the SSG serializes it verbatim.
export function MD(text: string): HTMLDivElement {
	return Object.assign(div(), { innerHTML: toHTML(text) ?? "" });
}

// A renders a link when an href is given, otherwise a bare span — matching the
// resume's "linked-or-plain label" idiom.
export function A(href: string | undefined, text: string): HTMLElement {
	return href ? a({ href }, text) : span(text);
}
