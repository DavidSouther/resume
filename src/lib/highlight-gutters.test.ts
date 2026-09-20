// @vitest-environment jsdom

import { describe, expect, it } from "vitest";
import {
	parseHighlightGutters,
	renderHighlightGutters,
	rewriteHighlightGutterFences,
} from "./highlight-gutters.ts";

const COMPLETE = `code rust:
let mut phrase = String::from("hi");
let result = phrase.clone();
let shared = &phrase;
let exclusive = &mut phrase;
consume(exclusive);
marks:
phrase 0,4
result copy phrase 1,4
shared &phrase 2,4
exclusive &mut phrase 3,4 move
reject 4`;

describe("parseHighlightGutters", () => {
	it("accepts source without a marks section", () => {
		const spec = parseHighlightGutters("code rust:\nlet art = artwork();");

		expect(spec.sourceLines).toEqual(["let art = artwork();"]);
		expect(spec.marks).toEqual([]);
		expect([...spec.rejectedLines]).toEqual([]);
	});

	it("parses every relation as a typed, declaration-ordered mark", () => {
		const spec = parseHighlightGutters(COMPLETE);

		expect(spec.language).toBe("rust");
		expect(spec.sourceLines).toHaveLength(5);
		expect(spec.marks).toEqual([
			{
				name: "phrase",
				startLine: 0,
				endLine: 4,
				move: false,
				colorIndex: 0,
				relation: { kind: "independent" },
			},
			{
				name: "result",
				startLine: 1,
				endLine: 4,
				move: false,
				colorIndex: 1,
				relation: { kind: "copy", source: "phrase" },
			},
			{
				name: "shared",
				startLine: 2,
				endLine: 4,
				move: false,
				colorIndex: 2,
				relation: { kind: "reference", source: "phrase" },
			},
			{
				name: "exclusive",
				startLine: 3,
				endLine: 4,
				move: true,
				colorIndex: 3,
				relation: { kind: "mutable-reference", source: "phrase" },
			},
		]);
		expect([...spec.rejectedLines]).toEqual([4]);
	});

	it.each([
		["missing code header", "marks:\na 0,0"],
		["duplicate marks header", "code rust:\na\nmarks:\na 0,0\nmarks:\nb 0,0"],
		["unknown language", "code not-a-language:\na\nmarks:\na 0,0"],
		["duplicate mark", "code rust:\na\nmarks:\na 0,0\na 0,0"],
		["unknown source", "code rust:\na\nmarks:\na &owner 0,0"],
		["backwards range", "code rust:\na\nmarks:\na 1,0"],
		["out of bounds", "code rust:\na\nmarks:\na 0,1"],
		["duplicate reject", "code rust:\na\nmarks:\nreject 0\nreject 0"],
	])("rejects %s with fence-local context", (_name, raw) => {
		expect(() => parseHighlightGutters(raw)).toThrow(/highlight-gutters/i);
	});
});

