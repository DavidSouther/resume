import { Card } from "@davidsouther/jiffies/dom/components/index.ts";
import { a, div, h3, main } from "@davidsouther/jiffies/dom/html.ts";
import type { Post } from "../lib/posts.ts";

// A single blog post inside a page-spine <main> (jiffies-css clamps the post to
// the responsive base viewport width). The body is pre-rendered HTML.
export function renderBlogPost(post: Post): HTMLElement {
	const { title, body, date } = post;
	const bodyDiv = Object.assign(div(), { innerHTML: body ?? "" });
	return main(
		Card(
			{
				header: h3(
					a({ href: "/" }, "David Souther"),
					` - ${title} - ${(date ?? "").replace(/T.*/, "")}`,
				),
				footer: a({ href: "../../" }, "Back"),
			},
			bodyDiv,
		),
	);
}
