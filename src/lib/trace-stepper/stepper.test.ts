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
		.querySelector(
			'.highlight-gutter-line[data-state="current"], .trace-listing-line[data-state="current"]',
		)
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

describe("a loop figure's declared order", () => {
	// The `gcdmod` figure of `posts/interview_03_tracing.md`. Its listing runs
	// two lines repeatedly, so line order is not execution order, and one
	// statement — `[a, b] = [b, a % b]` — writes both rows on the same
	// execution. That pair is the first real exercise of a repeated line in
	// `steps` and of two rows interleaving through one line.
	const LOOP_POST_ID = "interview_03_tracing";
	const LOOP_SEQUENCE = "7 0 1 2 1 2 1 2 1 4";

	async function gcdmodFigure(): Promise<HTMLElement> {
		const figures = render((await getPost(LOOP_POST_ID)).body ?? "");
		mountTraceSteppers(document);
		const figure = figures.find(
			(candidate) => candidate.dataset.traceLines === LOOP_SEQUENCE,
		);
		if (!figure) throw new Error(`No gcdmod trace figure in ${LOOP_POST_ID}`);
		return figure;
	}

	// The loop body twice returns to the line above it, which is what a plain
	// ascending order cannot express.
	const EXPECTED_LINES = [
		"gcdmod(1071, 462);",
		"function gcdmod(a, b) {",
		"while (b != 0) {",
		"[a, b] = [b, a % b];",
		"while (b != 0) {",
		"[a, b] = [b, a % b];",
		"while (b != 0) {",
		"[a, b] = [b, a % b];",
		"while (b != 0) {",
		"return a;",
	];

	// Each run of the assignment reveals one value in *each* row, and strikes
	// the value it supersedes. A condition reveals nothing.
	const EXPECTED_CURRENT = [
		["trace-rule", "trace-frame-label:gcdmod"],
		[
			"trace-name:a",
			"trace-value-item:1071",
			"trace-name:b",
			"trace-value-item:462",
		],
		[],
		[
			"trace-strike",
			"trace-value-item:462",
			"trace-strike",
			"trace-value-item:147",
		],
		[],
		[
			"trace-strike",
			"trace-value-item:147",
			"trace-strike",
			"trace-value-item:21",
		],
		[],
		[
			"trace-strike",
			"trace-value-item:21",
			"trace-strike",
			"trace-value-item:0",
		],
		[],
		["trace-name:ret", "trace-value-item:21"],
	];

	it("reveals the right element and spotlights the right line at every step", async () => {
		const figure = await gcdmodFigure();

		for (let step = 1; step <= EXPECTED_LINES.length; step += 1) {
			goTo(figure, step);

			expect(figure.dataset.step).toBe(String(step));
			expect(spotlightLine(figure)).toBe(EXPECTED_LINES[step - 1]);
			expect(current(figure)).toEqual(EXPECTED_CURRENT[step - 1]);
		}
	});

	it("mounts every figure of the tracing post", async () => {
		const figures = render((await getPost(LOOP_POST_ID)).body ?? "");

		expect(mountTraceSteppers(document)).toBe(6);
		for (const figure of figures) {
			expect(figure.querySelectorAll(".trace-stepper")).toHaveLength(1);
			expect(figure.dataset.step).toBe("1");
		}
	});
});

describe("motion", () => {
	// The stylesheet animates a reveal. Running one backwards would un-draw an
	// arrow and slide a value back out of its cell, which reads as an undo of
	// something the reader never did, so a backward move commits instantly.
	//
	// The suppression is an attribute the stylesheet keys on. It is written and
	// lifted inside one call, around a forced layout read, so the suppressed
	// frame is committed before the transitions come back. Nothing observable
	// survives the call, which is exactly what these assert.

	it("suppresses no transition while moving forward", async () => {
		const figure = await buildArtFigure();

		press(figure, "Next");

		expect(figure.dataset.motion).toBeUndefined();
		expect(figure.querySelector("[data-motion]")).toBeNull();
	});

	it("lifts the backward suppression again once the move is committed", async () => {
		const figure = await buildArtFigure();
		goTo(figure, 4);

		press(figure, "Previous");

		expect(figure.dataset.step).toBe("3");
		expect(figure.dataset.motion).toBeUndefined();
		expect(figure.querySelector("[data-motion]")).toBeNull();
	});

	it("gives the sliding spotlight the row it has to slide to", async () => {
		const figure = await buildArtFigure();

		// Step 2 is `let my_art = build_art();`, listing line 10, and the listing
		// prints its thirteen lines in order, so the bar sits on row ten.
		press(figure, "Next");

		expect(figure.style.getPropertyValue("--trace-spotlight-index")).toBe("10");
		expect(figure.dataset.traceSpotlight).toBe("");
	});

	it("measures no arrow under an engine with no SVG geometry", async () => {
		const figure = await buildArtFigure();

		// jsdom implements no SVGGeometryElement, so the stylesheet's fallback
		// dash has to stand on its own. A browser overwrites it at mount.
		expect(figure.querySelector("[style*='--trace-draw-length']")).toBeNull();
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
