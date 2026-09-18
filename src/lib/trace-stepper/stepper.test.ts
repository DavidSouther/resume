// @vitest-environment jsdom

// Unit tests for the step control. The feature test walks one reader's path
// through the `build_art` figure; these pin the whole sequence, the ends of the
// range, the keyboard, and the degradation cases a reader never sees.
//
// The `build_art` cases read the shipped post rather than a local copy of its
// listing, so the ordering table cannot drift away from the figure it claims to
// describe. Only the cases the post has no example of use a local fixture.

import { afterEach, describe, expect, it, vi } from "vitest";
import { toHTML } from "../markdown.ts";
import { getPost } from "../posts.ts";
import { renderTrace } from "../trace-diagram/render-trace.ts";
import { mountTraceSteppers } from "./stepper.ts";

const POST_ID = "interview_07_tracing_rust";

/** Draws every diagram of `html` into its figure, as mermaid does in a browser. */
function render(html: string): HTMLElement[] {
	document.body.innerHTML = html;
	const figures = [...document.querySelectorAll<HTMLElement>("figure")];
	for (const figure of figures) {
		const pre = figure.querySelector("pre.mermaid");
		if (!pre) continue;
		renderTrace(pre.textContent ?? "", figure);
		pre.remove();
	}
	return figures;
}

/** The post's figures, drawn and mounted. The `build_art` one is at index 6. */
async function mountPost(): Promise<HTMLElement[]> {
	const figures = render((await getPost(POST_ID)).body ?? "");
	mountTraceSteppers(document);
	return figures;
}

async function buildArtFigure(): Promise<HTMLElement> {
	const figure = (await mountPost()).find((candidate) =>
		candidate.dataset.traceLines?.includes("9 10 0 1 2 3 11"),
	);
	if (!figure) throw new Error(`No build_art trace figure in ${POST_ID}`);
	return figure;
}

const press = (figure: Element, label: string): void => {
	const control = [...figure.querySelectorAll("button")].find(
		(candidate) => candidate.textContent?.trim() === label,
	);
	if (!control) throw new Error(`The stepper has no \`${label}\` button`);
	control.click();
};

const control = (figure: Element, label: string): HTMLButtonElement => {
	const found = [...figure.querySelectorAll("button")].find(
		(candidate) => candidate.textContent?.trim() === label,
	);
	if (!found) throw new Error(`The stepper has no \`${label}\` button`);
	return found;
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

	it("reveals the right element and spotlights the right line at every step", async () => {
		const figure = await buildArtFigure();

		for (let step = 1; step <= EXPECTED_LINES.length; step += 1) {
			goTo(figure, step);

			expect(figure.dataset.step).toBe(String(step));
			expect(spotlightLine(figure)).toBe(EXPECTED_LINES[step - 1]);
			expect(current(figure)).toEqual(EXPECTED_CURRENT[step - 1]);
		}
	});

	it("publishes the count and starts at the first execution", async () => {
		const figure = await buildArtFigure();

		expect(figure.dataset.traceSteps).toBe("7");
		expect(figure.dataset.step).toBe("1");
	});
});

describe("the ends of the range", () => {
	it("stops at the last step, with Next disabled", async () => {
		const figure = await buildArtFigure();
		goTo(figure, 7);

		press(figure, "Next");

		expect(figure.dataset.step).toBe("7");
		expect(control(figure, "Next").disabled).toBe(true);
	});

	it("stops at the first step, with Previous disabled", async () => {
		const figure = await buildArtFigure();

		press(figure, "Previous");

		expect(figure.dataset.step).toBe("1");
		expect(control(figure, "Previous").disabled).toBe(true);
	});

	it("replays to the first step from the last", async () => {
		const figure = await buildArtFigure();
		goTo(figure, 7);

		press(figure, "Replay");

		expect(figure.dataset.step).toBe("1");
	});
});

describe("the keyboard", () => {
	it("matches Next, Previous, and Replay inside the figure", async () => {
		const figure = await buildArtFigure();

		// From the listing, not from a button: focus anywhere inside the figure
		// drives the stepper.
		key(figure.querySelector(".highlight-gutter-line") ?? figure, "ArrowRight");
		expect(figure.dataset.step).toBe("2");

		key(control(figure, "Next"), "ArrowRight");
		expect(figure.dataset.step).toBe("3");

		key(figure, "ArrowLeft");
		expect(figure.dataset.step).toBe("2");

		key(figure, "Home");
		expect(figure.dataset.step).toBe("1");
	});

	it("ignores the same keys pressed outside the figure", async () => {
		const figure = await buildArtFigure();
		goTo(figure, 3);

		key(document.body, "ArrowRight");

		expect(figure.dataset.step).toBe("3");
	});
});

describe("mounting", () => {
	it("adds no second control bar when called again", async () => {
		const figures = await mountPost();

		const again = mountTraceSteppers(document);

		expect(again).toBe(figures.length);
		for (const figure of figures) {
			expect(figure.querySelectorAll(".trace-stepper")).toHaveLength(1);
		}
	});

	it("skips a figure whose diagram never drew", async () => {
		// The mermaid-failure case: the sequence shipped on the figure, but the
		// `pre` is still text, so there is no timed element to reveal.
		document.body.innerHTML = (await getPost(POST_ID)).body ?? "";
		const figure = document.querySelector<HTMLElement>("figure");

		expect(mountTraceSteppers(document)).toBe(0);
		expect(figure?.querySelector(".trace-stepper")).toBeNull();
		expect(figure?.dataset.step).toBeUndefined();
	});

	it("steps two figures on one page independently", async () => {
		const [one, two] = await mountPost();

		press(one, "Next");
		press(one, "Next");

		expect(one.dataset.step).toBe("3");
		expect(two.dataset.step).toBe("1");
	});
});

describe("a step past the end of the listing", () => {
	// No figure in the post does this, so it needs its own fixture: `steps 0 5`
	// over a three-line listing.
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
		const [figure] = render(toHTML(SHORT));
		mountTraceSteppers(document);

		press(figure, "Next");
		press(figure, "Previous");
		press(figure, "Next");

		expect(figure.dataset.step).toBe("2");
		expect(spotlightLine(figure)).toBeNull();
		expect(warn).toHaveBeenCalledTimes(1);
	});
});
