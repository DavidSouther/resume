// @vitest-environment jsdom

// Unit tests for the step control. The feature test walks one reader's path
// through the `build_art` figure; these pin the whole sequence, the ends of the
// range, the keyboard, and the degradation cases a reader never sees.

import { afterEach, describe, expect, it, vi } from "vitest";
import { toHTML } from "../markdown.ts";
import { renderTrace } from "../trace-diagram/render-trace.ts";
import { mountTraceSteppers } from "./stepper.ts";

/** The listing the `build_art` figure traces, 0-based lines 0 through 12. */
const BUILD_ART_LISTING = `\`\`\`highlight-gutters
code rust:
fn build_art<'a>() -> &'a Artwork {
    let art = artwork("Liberty");
    &art // rejected return
}

fn show_art(show: &Artwork) {
  println!("{}", show.name);
}

fn main() {
    let my_art = build_art();
    show_art(&my_art);
}
marks:
art 1,2
my_art &art 2,11
\`\`\`
`;

const BUILD_ART_DIAGRAM = `\`\`\`mermaid
traceDiagram
  title Static check of a returned local reference
  steps 9 10 0 1 2 3 11
  frame main @9
    my_art: @10
    frame build_art @0
      art: Artwork Liberty @1
      ret &art -> my_art @2
      watch return: rejected @2
      done @3
    end
  end
\`\`\`
`;

/** Renders `markdown` and draws every diagram, as mermaid does in the browser. */
function render(markdown: string): HTMLElement[] {
	document.body.innerHTML = toHTML(markdown);
	const figures = [...document.querySelectorAll<HTMLElement>("figure")];
	for (const figure of figures) {
		const pre = figure.querySelector("pre.mermaid");
		if (!pre) continue;
		renderTrace(pre.textContent ?? "", figure);
		pre.remove();
	}
	return figures;
}

function buildArtFigure(): HTMLElement {
	const [figure] = render(BUILD_ART_LISTING + BUILD_ART_DIAGRAM);
	mountTraceSteppers(document);
	return figure;
}

const press = (figure: Element, label: string): void => {
	const control = [...figure.querySelectorAll("button")].find(
		(candidate) => candidate.textContent?.trim() === label,
	);
	if (!control) throw new Error(`The stepper has no \`${label}\` button`);
	control.click();
};

const key = (target: Element, name: string): void => {
	target.dispatchEvent(
		new KeyboardEvent("keydown", { key: name, bubbles: true }),
	);
};

const spotlightLine = (figure: Element): string | null =>
	figure
		.querySelector('.highlight-gutter-line[data-state="current"]')
		?.textContent?.trim() ?? null;

/** Names one revealed element by its class and the text it draws. */
const describeElement = (element: Element): string => {
	const cls = element.getAttribute("class") ?? element.tagName;
	const text = element.textContent?.trim() ?? "";
	return text ? `${cls}:${text}` : cls;
};

const current = (figure: Element): string[] =>
	[...figure.querySelectorAll('[data-at][data-state="current"]')].map(
		describeElement,
	);

/** Replay, then Next, so a jump uses only the controls a reader has. */
const goTo = (figure: Element, step: number): void => {
	press(figure, "Replay");
	for (let at = 1; at < step; at += 1) press(figure, "Next");
};

afterEach(() => {
	document.body.innerHTML = "";
	vi.restoreAllMocks();
});

describe("the build_art figure's declared order", () => {
	// D5: the whole sequence is pinned, not its endpoints. Steps 3 and 4 move the
	// spotlight *up* the listing, which is the behaviour a plain ascending order
	// would silently get wrong.
	const EXPECTED_LINES = [
		"fn main() {",
		"let my_art = build_art();",
		"fn build_art<'a>() -> &'a Artwork {",
		'let art = artwork("Liberty");',
		"&art // rejected return",
		"}",
		"show_art(&my_art);",
	];

	const EXPECTED_CURRENT = [
		["trace-rule", "trace-frame-label:main"],
		["trace-name:my_art"],
		["trace-rule", "trace-frame-label:build_art"],
		["trace-name:art", "trace-value-item:Artwork Liberty"],
		[
			"trace-name:ret",
			"trace-value-item:&art",
			"trace-name:return",
			"trace-value-item:rejected",
			"trace-return-arrow",
			"trace-pointer trace-stack-pointer",
		],
		["trace-frame-done"],
		[],
	];

	it("reveals the right element and spotlights the right line at every step", () => {
		const figure = buildArtFigure();

		for (let step = 1; step <= 7; step += 1) {
			goTo(figure, step);

			expect(figure.dataset.step).toBe(String(step));
			expect(spotlightLine(figure)).toBe(EXPECTED_LINES[step - 1]);
			expect(current(figure)).toEqual(EXPECTED_CURRENT[step - 1]);
		}
	});

	it("publishes the count and starts at the first execution", () => {
		const figure = buildArtFigure();

		expect(figure.dataset.traceSteps).toBe("7");
		expect(figure.dataset.step).toBe("1");
	});
});

