import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
	rewriteMermaidFences,
	splitHighlightedLines,
	toHTML,
} from "./markdown.ts";
import { MERMAID_ESM_URL, MERMAID_VERSION } from "./mermaid-bundle.ts";
import { getPost } from "./posts.ts";

describe("toHTML", () => {
	it("renders a mermaid fence as a mermaid container", () => {
		const html = toHTML("```mermaid\ntraceDiagram\n  frame f\n  end\n```\n");

		expect(html).toContain('<pre class="mermaid">');
		expect(html).not.toContain("language-mermaid");
		expect(html).toContain("traceDiagram");
	});

	it("leaves every other fence as a code block", () => {
		expect(toHTML("```rust\nlet a = 1;\n```\n")).toContain("language-rust");
	});

	it("pairs a semantic gutter with an adjacent trace diagram", () => {
		const html = toHTML(`\`\`\`highlight-gutters
code rust:
let phrase = "hi";
marks:
phrase 0,0
\`\`\`

\`\`\`mermaid
traceDiagram
  frame main
  end
\`\`\`
`);

		expect(
			html.match(/<figure class="trace-figure lifetime-composite">/g),
		).toHaveLength(1);
		expect(html.indexOf("highlight-gutters")).toBeLessThan(
			html.indexOf('<pre class="mermaid">'),
		);
	});

	it("keeps diagram source escaped", () => {
		const html = toHTML("```mermaid\ntraceDiagram\n  row a: <b> & x\n```\n");

		expect(html).not.toContain("<b>");
		expect(html).toContain("&lt;b&gt;");
	});

	it("still renders ordinary prose through jiffdown", () => {
		expect(toHTML("# Heading\n")).toContain("<h1");
	});
});

// The figure is where the resolved step sequence crosses from build time to the
// browser. It is written with the same `resolveStepsFromSource` the renderer
// resolves with, so a build-time ordinal and a client ordinal cannot drift.
describe("the figure's step sequence", () => {
	const gutterListing = `\`\`\`highlight-gutters
code rust:
fn main() {
    let art = artwork("Owain");
    println!("{}", art.name);
}
marks:
art 1,2
\`\`\`
`;

	it("publishes a tagged diagram's sequence on the figure", () => {
		const html = toHTML(`${gutterListing}
\`\`\`mermaid
traceDiagram
  frame main @0
    art: 7 @1
    watch art: 7 @2
    done @3
  end
\`\`\`
`);

		expect(html).toContain('data-trace-lines="0 1 2 3"');
		expect(html).toContain('<figure class="trace-figure lifetime-composite"');
	});

	it("leaves an untagged diagram's figure exactly as it was", () => {
		const html = toHTML(`${gutterListing}
\`\`\`mermaid
traceDiagram
  frame main
    art: 7
    done
  end
\`\`\`
`);

		expect(html).not.toContain("data-trace-lines");
		expect(html).toContain('<figure class="trace-figure lifetime-composite">');
	});

	it("unescapes the diagram before parsing it", () => {
		// jiffdown escaped `&` and `>`, so a heap pointer reaches this function as
		// `next -&gt; box` and a stack reference as `&amp;art`. Both must be
		// reversed before the parse, or the diagram fails to parse and the figure
		// silently loses its sequence.
		const html = toHTML(`${gutterListing}
\`\`\`mermaid
traceDiagram
  heap box 0x01 @0
    next -> box
  end
  frame main @1
    art: 7 @2
    ret &art -> art @3
    done @4
  end
\`\`\`
`);

		expect(html).toContain("&amp;art");
		expect(html).toContain('data-trace-lines="0 1 2 3 4"');
	});

	it("still pairs a malformed diagram, without a sequence and without throwing", () => {
		const html = toHTML(`${gutterListing}
\`\`\`mermaid
traceDiagram
  frame main @0
    art: 7 @1
\`\`\`
`);

		expect(html).not.toContain("data-trace-lines");
		expect(html).toContain('<figure class="trace-figure lifetime-composite">');
	});

	it("writes the sequence on a plain code fence's figure too", () => {
		const html = toHTML(`\`\`\`rust
fn main() {}
\`\`\`
\`\`\`mermaid
traceDiagram
  frame main @0
    art: 7 @2
    done @5
  end
\`\`\`
`);

		expect(html).toContain(
			'<figure class="trace-figure" data-trace-lines="0 2 5">',
		);
	});

	it("splits a plain listing into spotlightable lines when the pair is timed", () => {
		// A plain code fence draws one run of text, so a stepper has no element
		// to spotlight. Splitting it here keeps the six figures of
		// `posts/interview_03_tracing.md` out of `lifetime-composite`, which
		// would restack a side-by-side figure for a gutter with no lanes.
		const html = toHTML(`\`\`\`python
def gcd(a, b):
  return a
\`\`\`
\`\`\`mermaid
traceDiagram
  frame gcd @0
    a: 7 @1
  end
\`\`\`
`);

		expect(html).toContain('<span class="trace-listing-line" data-line="0">');
		expect(html).toContain('<span class="trace-listing-line" data-line="1">');
		expect(html).not.toContain("lifetime-composite");
		// The wrapper replaces the newline it split on, so the listing keeps its
		// height rather than growing a blank row under every line.
		expect(html).not.toContain('</span>\n<span class="trace-listing-line"');
	});

	it("leaves an untimed pair's plain listing exactly as it was", () => {
		const html = toHTML(`\`\`\`python
def gcd(a, b):
  return a
\`\`\`
\`\`\`mermaid
traceDiagram
  frame gcd
    a: 7
  end
\`\`\`
`);

		expect(html).not.toContain("trace-listing-line");
		expect(html).toContain('<figure class="trace-figure">');
	});

	it("gives the tracing post's build_art figure its declared order", async () => {
		const body = (await getPost("interview_07_tracing_rust")).body ?? "";
		const figure = [...body.matchAll(/<figure class="trace-figure[^>]*>/g)]
			.map(([tag]) => tag)
			.find((tag) => tag.includes('data-trace-lines="9 10 0 1 2 3 11"'));

		expect(figure).toBeDefined();
	});
});

describe("splitHighlightedLines", () => {
	it("re-opens a highlight that runs across a newline", () => {
		// highlight.js wraps a block comment in one span that spans lines. Each
		// line has to stand as well-formed markup on its own once it is wrapped.
		const lines = splitHighlightedLines(
			'a<span class="hljs-comment">/* one\ntwo */</span>b\n',
		);

		expect(lines).toEqual([
			'a<span class="hljs-comment">/* one</span>',
			'<span class="hljs-comment">two */</span>b',
		]);
	});

	it("keeps a blank line as a line", () => {
		expect(splitHighlightedLines("a\n\nb\n")).toEqual(["a", "", "b"]);
	});
});

describe("rewriteMermaidFences", () => {
	it("is idempotent, so it becomes a pass-through once jiffdown emits the container", () => {
		const once = rewriteMermaidFences(
			'<pre><code class="language-mermaid">traceDiagram</code></pre>',
		);

		expect(rewriteMermaidFences(once)).toBe(once);
	});
});

describe("the mermaid CDN pin", () => {
	it("names the version actually installed", () => {
		const installed = JSON.parse(
			readFileSync("node_modules/mermaid/package.json", "utf-8"),
		) as { version: string };

		expect(MERMAID_VERSION).toBe(installed.version);
		expect(MERMAID_ESM_URL).toContain(MERMAID_VERSION);
		expect(MERMAID_ESM_URL).toMatch(/^https:\/\/.*mermaid\.esm\.min\.mjs$/);
	});
});
