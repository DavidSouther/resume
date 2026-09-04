import { describe, expect, it } from "vitest";
import { stripHtml } from "./html-text.ts";

describe("stripHtml", () => {
	it("removes tags and decodes common entities", () => {
		expect(
			stripHtml("How do <code>Vec&lt;T&gt;</code> and arrays differ?"),
		).toBe("How do Vec<T> and arrays differ?");
	});

	it("collapses whitespace left behind by stripped tags", () => {
		expect(stripHtml("<ul><li>a</li><li>b</li></ul>")).toBe("a b");
	});
});
