import { Card } from "@davidsouther/jiffies/dom/components/index.ts";
import { h3 } from "@davidsouther/jiffies/dom/html.ts";

// Wraps the jiffies Card with an <h3>-labelled header and an optional class on
// the <article>, reproducing the resume's former local Card component (the
// jiffies Card emits no class and no header wrapper element of its own).
export function card(
	className: string,
	header: string,
	...body: (Node | string)[]
): HTMLElement {
	const article = Card({ header: h3(header) }, ...body);
	if (className) article.className = className;
	return article;
}
