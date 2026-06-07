import type { Post } from "../lib/posts.ts";
import { card } from "./card.ts";
import { IDLinkList } from "./list.ts";

// The /blog index: a "Posts" card linking each post by title.
export function renderBlogList(posts: Post[]): HTMLElement {
	return card(
		"",
		"Posts",
		IDLinkList(
			posts,
			({ id }) => `/blog/${id}`,
			({ title }) => title ?? "Unknown",
		),
	);
}
