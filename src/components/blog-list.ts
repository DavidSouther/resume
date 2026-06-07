import { Card } from "@davidsouther/jiffies/components/card.ts";
import { h3 } from "@davidsouther/jiffies/dom/html.ts";
import type { Post } from "../lib/posts.ts";
import { IDLinkList } from "./list.ts";

// The /blog index: a "Posts" card linking each post by title.
export function renderBlogList(posts: Post[]): HTMLElement {
	return Card(
		{ header: h3("Posts") },
		IDLinkList(
			posts,
			({ id }) => `/blog/${id}`,
			({ title }) => title ?? "Unknown",
		),
	);
}