describe("renderHighlightGutters", () => {
	it("packs sequential references into one lane but separates overlapping references", () => {
		const sequential = parseHighlightGutters(`code rust:
let mut art = artwork();
let mref1 = &mut art;
use_it(mref1);
drop(mref1);
let mref2 = &mut art;
use_it(mref2);
marks:
art 0,5
mref1 &mut art 1,2
mref2 &mut art 4,5`);
		document.body.innerHTML = renderHighlightGutters(sequential);

		const gutter = document.querySelector<HTMLElement>(".highlight-gutters");
		expect(gutter?.style.getPropertyValue("--gutter-lanes")).toBe("2");
		expect(
			gutter
				?.querySelector('[data-gutter-mark="mref1"]')
				?.getAttribute("data-gutter-lane"),
		).toBe("1");
		expect(
			gutter
				?.querySelector('[data-gutter-mark="mref2"]')
				?.getAttribute("data-gutter-lane"),
		).toBe("1");

		const overlapping = parseHighlightGutters(`code rust:
let art = artwork();
let ref1 = &art;
let ref2 = &art;
use_it(ref1);
use_it(ref2);
marks:
art 0,4
ref1 &art 1,4
ref2 &art 2,4`);
		document.body.innerHTML = renderHighlightGutters(overlapping);

		const overlappingGutter =
			document.querySelector<HTMLElement>(".highlight-gutters");
		expect(overlappingGutter?.style.getPropertyValue("--gutter-lanes")).toBe(
			"3",
		);
		expect(
			overlappingGutter
				?.querySelector('[data-gutter-mark="ref1"]')
				?.getAttribute("data-gutter-lane"),
		).toBe("1");
		expect(
			overlappingGutter
				?.querySelector('[data-gutter-mark="ref2"]')
				?.getAttribute("data-gutter-lane"),
		).toBe("2");
	});

	it("keeps a connected source's geometry constant across its full extent", () => {
		const spec = parseHighlightGutters(`code rust:
let art = artwork();
observe(&art);
let borrowed = &art;
observe(borrowed);
drop(art);
marks:
art 0,4
borrowed &art 2,3`);
		document.body.innerHTML = renderHighlightGutters(spec);

		const ownerBands = [
			...document.querySelectorAll('[data-gutter-mark="art"]'),
		];
		expect(ownerBands).toHaveLength(5);
		expect(
			ownerBands.every((band) =>
				band.classList.contains("highlight-gutter-connected-source"),
			),
		).toBe(true);
	});

	it("renders unmarked source with zero gutter lanes", () => {
		const spec = parseHighlightGutters("code rust:\nlet art = artwork();");
		document.body.innerHTML = renderHighlightGutters(spec);

		const gutter = document.querySelector<HTMLElement>(".highlight-gutters");
		expect(gutter?.style.getPropertyValue("--gutter-lanes")).toBe("0");
		expect(gutter?.querySelectorAll("[data-gutter-band]")).toHaveLength(0);
		expect(gutter?.getAttribute("aria-label")).toBe(
			"Syntax-highlighted rust source",
		);
		expect(gutter?.querySelector(".hljs-keyword")?.textContent).toBe("let");
	});

	it("renders exact marked tokens without touching identifier substrings", () => {
		const spec = parseHighlightGutters(`code rust:
let phrase = "phrase";
let phrasebook = phrase;
marks:
phrase 0,1`);
		document.body.innerHTML = renderHighlightGutters(spec);

		expect(
			document.querySelectorAll('[data-gutter-token="phrase"]'),
		).toHaveLength(3);
		expect(document.querySelector("code")?.textContent).toContain("phrasebook");
		expect(document.querySelector(".hljs-keyword")?.textContent).toBe("let");
	});

	it("does not mark identifier names inside escaped HTML entities", () => {
		const source =
			'let lt = "<&>\\""; let gt = lt; let amp = gt; let quot = amp;';
		const spec = parseHighlightGutters(`code rust:
${source}
marks:
lt 0,0
gt 0,0
amp 0,0
quot 0,0`);
		document.body.innerHTML = renderHighlightGutters(spec);

		const code = document.querySelector("code");
		expect(code?.textContent).toBe(source);
		expect(code?.querySelectorAll('[data-gutter-token="lt"]')).toHaveLength(2);
		expect(code?.querySelectorAll('[data-gutter-token="gt"]')).toHaveLength(2);
		expect(code?.querySelectorAll('[data-gutter-token="amp"]')).toHaveLength(2);
		expect(code?.querySelectorAll('[data-gutter-token="quot"]')).toHaveLength(
			1,
		);
	});

	it("renders contiguous source rows without an upper title strip", () => {
		const spec = parseHighlightGutters(`code rust:
let phrase = "hi";
consume(phrase);
marks:
phrase 0,1`);
		document.body.innerHTML = renderHighlightGutters(spec);

		expect(document.querySelector(".highlight-gutter-labels")).toBeNull();
		const code = document.querySelector(".highlight-gutters code");
		expect(code?.children).toHaveLength(2);
		expect(
			[...(code?.childNodes ?? [])].every((node) => node.nodeType === 1),
		).toBe(true);
	});

	it("rewrites an escaped fence and is idempotent", () => {
		const escaped = `<pre><code class="language-highlight-gutters">code rust:
let phrase = &quot;hi&quot;;
marks:
phrase 0,0
</code></pre>`;
		const once = rewriteHighlightGutterFences(escaped);

		expect(once).toContain('class="highlight-gutters"');
		expect(rewriteHighlightGutterFences(once)).toBe(once);
	});
});
