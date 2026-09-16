// @vitest-environment jsdom

// Feature test for the traceDiagram mermaid diagram type.
//
// User story:
//   Given the post posts/interview_03_tracing_mermaid.md, which carries the
//   lesson of posts/interview_03_tracing.md with every hand-drawn PNG replaced
//   by a fenced `traceDiagram` block,
//   When the site build renders that post and a browser draws its diagrams,
//   Then the reader sees the same six figures as SVG — value history with the
//   superseded entries struck, a completed call frame crossed out, a dashed
//   block scope, the return arrow, a watch row, and the heap — and no PNG.
//
// Both halves run shipped code: the first drives the real getPost -> jiffdown
// path, the second parses and renders the post's own diagram sources. The
// renderer measures text arithmetically rather than with getBBox, which is what
// lets the second half run under jsdom instead of a browser.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";
import { describe, expect, it } from "vitest";
import { getPost } from "../posts.ts";
import { renderTrace } from "./render-trace.ts";

const POST_ID = "interview_03_tracing_mermaid";
const POST_PATH = join(cwd(), "posts", `${POST_ID}.md`);

/** Every ```mermaid fence body in the post source, in document order. */
function diagramSources(): string[] {
	const source = readFileSync(POST_PATH, "utf-8");
	return [...source.matchAll(/```mermaid\n([\s\S]*?)```/g)].map((m) => m[1]);
}

/** The one diagram carrying a given traceDiagram statement keyword. */
function diagramWith(keyword: string): string {
	const found = diagramSources().find((d) =>
		new RegExp(`^\\s*${keyword}\\b`, "m").test(d),
	);
	if (!found) {
		throw new Error(`No traceDiagram in ${POST_ID} uses \`${keyword}\``);
	}
	return found;
}

/** Parse + render one diagram source to a detached <svg>, as mermaid would. */
function svgFor(source: string): SVGSVGElement {
	const host = document.createElement("div");
	document.body.append(host);
	return renderTrace(source, host);
}

describe("traceDiagram renders the tracing post's figures from text", () => {
	it("publishes the post through the build with mermaid containers, not PNGs", async () => {
		const post = await getPost(POST_ID);
		const body = post.body ?? "";

		// Six figures in the original post, six diagrams here.
		const containers = body.match(/<pre class="mermaid">/g) ?? [];
		expect(containers.length).toBe(6);

		// Every diagram is a traceDiagram, and the fence is not left as code.
		expect(body).toContain("traceDiagram");
		expect(body).not.toContain("language-mermaid");

		// The lesson survived: this post replaces the PNGs rather than reusing them.
		expect(body).not.toMatch(/Technical_Whiteboarding_Tracing_\w+\.png/);
		expect(body).toContain("/blog/interview_01_whiteboard");
	});

	it("draws the name/value table with superseded values struck through", () => {
		const sources = diagramSources();
		expect(sources.join("\n")).not.toMatch(/^\s+row\s/m);
		const postSource = readFileSync(POST_PATH, "utf-8");
		expect(postSource).toContain("`name: values`");
		expect(postSource).not.toContain("one `row` is one name");
		const svg = svgFor(diagramWith("frame"));

		const names = [...svg.querySelectorAll(".trace-name")].map(
			(n) => n.textContent,
		);
		expect(names).toContain("a");
		expect(names).toContain("b");

		const values = [...svg.querySelectorAll(".trace-value")];
		const live = values.filter((v) => !v.classList.contains("trace-struck"));
		const struck = values.filter((v) => v.classList.contains("trace-struck"));

		// Every row keeps exactly one live value; all earlier ones are struck.
		expect(struck.length).toBeGreaterThan(0);
		expect(live.length).toBe(svg.querySelectorAll(".trace-row").length);
		expect(struck.map((v) => v.textContent)).toContain("1071");
		expect(live.map((v) => v.textContent)).toContain("21");
	});

	it("stacks call frames, crosses out the completed one, and draws the return arrow", () => {
		// Selected by `done`, not `ret`: every frame that returns has a `ret`,
		// including the single-frame figures, but only the recursion figure has a
		// completed frame to cross out.
		const svg = svgFor(diagramWith("done"));

		expect(svg.querySelectorAll(".trace-frame").length).toBeGreaterThan(1);
		// A completed frame carries the large X.
		expect(svg.querySelectorAll(".trace-frame-done").length).toBeGreaterThan(0);
		// The return arrow runs from the callee's ret up into the caller's slot.
		expect(svg.querySelector(".trace-return-arrow")).not.toBeNull();
		expect(
			[...svg.querySelectorAll(".trace-name")].map((n) => n.textContent),
		).toContain("ret");
	});

	it("draws a block scope with a dashed rule", () => {
		const svg = svgFor(diagramWith("scope"));

		const scope = svg.querySelector(".trace-scope");
		expect(scope).not.toBeNull();
		expect(scope?.getAttribute("stroke-dasharray")).toBeTruthy();
	});

	it("draws the heap with pointer arrows and hex addresses", () => {
		const linkedList = diagramSources().find((source) =>
			source.includes("title Tracing a circular linked list"),
		);
		expect(linkedList).toBeDefined();
		const svg = svgFor(linkedList ?? "");

		expect(svg.querySelectorAll(".trace-heap-object").length).toBeGreaterThan(
			0,
		);
		expect(svg.querySelector(".trace-pointer")).not.toBeNull();
		expect(svg.textContent).toMatch(/0x[0-9a-f]+/i);

		// Heap ids are source-only connection names. In this concrete figure, the
		// visible Set history and pointer values must use the nodes' addresses.
		const visibleText = svg.textContent ?? "";
		expect(visibleText).not.toMatch(/\b(?:blue|green|gold)\b/);
		expect(visibleText).toContain("{0x10 0x20 0x30}");
	});

	it("draws a watch row whose name column holds an expression", () => {
		const svg = svgFor(diagramWith("watch"));

		const watches = [...svg.querySelectorAll(".trace-watch .trace-name")];
		expect(watches.length).toBeGreaterThan(0);
		expect(watches.map((w) => w.textContent).join(" ")).toMatch(/[.[\]()]/);
	});

	it("pairs each diagram with the real code fence it traces", async () => {
		const body = (await getPost(POST_ID)).body ?? "";

		// The listing is a code block, not redrawn inside the diagram, and the two
		// are wrapped as one figure the stylesheet lays out side by side.
		const figures = body.match(/<figure class="trace-figure">/g) ?? [];
		expect(figures.length).toBe(6);
		expect(body).toMatch(/language-(python|javascript)/);
		expect(diagramSources().join("\n")).not.toMatch(/^\s*code\b/m);
	});

	it("reports a syntax error with a line number instead of a stack trace", () => {
		expect(() => svgFor("traceDiagram\n  frobnicate wat\n")).toThrowError(
			/line 2/i,
		);
	});
});
