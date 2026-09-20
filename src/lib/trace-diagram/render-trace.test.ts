// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";
import { afterEach, describe, expect, it } from "vitest";
import { renderTrace } from "./render-trace.ts";
import { getStyles } from "./styles.ts";

function draw(source: string): SVGSVGElement {
	const host = document.createElement("div");
	document.body.append(host);
	return renderTrace(source, host);
}

afterEach(() => {
	document.body.innerHTML = "";
	document.head.querySelectorAll("style").forEach((style) => {
		style.remove();
	});
});

describe("drawTrace", () => {
	it("draws an implicit row with one live value and strikes the rest", () => {
		const svg = draw("traceDiagram\n  frame f\n    a: 1, 2\n  end");

		expect(svg.querySelectorAll(".trace-value").length).toBe(2);
		expect(svg.querySelectorAll(".trace-value.trace-struck").length).toBe(1);
		expect(svg.querySelectorAll(".trace-row").length).toBe(1);
	});

	it("crosses out a completed frame", () => {
		const svg = draw("traceDiagram\n  frame f\n    row a: 1\n    done\n  end");

		expect(svg.querySelector(".trace-frame-done")).not.toBeNull();
	});

	it("opens a scope with a dashed rule and a frame with a solid one", () => {
		const svg = draw(
			"traceDiagram\n  frame f\n    scope block\n      row t: 3\n    end\n  end",
		);

		expect(
			svg.querySelector(".trace-scope")?.getAttribute("stroke-dasharray"),
		).toBeTruthy();
		expect(
			svg.querySelector(".trace-rule")?.getAttribute("stroke-dasharray"),
		).toBeNull();
	});

	it("draws the return arrow from a callee's ret up to its caller's", () => {
		const svg = draw(
			[
				"traceDiagram",
				"  frame outer",
				"    ret 21",
				"    frame inner",
				"      ret 21 -> ret",
				"      done",
				"    end",
				"  end",
			].join("\n"),
		);

		expect(svg.querySelectorAll(".trace-frame").length).toBe(2);
		expect(svg.querySelector(".trace-return-arrow")).not.toBeNull();
	});

	it("draws a returned local reference back into the callee stack frame", () => {
		const svg = draw(
			[
				"traceDiagram",
				"  frame main",
				"    my_art:",
				"    frame build_art",
				"      art: Artwork Liberty",
				"      ret &art -> my_art",
				"    end",
				"  end",
			].join("\n"),
		);

		const pointer = svg.querySelector(".trace-stack-pointer");
		const artValue = [...svg.querySelectorAll(".trace-row")]
			.find((row) => row.querySelector(".trace-name")?.textContent === "art")
			?.querySelector(".trace-value");
		expect(svg.querySelector(".trace-return-arrow")).not.toBeNull();
		expect(pointer).not.toBeNull();
		expect(pointer?.getAttribute("marker-end")).toBe("url(#trace-arrow)");
		expect(pointer?.getAttribute("d")).toMatch(/^M [\d.]+ [\d.]+ C /);
		expect(pointer?.getAttribute("d")).toMatch(
			new RegExp(
				`${Number(artValue?.getAttribute("x")) - 8} ${artValue?.getAttribute("y")}$`,
			),
		);
	});

	it("points to the nearest preceding row when stack-row names repeat", () => {
		const svg = draw(
			"traceDiagram\n  frame f\n    value: first\n    value: second\n    ret &value\n  end",
		);

		const matchingRows = [...svg.querySelectorAll(".trace-row")].filter(
			(row) => row.querySelector(".trace-name")?.textContent === "value",
		);
		const nearestValue = matchingRows[1]?.querySelector(".trace-value");
		const pointer = svg.querySelector(".trace-stack-pointer");
		expect(pointer?.getAttribute("d")).toMatch(
			new RegExp(
				`${Number(nearestValue?.getAttribute("x")) - 8} ${nearestValue?.getAttribute("y")}$`,
			),
		);
	});

	it("draws heap objects, their addresses, and pointer arrows", () => {
		const svg = draw(
			[
				"traceDiagram",
				"  heap blue 0x10",
				"    value: 3",
				"  end",
				"  frame f",
				"    row head: @blue",
				"  end",
			].join("\n"),
		);

		expect(svg.querySelectorAll(".trace-heap-object").length).toBe(1);
		expect(svg.querySelector(".trace-pointer")).not.toBeNull();
		expect(svg.textContent).toContain("0x10");
	});

	it("leaves an unaddressed stack pointer blank without exposing its internal id", () => {
		const svg = draw(
			[
				"traceDiagram",
				"  heap internal-person",
				"    name: Seth",
				"  end",
				"  frame f",
				"    row person: @internal-person",
				"  end",
			].join("\n"),
		);

		expect(svg.textContent).not.toContain("internal-person");
		expect(svg.querySelector('[data-id="internal-person"]')).not.toBeNull();
		expect(svg.querySelector(".trace-value")?.textContent).toBe("");
		expect(svg.querySelector(".trace-pointer")).not.toBeNull();
	});

	it("shows target addresses for stack pointer history without exposing ids", () => {
		const svg = draw(
			[
				"traceDiagram",
				"  heap first-allocation",
				"    value: 30",
				"  end",
				"  heap dynamic-int 0x114",
				"    value: 40",
				"  end",
				"  frame f",
				"    row heapPtr: @first-allocation, @dynamic-int",
				"  end",
			].join("\n"),
		);

		const values = [...svg.querySelectorAll(".trace-row .trace-value")];
		expect(svg.textContent).not.toContain("first-allocation");
		expect(svg.textContent).not.toContain("dynamic-int");
		expect(svg.textContent).toContain("0x114");
		expect(values.map((value) => value.textContent)).toEqual(["", "0x114"]);
		expect(values[0]?.classList.contains("trace-struck")).toBe(true);
		expect(svg.querySelector('[data-id="first-allocation"]')).not.toBeNull();
		expect(svg.querySelector('[data-id="dynamic-int"]')).not.toBeNull();

		const firstX = Number(values[0]?.getAttribute("x"));
		const secondX = Number(values[1]?.getAttribute("x"));
		expect(secondX - firstX).toBe(16);

		const strike = svg.querySelector(".trace-strike");
		expect(Number(strike?.getAttribute("x1"))).toBe(firstX - 2);
		expect(Number(strike?.getAttribute("x2"))).toBe(firstX + 2);

		const pointers = [...svg.querySelectorAll(".trace-pointer")];
		expect(pointers).toHaveLength(2);
		expect(pointers[0]?.getAttribute("d")).toMatch(
			new RegExp(`^M ${firstX + 8} `),
		);
		expect(pointers[1]?.getAttribute("d")).toMatch(
			new RegExp(`^M ${secondX + 5 * 9.6 + 8} `),
		);
	});

	it("draws heap structs as Name/Value tables without showing their internal id", () => {
		const svg = draw(
			[
				"traceDiagram",
				"  heap dynamic-int 0x114",
				"    value: 40",
				"  end",
			].join("\n"),
		);

		const object = svg.querySelector(".trace-heap-object");
		expect(object?.getAttribute("data-id")).toBe("dynamic-int");
		expect(object?.textContent).not.toContain("dynamic-int");
		expect(object?.querySelector(".trace-heap-name-header")?.textContent).toBe(
			"Name",
		);
		expect(object?.querySelector(".trace-heap-value-header")?.textContent).toBe(
			"Value",
		);
		expect(object?.querySelector(".trace-heap-field-name")?.textContent).toBe(
			"value",
		);
		expect(object?.querySelector(".trace-heap-field-value")?.textContent).toBe(
			"40",
		);
		expect(object?.querySelector(".trace-heap-divider")).not.toBeNull();
		expect(object?.querySelector(".trace-heap-rule")).not.toBeNull();
		expect(svg.querySelector(".trace-heap-address")?.textContent).toBe("0x114");
	});

	it("crosses out superseded heap values exactly like stack value history", () => {
		const svg = draw(
			[
				"traceDiagram",
				"  heap ages 0x240",
				"    0: 19, 20",
				"    1: ~17~",
				"  end",
				"  frame f",
				"    same: 19, 20",
				"    terminal: ~17~",
				"  end",
			].join("\n"),
		);

		const heapValues = [
			...svg.querySelectorAll(".trace-heap-field-value.trace-value"),
		];
		expect(heapValues.map((value) => value.textContent)).toEqual([
			"19",
			"20",
			"17",
		]);
		expect(
			heapValues.map((value) => value.classList.contains("trace-struck")),
		).toEqual([true, false, true]);

		const relativeStrikes = (valueSelector: string, strikeSelector: string) => {
			const values = [...svg.querySelectorAll(valueSelector)];
			const strikes = [...svg.querySelectorAll(strikeSelector)];
			return strikes.map((strike, index) => {
				const value = values[index];
				const x = Number(value?.getAttribute("x"));
				const y = Number(value?.getAttribute("y"));
				return {
					x1: Number(strike.getAttribute("x1")) - x,
					y1: Number(strike.getAttribute("y1")) - y,
					x2: Number(strike.getAttribute("x2")) - x,
					y2: Number(strike.getAttribute("y2")) - y,
				};
			});
		};

		expect(
			relativeStrikes(
				".trace-heap-object .trace-struck",
				".trace-heap-object .trace-strike",
			),
		).toEqual(
			relativeStrikes(".trace-row .trace-struck", ".trace-row .trace-strike"),
		);
	});

	it("sizes a heap card and its viewBox for the complete value history", () => {
		const longHistory = draw(
			[
				"traceDiagram",
				"  heap cell",
				"    value: a-deliberately-long-superseded-value, x",
				"  end",
			].join("\n"),
		);
		const shortHistory = draw("traceDiagram\n  heap cell\n    value: x\n  end");
		const longRect = longHistory.querySelector(".trace-heap-rect");
		const shortRect = shortHistory.querySelector(".trace-heap-rect");
		const longWidth = Number(longRect?.getAttribute("width"));
		const shortWidth = Number(shortRect?.getAttribute("width"));
		const longViewWidth = Number(
			longHistory.getAttribute("viewBox")?.split(" ")[2],
		);
		const shortViewWidth = Number(
			shortHistory.getAttribute("viewBox")?.split(" ")[2],
		);

		expect(longWidth).toBeGreaterThan(shortWidth);
		expect(longViewWidth).toBeGreaterThan(shortViewWidth);
		const values = [
			...longHistory.querySelectorAll(".trace-heap-field-value.trace-value"),
		];
		const live = values.at(-1);
		const rectRight =
			Number(longRect?.getAttribute("x")) +
			Number(longRect?.getAttribute("width"));
		expect(Number(live?.getAttribute("x")) + 9.6).toBeLessThan(rectRight);
	});

	it("draws no listing: the code block is a real fence beside the figure", () => {
		const svg = draw("traceDiagram\n  frame f\n    row a: 1\n  end");

		expect(svg.querySelector(".trace-code")).toBeNull();
	});

	it("reaches the bottom of a completed frame without cutting it off", () => {
		const svg = draw(
			"traceDiagram\n  frame f\n    row a: 1\n    row b: 2\n    done\n  end",
		);

		const viewHeight = Number(svg.getAttribute("viewBox")?.split(" ")[3]);
		const d = svg.querySelector(".trace-frame-done")?.getAttribute("d") ?? "";
		const lowest = Math.max(
			...[...d.matchAll(/[\d.]+ ([\d.]+)/g)].map((m) => Number(m[1])),
		);
		expect(lowest).toBeLessThanOrEqual(viewHeight);
	});

	it("renders a value containing markup as text, not as elements", () => {
		const svg = draw("traceDiagram\n  frame f\n    row a: <b>x</b>\n  end");

		expect(svg.querySelector("b")).toBeNull();
		expect(svg.textContent).toContain("<b>x</b>");
	});

	it("sizes itself with a viewBox rather than relying on a layout engine", () => {
		const svg = draw("traceDiagram\n  frame f\n    row a: 1\n  end");

		expect(svg.getAttribute("viewBox")).toMatch(/^0 0 \d+ \d+$/);
		expect(svg.getAttribute("aria-roledescription")).toBe("traceDiagram");
	});

	it("widens the diagram to fit its title rather than clipping it", () => {
		const title = "Tracing a circular linked list detection algorithm";
		const svg = draw(
			`traceDiagram\n  title ${title}\n  frame f\n    row a: 1\n  end`,
		);

		const viewWidth = Number(svg.getAttribute("viewBox")?.split(" ")[2]);
		expect(viewWidth).toBeGreaterThan(title.length * 9);
	});

	it("draws heap pointer fields as arrows without exposing object ids", () => {
		const svg = draw(
			[
				"traceDiagram",
				"  heap blue 0x10",
				"    next -> aVeryLongObjectNameIndeed",
				"  end",
				"  heap aVeryLongObjectNameIndeed 0x20",
				"    value: 1",
				"  end",
				"  frame f",
				"    row head: @blue",
				"  end",
			].join("\n"),
		);

		const source = svg.querySelector('[data-id="blue"]');
		const target = svg.querySelector('[data-id="aVeryLongObjectNameIndeed"]');
		expect(source?.textContent).not.toContain("blue");
		expect(source?.textContent).not.toContain("aVeryLongObjectNameIndeed");
		expect(target?.textContent).not.toContain("aVeryLongObjectNameIndeed");
		expect(source?.querySelector(".trace-heap-field-value")?.textContent).toBe(
			"",
		);
		expect(svg.querySelector(".trace-heap-pointer")).not.toBeNull();
	});

	it("fills a heap object with its declared colour instead of naming it", () => {
		const style = document.createElement("style");
		style.textContent = getStyles({ tertiaryColor: "white" });
		document.head.append(style);
		const svg = draw(
			[
				"traceDiagram",
				"  heap blue 0x10",
				"    color: cornflowerblue",
				"  end",
				"  heap plain 0x20",
				"  end",
				"  frame f",
				"    row head: @blue",
				"  end",
			].join("\n"),
		);

		const coloured = svg.querySelector(
			'[data-id="blue"] .trace-heap-rect',
		) as SVGRectElement;
		const plain = svg.querySelector(
			'[data-id="plain"] .trace-heap-rect',
		) as SVGRectElement;
		const probe = document.createElementNS(
			"http://www.w3.org/2000/svg",
			"rect",
		);
		probe.style.fill = "cornflowerblue";
		svg.append(probe);

		expect(coloured.style.fill).toBe("cornflowerblue");
		expect(getComputedStyle(coloured).fill).toBe(getComputedStyle(probe).fill);
		expect(plain.style.fill).toBe("");
		expect(getComputedStyle(plain).fill).toBe("rgb(255, 255, 255)");
		// The colour is the fill, not a field row repeating the word.
		expect(svg.querySelectorAll(".trace-heap-field").length).toBe(0);
	});

	it("rejects a colour that is not a keyword or hex literal", () => {
		expect(() =>
			draw("traceDiagram\n  heap a\n    color: url(#x)\n  end"),
		).toThrowError(/CSS named colour or 3, 4, 6, or 8-digit hex/);
	});

	it("keeps a long frame label on the canvas instead of off its left edge", () => {
		const svg = draw(
			"traceDiagram\n  frame aVeryLongFunctionNameIndeed\n    row a: 1\n  end",
		);

		const label = svg.querySelector(".trace-frame-label");
		const x = Number(label?.getAttribute("x"));
		// text-anchor is end, so the label runs leftward from x.
		expect(x - (label?.textContent?.length ?? 0) * 9.6).toBeGreaterThanOrEqual(
			0,
		);
	});

	it("draws the return arrow as one arc, not a rectilinear bracket", () => {
		const svg = draw(
			[
				"traceDiagram",
				"  frame outer",
				"    ret 21",
				"    frame inner",
				"      ret 21 -> ret",
				"    end",
				"  end",
			].join("\n"),
		);

		const d = svg.querySelector(".trace-return-arrow")?.getAttribute("d") ?? "";
		expect(d).toMatch(/^M [\d.]+ [\d.]+ A /);
		expect(d).not.toMatch(/[HV]/);
	});

	it("draws a row with no values without dropping its name", () => {
		const svg = draw("traceDiagram\n  frame f\n    row a:\n  end");

		expect(svg.querySelectorAll(".trace-row").length).toBe(1);
		expect(svg.querySelector(".trace-name")?.textContent).toBe("a");
	});
});

