import { a, li, ul } from "@davidsouther/jiffies/dom/html.ts";

// Renders one <li> per item, content supplied by the `item` render callback.
export function List<T extends { id: string }>(
	items: T[],
	item: (element: T) => Node | string,
): HTMLElement {
	return ul(...items.map((element) => li(item(element))));
}

// A List whose items are links, built from `href` and `link` accessors.
export function IDLinkList<T extends { id: string }>(
	items: T[],
	href: (element: T) => string,
	link: (element: T) => string,
): HTMLElement {
	return List(items, (element) => a({ href: href(element) }, link(element)));
}
