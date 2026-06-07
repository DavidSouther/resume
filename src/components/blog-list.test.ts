// @vitest-environment jsdom
import { getAllByRole } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import type { Post } from "../lib/posts.ts";
import { renderBlogList } from "./blog-list.ts";
import { mount, resetDom } from "./test-dom.ts";

afterEach(resetDom);

const posts: Post[] = [
	{ id: "a", show: true, title: "Alpha" },
	{ id: "b", show: true, title: undefined },
];

describe("renderBlogList", () => {
	it("links each post by id, falling back to 'Unknown' for a missing title", () => {
		const container = mount(renderBlogList(posts));

		const links = getAllByRole(container, "link");
		expect(links).toHaveLength(2);
		expect(links[0].getAttribute("href")).toBe("/blog/a");
		expect(links[0].textContent).toBe("Alpha");
		expect(links[1].getAttribute("href")).toBe("/blog/b");
		expect(links[1].textContent).toBe("Unknown");
	});
});
