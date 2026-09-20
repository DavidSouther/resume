import { describe, expect, it } from "vitest";
import { toHTML } from "./markdown.ts";

describe("toHTML", () => {
	it("highlights a fence at build time", () => {
		const html = toHTML("```rust\nlet a = 1;\n```\n");

		expect(html).toContain("language-rust");
		expect(html).toContain("hljs");
	});

	it("leaves a fence in an unregistered language alone", () => {
		// A wrong guess is worse than no colour, so an unknown language keeps the
		// plain block jiffdown produced.
		const html = toHTML("```nonesuch\nwhatever\n```\n");

		expect(html).toContain("language-nonesuch");
		expect(html).not.toContain("hljs");
	});

	it("still renders ordinary prose through jiffdown", () => {
		expect(toHTML("# Heading\n")).toContain("<h1");
	});

	// The gutter fence must become its own markup before the highlighter runs,
	// or the highlighter meets a `highlight-gutters` language and guesses at it.
	it("rewrites a gutter fence rather than highlighting it as a language", () => {
		const html = toHTML("```highlight-gutters\ncode rust:\nlet a = 1;\n```\n");

		expect(html).toContain('class="highlight-gutters"');
		expect(html).not.toContain("language-highlight-gutters");
	});
});
