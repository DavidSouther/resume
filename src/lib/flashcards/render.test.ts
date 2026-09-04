import { describe, expect, it } from "vitest";
import { renderCardField } from "./render.ts";

describe("renderCardField", () => {
	it("renders plain markdown", () => {
		expect(renderCardField("**bold** text")).toContain("<strong>bold</strong>");
	});

	it("passes plain embedded HTML through unchanged", () => {
		const html = "How do <code>Vec&lt;T&gt;</code> and arrays differ?";
		expect(renderCardField(html)).toContain("<code>Vec&lt;T&gt;</code>");
	});

	// Documents a real, confirmed limitation (see render.ts's doc comment) —
	// this is a regression guard, not a spec for desired behavior. If this
	// ever starts passing (jiffdown stops treating bare `{...}` as its own
	// inline-block directive), the doc comment's warning is stale and should
	// be revisited, not deleted quietly.
	it("mangles literal Rust brace syntax — jiffdown's {tag: content} block collides with it", () => {
		const rendered = renderCardField("<code>S { x: y }</code>");
		expect(rendered).not.toContain("{ x: y }");
		expect(rendered).toContain("<x>y</x>"); // the corruption, made concrete
	});

	it("code-span-escaping the brace syntax avoids the {tag: content} collision", () => {
		// Backticks protect against the first bug, on their own — see the next
		// test for why that isn't enough to make this renderer safe overall.
		const rendered = renderCardField("`S { x: y }`");
		expect(rendered).toContain("<code>S { x: y }</code>");
	});

	// A second, separate collision that backtick-escaping does NOT fix: a bare
	// `>` followed (anywhere, not just at line start) by `{` triggers
	// jiffdown's own `>{block infostring} content` block directive. No code
	// span needed to reproduce it — and Rust syntax puts `>` directly ahead of
	// `{` constantly (`-> T { ... }`, `impl<T> S<T> { ... }`), so for a
	// Rust-reference deck this is the common case, not an edge case.
	it("mangles a bare '> {' even with no code span involved — jiffdown's own block-infostring syntax", () => {
		const rendered = renderCardField("plain text > {} more");
		expect(rendered).toContain("<blockquote>");
		expect(rendered).not.toContain("plain text > {} more");
	});

	it("the '> {' collision fires even inside a backtick-escaped code span", () => {
		const rendered = renderCardField("`Vec<T> {}`");
		expect(rendered).toContain("<blockquote>");
		expect(rendered).not.toContain("<code>Vec&lt;T&gt; {}</code>");
	});
});