/** The tagged figure of `posts/interview_07_tracing_rust`, whose execution
 *  order is not the listing's order: `steps 9 10 0 1 2 3 11`. */
const BUILD_ART = [
	"traceDiagram",
	"  title Static check of a returned local reference",
	"  steps 9 10 0 1 2 3 11",
	"  frame main @9",
	"    my_art: @10",
	"    frame build_art @0",
	"      art: Artwork Liberty @1",
	"      ret &art -> my_art @2",
	"      watch return: rejected @2",
	"      done @3",
	"    end",
	"  end",
].join("\n");

const at = (element: Element | null | undefined): string | null =>
	element?.getAttribute("data-at") ?? null;

describe("drawTrace timing", () => {
	it("times each value, its arrows, and the frame X independently", () => {
		const svg = draw(BUILD_ART);

		const label = (name: string) =>
			[...svg.querySelectorAll(".trace-frame-label")].find(
				(candidate) => candidate.textContent === name,
			);
		const item = svg.querySelector('.trace-value-item[data-at="4"]');
		expect(item?.textContent).toBe("Artwork Liberty");
		expect(at(label("main"))).toBe("1");
		expect(at(svg.querySelector(".trace-rule"))).toBe("1");
		expect(at(label("build_art"))).toBe("3");
		expect(at(svg.querySelector(".trace-return-arrow"))).toBe("5");
		expect(at(svg.querySelector(".trace-stack-pointer"))).toBe("5");
		expect(at(svg.querySelector(".trace-frame-done"))).toBe("6");
	});

	it("times an empty-valued row by the tag on the row itself", () => {
		const svg = draw(BUILD_ART);

		const name = [...svg.querySelectorAll(".trace-name")].find(
			(candidate) => candidate.textContent === "my_art",
		);
		expect(at(name)).toBe("2");
		// A row holding values is timed by the first of them, not by the group.
		const art = [...svg.querySelectorAll(".trace-name")].find(
			(candidate) => candidate.textContent === "art",
		);
		expect(at(art)).toBe("4");
		// The row group would shadow its own children in document order.
		expect(svg.querySelector(".trace-row[data-at]")).toBeNull();
	});

	it("strikes a value with the step of the value that supersedes it", () => {
		const svg = draw("traceDiagram\n  frame f\n    a: 1 @0, 2 @1\n  end");

		const strike = svg.querySelector(".trace-strike");
		const struck = svg.querySelector(".trace-value-item");
		expect(at(struck)).toBe("1");
		expect(at(strike)).toBe("2");
		// A sibling of the value group, not a child: inside it the strike would
		// arrive with the value it cancels.
		expect(strike?.parentElement).toBe(struck?.parentElement);
		expect(struck?.contains(strike as Node)).toBe(false);
	});

	it("gives an untagged item the step of the nearest preceding tag", () => {
		const svg = draw(
			"traceDiagram\n  frame f @0\n    a: 5\n    b: 6 @1\n  end",
		);

		const items = [...svg.querySelectorAll(".trace-value-item")];
		expect(items.map((each) => at(each))).toEqual(["1", "2"]);
	});

	it("times a heap card and its fields by the object's own tag", () => {
		const svg = draw(
			[
				"traceDiagram",
				"  heap artwork 0x08 @1",
				"    name: Owain",
				"    view_count: 0",
				"  end",
				"  frame main @0",
				"    art: @artwork @1",
				"    done @2",
				"  end",
			].join("\n"),
		);

		const card = svg.querySelector(".trace-heap-object");
		expect(at(card)).toBe("2");
		expect(
			[...svg.querySelectorAll(".trace-heap-field-name")].map((each) =>
				at(each),
			),
		).toEqual(["2", "2"]);
		expect(
			[...svg.querySelectorAll(".trace-heap-field-value.trace-value")].map(
				(each) => at(each.parentElement),
			),
		).toEqual(["2", "2"]);
		expect(at(svg.querySelector(".trace-pointer"))).toBe("2");
	});

	it("emits nothing at all for a diagram that carries no timing notation", () => {
		// The fixture was written by this renderer at the commit before `data-at`
		// existed, so the comparison is against the real prior output rather than
		// against a restatement of the current one.
		const dir = join(cwd(), "src", "lib", "trace-diagram");
		const source = readFileSync(
			join(dir, "untagged-baseline.source.txt"),
			"utf-8",
		);
		const expected = readFileSync(join(dir, "untagged-baseline.svg"), "utf-8");

		const svg = draw(source);

		expect(svg.outerHTML).toBe(expected);
		expect(svg.querySelector("[data-at]")).toBeNull();
		expect(svg.querySelector(".trace-value-item")).toBeNull();
	});
});

describe("getStyles", () => {
	it("takes every colour from options and emits no literal hex", () => {
		const css = getStyles({
			lineColor: "var(--line)",
			textColor: "var(--ink)",
			errorBkgColor: "var(--strike)",
			nodeBorder: "var(--border)",
			tertiaryColor: "var(--surface)",
		});

		expect(css).toContain("var(--line)");
		expect(css).not.toMatch(/#[0-9a-f]{3,6}\b/i);
	});

	it("runs with a partial options object without emitting undefined", () => {
		expect(getStyles({})).not.toContain("undefined");
	});
});
