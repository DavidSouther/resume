// The post and its candidate drafts render. This pins that they build, not
// what they say.

import { readdirSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import matter from "gray-matter";
import { describe, expect, it } from "vitest";
import { toHTML } from "../../../src/lib/markdown.ts";

const postDir = resolve(import.meta.dirname, "..");
const candidatesDir = resolve(postDir, "candidates");

const sources = [
	resolve(postDir, "post.md"),
	...readdirSync(candidatesDir)
		.filter((name) => name.endsWith(".md"))
		.map((name) => resolve(candidatesDir, name)),
];

describe("Rust tracing post builds", () => {
	for (const source of sources) {
		it(`renders ${source.slice(postDir.length + 1)} to HTML`, () => {
			const html = toHTML(matter(readFileSync(source, "utf8")).content);
			expect(html.trim()).not.toBe("");
		});
	}
});
