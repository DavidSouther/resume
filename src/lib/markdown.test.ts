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
