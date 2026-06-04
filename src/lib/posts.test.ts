import { describe, expect, it } from "vitest";
import { getPost, getPostPaths, getSortedPosts } from "./posts";

// Integration-style: these run against the real committed `posts/` fixtures.
// Vitest runs from the project root, so the cwd()-relative reads in posts.ts
// resolve without mocking fs. Ids are derived from getPostPaths(), never
// hardcoded, so the suite does not depend on any single named post.

describe("getPostPaths", () => {
	it("returns one id per markdown file, with .md stripped", () => {
		const paths = getPostPaths();

		expect(paths.length).toBeGreaterThan(0);
		expect(paths.every((id) => !id.endsWith(".md"))).toBe(true);
	});
});

describe("getSortedPosts", () => {
	it("returns only shown posts", () => {
		const posts = getSortedPosts();

		expect(posts.every((post) => post.show === true)).toBe(true);
	});

	it("sorts by date descending", () => {
		const posts = getSortedPosts();

		// Undated posts default to "2999" in the comparator, sorting newest.
		const keys = posts.map((post) => post.date ?? "2999");
		const sorted = [...keys].sort().reverse();
		expect(keys).toEqual(sorted);
	});
});

describe("getPost", () => {
	it("renders body HTML for a known id", async () => {
		const id = getPostPaths()[0];

		const post = await getPost(id);

		expect(post.id).toBe(id);
		expect(typeof post.title).toBe("string");
		expect(post.body?.length ?? 0).toBeGreaterThan(0);
	});
});
