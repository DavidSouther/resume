// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { traceDiagram } from "./detector.ts";
import { diagram } from "./diagram.ts";

afterEach(() => {
	document.body.innerHTML = "";
});

describe("the external diagram definition mermaid registers", () => {
	it("is keyed to traceDiagram", () => {
		expect(traceDiagram.id).toBe("traceDiagram");
	});

	it("detects its own diagrams and nobody else's", () => {
		expect(traceDiagram.detector("traceDiagram\n  frame f\n  end")).toBe(true);
		expect(traceDiagram.detector("  traceDiagram")).toBe(true);
		expect(traceDiagram.detector("sequenceDiagram\n")).toBe(false);
		expect(traceDiagram.detector('flowchart TD\n  A["traceDiagram"]\n')).toBe(
			false,
		);
	});

	it("lazily loads a definition with the four parts mermaid needs", async () => {
		const loaded = await traceDiagram.loader();

		expect(loaded.id).toBe("traceDiagram");
		expect(loaded.diagram).toHaveProperty("parser");
		expect(loaded.diagram).toHaveProperty("db");
		expect(loaded.diagram).toHaveProperty("renderer");
		expect(loaded.diagram).toHaveProperty("styles");
	});

	it("clears the db between renders, as mermaid does before each parse", () => {
		diagram.parser.parse("traceDiagram\n  frame first\n    row a: 1\n  end");
		expect(diagram.db.getModel().frames[0].label).toBe("first");

		// Mermaid calls clear() before every parse; nothing may survive it.
		diagram.db.clear();
		expect(diagram.db.getModel().frames).toEqual([]);
		expect(diagram.db.getDiagramTitle()).toBe("");

		diagram.parser.parse("traceDiagram\n  frame second\n    row b: 2\n  end");
		expect(diagram.db.getModel().frames).toHaveLength(1);
		expect(diagram.db.getModel().frames[0].label).toBe("second");
	});

	it("draws into the svg element mermaid created for it", () => {
		const host = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		host.id = "mermaid-trace-0";
		document.body.append(host);
		const source = "traceDiagram\n  frame f\n    row a: 1, 2\n  end";
		diagram.db.clear();
		diagram.parser.parse(source);

		diagram.renderer.draw(source, host.id);

		expect(host.getAttribute("viewBox")).toMatch(/^0 0 \d+ \d+$/);
		expect(host.getAttribute("aria-roledescription")).toBe("traceDiagram");
		expect(host.querySelectorAll(".trace-value").length).toBe(2);
	});

	it("sizes the host by viewBox alone, so a wide trace scales instead of clipping", () => {
		const host = document.createElementNS("http://www.w3.org/2000/svg", "svg");
		host.id = "mermaid-trace-1";
		host.setAttribute("width", "100");
		document.body.append(host);
		const source =
			"traceDiagram\n  frame f\n    row a: 111111, 222222, 333333, 444444\n  end";
		diagram.db.clear();
		diagram.parser.parse(source);

		diagram.renderer.draw(source, host.id);

		// A fixed width wider than the article column overflows and is cut off.
		expect(host.getAttribute("width")).toBeNull();
		expect(host.getAttribute("height")).toBeNull();
		expect(host.getAttribute("style")).toContain("max-width:100%");
	});
});
