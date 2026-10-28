import { describe, expect, it } from "vitest";
import { checkOrder, fillPlaceholders, parseContent } from "./content.ts";

const DOC = `# Title

Intro with a [link](https://example.com).

## {#a:First}

Body one.

## {#b-2:Second step}

Body two
with *emphasis*.

\`\`\`md
## Not a step
\`\`\`
`;

describe("parseContent", () => {
	it("reads title, intro, and steps in file order", () => {
		const c = parseContent(DOC);
		expect(c.title).toBe("Title");
		expect(c.intro).toBe("Intro with a [link](https://example.com).");
		expect(c.steps.map((s) => [s.id, s.title])).toEqual([
			["a", "First"],
			["b-2", "Second step"],
		]);
		expect(c.steps[0].body).toBe("Body one.");
	});

	it("keeps a heading inside a code fence in the body", () => {
		const c = parseContent(DOC);
		expect(c.steps[1].body).toContain("## Not a step");
	});

	it("rejects a step heading with no ID", () => {
		expect(() => parseContent("# T\n\n## No id here\n\nx")).toThrow(
			/No id here/,
		);
	});

	it("rejects a repeated ID", () => {
		expect(() =>
			parseContent("# T\n\n## {#x:A}\n\na\n\n## {#x:B}\n\nb"),
		).toThrow(/duplicate.*x/i);
	});
});

describe("fillPlaceholders", () => {
	it("replaces known placeholders", () => {
		expect(fillPlaceholders("a {{x}} b", { x: "1" })).toBe("a 1 b");
	});

	it("rejects an unknown placeholder", () => {
		expect(() => fillPlaceholders("{{nope}}", {})).toThrow(/nope/);
	});
});

describe("checkOrder", () => {
	it("passes when IDs match in order", () => {
		const { steps } = parseContent(DOC);
		expect(() => checkOrder(steps, ["a", "b-2"])).not.toThrow();
	});

	it("names missing, extra, and misordered IDs", () => {
		const { steps } = parseContent(DOC);
		expect(() => checkOrder(steps, ["a"])).toThrow(/extra.*b-2/i);
		expect(() => checkOrder(steps, ["a", "b-2", "c"])).toThrow(/missing.*c/i);
		expect(() => checkOrder(steps, ["b-2", "a"])).toThrow(/order/i);
	});
});
