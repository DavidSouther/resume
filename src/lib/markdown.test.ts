import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { rewriteMermaidFences, toHTML } from "./markdown.ts";
import { MERMAID_ESM_URL, MERMAID_VERSION } from "./mermaid-bundle.ts";

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