describe("the ends of the range", () => {
	it("stops at the last step, with Next disabled", () => {
		const figure = buildArtFigure();

		goTo(figure, 7);
		press(figure, "Next");

		expect(figure.dataset.step).toBe("7");
		expect(
			[...figure.querySelectorAll("button")].find(
				(b) => b.textContent?.trim() === "Next",
			)?.disabled,
		).toBe(true);
	});

	it("stops at the first step, with Previous disabled", () => {
		const figure = buildArtFigure();

		press(figure, "Previous");

		expect(figure.dataset.step).toBe("1");
		expect(
			[...figure.querySelectorAll("button")].find(
				(b) => b.textContent?.trim() === "Previous",
			)?.disabled,
		).toBe(true);
	});

	it("replays to the first step from the last", () => {
		const figure = buildArtFigure();
		goTo(figure, 7);

		press(figure, "Replay");

		expect(figure.dataset.step).toBe("1");
	});
});

describe("the keyboard", () => {
	it("matches Next, Previous, and Replay inside the figure", () => {
		const figure = buildArtFigure();

		key(figure.querySelector(".highlight-gutter-line") ?? figure, "ArrowRight");
		expect(figure.dataset.step).toBe("2");

		key(figure, "ArrowRight");
		expect(figure.dataset.step).toBe("3");

		key(figure, "ArrowLeft");
		expect(figure.dataset.step).toBe("2");

		key(figure, "Home");
		expect(figure.dataset.step).toBe("1");
	});

	it("ignores the same keys pressed outside the figure", () => {
		const figure = buildArtFigure();
		goTo(figure, 3);

		key(document.body, "ArrowRight");

		expect(figure.dataset.step).toBe("3");
	});
});

describe("mounting", () => {
	it("adds no second control bar when called again", () => {
		const first = mountTraceSteppers(document);
		const figure = buildArtFigure();

		const second = mountTraceSteppers(document);

		expect(first).toBe(0);
		expect(second).toBe(1);
		expect(figure.querySelectorAll(".trace-stepper")).toHaveLength(1);
	});

	it("skips a figure whose diagram never drew", () => {
		// The mermaid-failure case: the sequence shipped on the figure, but the
		// `pre` is still text, so there is no timed element to reveal.
		document.body.innerHTML = toHTML(BUILD_ART_LISTING + BUILD_ART_DIAGRAM);
		const figure = document.querySelector<HTMLElement>("figure");

		expect(mountTraceSteppers(document)).toBe(0);
		expect(figure?.querySelector(".trace-stepper")).toBeNull();
		expect(figure?.dataset.step).toBeUndefined();
	});

	it("steps two figures on one page independently", () => {
		render(
			BUILD_ART_LISTING +
				BUILD_ART_DIAGRAM +
				"\n" +
				BUILD_ART_LISTING +
				BUILD_ART_DIAGRAM,
		);
		expect(mountTraceSteppers(document)).toBe(2);
		const [one, two] = [...document.querySelectorAll<HTMLElement>("figure")];

		press(one, "Next");
		press(one, "Next");

		expect(one.dataset.step).toBe("3");
		expect(two.dataset.step).toBe("1");
	});
});

describe("a step past the end of the listing", () => {
	const SHORT = `\`\`\`highlight-gutters
code rust:
fn main() {
    let a = 1;
}
marks:
a 1,1
\`\`\`
\`\`\`mermaid
traceDiagram
  steps 0 5
  frame main @0
    a: 1 @5
    done @5
  end
\`\`\`
`;

	it("skips the spotlight, warns once, and stays steppable", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const [figure] = render(SHORT);
		mountTraceSteppers(document);

		press(figure, "Next");
		press(figure, "Previous");
		press(figure, "Next");

		expect(figure.dataset.step).toBe("2");
		expect(spotlightLine(figure)).toBeNull();
		expect(warn).toHaveBeenCalledTimes(1);
	});
});
