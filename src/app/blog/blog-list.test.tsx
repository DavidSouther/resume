// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Post } from "~/lib/posts";
import BlogList from "./blog-list";

afterEach(cleanup);

// A Post only needs id/show for the list; title drives the link text and is
// the field BlogList falls back on when absent.
function post(over: Partial<Post> & { id: string }): Post {
	return { show: true, ...over };
}

describe("BlogList", () => {
	it("renders a Posts card header", () => {
		render(<BlogList posts={[]} />);

		expect(screen.getByRole("heading", { name: "Posts" }).tagName).toBe("H3");
	});

	it("renders one link per post, to blog/<id> with the title as text", () => {
		const posts = [
			post({ id: "first", title: "First Post" }),
			post({ id: "second", title: "Second Post" }),
		];

		render(<BlogList posts={posts} />);

		const links = screen.getAllByRole("link");
		expect(links).toHaveLength(2);
		expect(links[0].getAttribute("href")).toBe("blog/first");
		expect(links[0].textContent).toBe("First Post");
	});

	it("labels a post with no title as Unknown", () => {
		render(<BlogList posts={[post({ id: "untitled" })]} />);

		const link = screen.getByRole("link");
		expect(link.getAttribute("href")).toBe("blog/untitled");
		expect(link.textContent).toBe("Unknown");
	});
});
