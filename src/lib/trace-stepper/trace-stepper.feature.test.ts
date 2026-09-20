// @vitest-environment jsdom

// Feature test for stepping a trace figure through the code it traces.
//
// User story:
//   Given the figure in posts/interview_07_tracing_rust/post.md that traces
//   `fn build_art` called from `main`,
//   When a reader opens the post and presses Next from the start of the trace,
//   Then the reader walks the listing in execution order — main's call site
//   before the callee's body, even though the callee is written above it — and
//   the value table reveals exactly the items that statement produces, while the
//   listing spotlights that statement's line;
//   And before the stepper mounts, or on a diagram that carries no timing
//   notation, the figure is the complete trace it is today.
//
// Everything here runs shipped code: getPost drives the real markdown pipeline,
// renderTrace stands in for mermaid's client-side draw, and the test presses the
// same buttons a reader presses. The renderer measures text arithmetically
// rather than with getBBox, which is what lets this run under jsdom instead of a
// browser; playwright-cli stays the manual visual check named by AGENTS.md.

import { describe, expect, it } from "vitest";
import { getPost } from "../posts.ts";
import { renderTrace } from "../trace-diagram/render-trace.ts";
import { mountTraceSteppers } from "./stepper.ts";

const POST_ID = "interview_07_tracing_rust";

/** The figure whose diagram traces `build_art`, with its diagram drawn as SVG. */
function buildArtFigure(body: string): HTMLElement {
	document.body.innerHTML = body;
	const figure = [...document.querySelectorAll<HTMLElement>("figure")].find(
		(candidate) =>
			candidate
				.querySelector("pre.mermaid")
				?.textContent?.includes("frame build_art") ?? false,
	);
	if (!figure) throw new Error(`No build_art trace figure in ${POST_ID}`);
	const pre = figure.querySelector("pre.mermaid");
	if (!pre) throw new Error("The build_art figure lost its diagram");
	renderTrace(pre.textContent ?? "", figure);
	pre.remove();
	return figure;
}

const state = (figure: Element, text: string): string | null => {
	const owner = [...figure.querySelectorAll("[data-at]")].find((element) =>
		(element.textContent ?? "").includes(text),
	);
	if (!owner) throw new Error(`No timed element holds \`${text}\``);
	return owner.getAttribute("data-state");
};

const spotlightLine = (figure: Element): string | null =>
	figure
		.querySelector('.highlight-gutter-line[data-state="current"]')
		?.textContent?.trim() ?? null;

const press = (figure: Element, label: string): void => {
	const button = [...figure.querySelectorAll("button")].find(
		(candidate) => candidate.textContent?.trim() === label,
	);
	if (!button) throw new Error(`The stepper has no \`${label}\` button`);
	button.click();
};

describe("a reader steps a trace figure through its code", () => {
	it("advances one executed statement at a time, in execution order", async () => {
		const body = (await getPost(POST_ID)).body ?? "";
		const figure = buildArtFigure(body);

		// Before the stepper mounts the figure is the finished trace: no timing
		// state, no controls, and every value already drawn.
		expect(figure.querySelector("[data-state]")).toBeNull();
		expect(figure.querySelector(".trace-stepper")).toBeNull();
		expect(figure.textContent).toContain("Artwork Liberty");

		expect(mountTraceSteppers(document)).toBeGreaterThan(0);

		// The figure mounts at its first execution, because the feature is
		// animation: a figure mounted complete animates nothing.
		// `steps 9 10 0 1 2 3 11` is seven executions of the thirteen-line listing.
		const status = figure.querySelector('[role="status"]');
		expect(figure.dataset.traceSteps).toBe("7");
		expect(figure.dataset.step).toBe("1");
		expect(status?.getAttribute("aria-live")).toBe("polite");
		expect(status?.textContent).toMatch(/Step 1 of 7/);

		press(figure, "Replay");
		expect(figure.dataset.step).toBe("1");
		expect(status?.textContent).toMatch(/Step 1 of 7/);
		expect(spotlightLine(figure)).toBe("fn main() {");

		// Step 2 is main's call site. The callee's `art` is written on listing
		// line 1, numerically before, and must NOT be revealed yet.
		press(figure, "Next");
		expect(figure.dataset.step).toBe("2");
		expect(spotlightLine(figure)).toBe("let my_art = build_art();");
		expect(state(figure, "my_art")).toBe("current");
		expect(state(figure, "Artwork Liberty")).toBe("future");

		// Stepping into the callee moves the spotlight UP the listing.
		press(figure, "Next");
		expect(spotlightLine(figure)).toBe("fn build_art<'a>() -> &'a Artwork {");
		press(figure, "Next");
		expect(figure.dataset.step).toBe("4");
		expect(spotlightLine(figure)).toBe('let art = artwork("Liberty");');
		expect(state(figure, "Artwork Liberty")).toBe("current");
		expect(state(figure, "my_art")).toBe("past");

		// The rejected return draws its arrow with the value that owns it.
		press(figure, "Next");
		expect(spotlightLine(figure)).toBe("&art // rejected return");
		expect(
			figure.querySelector('.trace-return-arrow[data-state="current"]'),
		).not.toBeNull();

		// Replay returns to the first execution from wherever the reader is.
		press(figure, "Replay");
		expect(figure.dataset.step).toBe("1");
		expect(spotlightLine(figure)).toBe("fn main() {");

		// Nothing is ever removed from the accessibility tree while stepping.
		expect(figure.querySelector("[data-at][aria-hidden]")).toBeNull();
		expect(
			[...figure.querySelectorAll<HTMLElement>("[data-at]")].every(
				(element) => element.style.display !== "none",
			),
		).toBe(true);

		// Backward compatibility: a diagram with no timing notation gets no
		// stepper and no timing state at all.
		document.body.innerHTML = "";
		const plain = document.createElement("figure");
		plain.className = "trace-figure";
		document.body.append(plain);
		renderTrace(
			"traceDiagram\n  frame main\n    a: 7\n    done\n  end\n",
			plain,
		);
		expect(mountTraceSteppers(document)).toBe(0);
		expect(plain.querySelector("[data-at]")).toBeNull();
		expect(plain.querySelector(".trace-stepper")).toBeNull();
		expect(plain.dataset.step).toBeUndefined();
	});
});
