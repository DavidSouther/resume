// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { getSortedPosts } from "~/lib/posts";
import Page from "./page";

afterEach(cleanup);

// Integration-style: Page reads the real committed posts/ fixtures via
// getSortedPosts(), so the suite derives its expectations from that same call
// rather than hardcoding any post.
describe("blog Page", () => {
	it("renders the Posts card header", async () => {
		render(await Page());

		expect(screen.getByRole("heading", { name: "Posts" }).tagName).toBe("H3");
	});

	it("renders one link per shown post", async () => {
		render(await Page());

		const expected = getSortedPosts().length;
		expect(screen.getAllByRole("link")).toHaveLength(expected);
	});

	it("links each post under blog/<id>", async () => {
		render(await Page());

		for (const link of screen.getAllByRole("link")) {
			expect(link.getAttribute("href")).toMatch(/^blog\//);
		}
	});
});
