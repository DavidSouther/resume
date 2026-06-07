import { div } from "@davidsouther/jiffies/dom/html.ts";

// (wikiTitle) — positional from the original prop object.
// The original is a client component that lazily fetches the Wikipedia image
// and fades it in. Server-rendered with no interactivity, the initial state has
// an empty src: the `in` class is absent and no inline background style is set.
export function WikiPhoto(_wikiTitle: string): HTMLElement {
	return div({ class: "hero-img" });
}
