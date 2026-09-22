import { Card } from "@davidsouther/jiffies/components/index.ts";
import { a, div, h1, main, p } from "@davidsouther/jiffies/dom/html.ts";
import type { Post } from "../lib/posts.ts";

// A single blog post inside a page-spine <main> (jiffies-css clamps the post to
// the responsive base viewport width). The body is pre-rendered HTML.
export function renderBlogPost(post: Post): HTMLElement {
	const { title, body, date, slides } = post;
	const bodyDiv = Object.assign(div(), {
		className: slides ? "slide-deck" : "",
		innerHTML: body ?? "",
	});
	return main(
		{ class: slides ? "fluid" : "" },
		Card(
			{
				class: "post",
				// A real h1: it's the page's only top-level heading, so it reads as
				// the apex of the page rather than a peer of the h2/h3 section
				// headings jiffdown emits below it. The byline/date is a quieter
				// line underneath, not a kicker above the title.
				header: [
					h1(title ?? "Untitled"),
					p(
						{ class: "byline" },
						a({ href: "/" }, "David Souther"),
						` — ${(date ?? "").replace(/T.*/, "")}`,
					),
				],
				// One directory up from the post (`/blog/<id>/` -> `/blog/`), not two
				// (which landed on the site root instead of the post list).
				footer: a({ href: "../" }, "Back"),
			},
			bodyDiv,
		),
	);
}
