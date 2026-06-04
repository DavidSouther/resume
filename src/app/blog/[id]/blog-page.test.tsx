// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type { Post } from "~/lib/posts";
import BlogPage from "./blog-page";

afterEach(cleanup);

// BlogPage is an async server component; await it to get the element tree, then
// render that. The body is injected verbatim as HTML, so it carries real tags.
const post: Post = {
	id: "a-post",
	show: true,
	title: "A Post",
	date: "2024-01-02T10:30:00.000Z",
	body: "<p>Hello <strong>world</strong></p>",
};

describe("BlogPage", () => {
	it("renders the title in the header", async () => {
		render(await BlogPage({ post }));

		expect(screen.getByRole("heading").textContent).toContain("A Post");
	});

	it("renders the date with the time portion stripped", async () => {
		render(await BlogPage({ post }));

		const header = screen.getByRole("heading").textContent ?? "";
		expect(header).toContain("2024-01-02");
		expect(header).not.toContain("10:30");
	});

	it("injects the post body as HTML", async () => {
		const { container } = render(await BlogPage({ post }));

		expect(container.querySelector("main strong")?.textContent).toBe("world");
	});

	it("renders a Back link to the parent path", async () => {
		render(await BlogPage({ post }));

		expect(
			screen.getByRole("link", { name: "Back" }).getAttribute("href"),
		).toBe("../../");
	});

	it("renders an empty body without throwing", async () => {
		const { container } = render(
			await BlogPage({ post: { id: "x", show: true, title: "X" } }),
		);

		expect(container.querySelector("main")?.textContent).toBe("");
	});
});
