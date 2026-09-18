// @vitest-environment jsdom

// The stepping half of `getStyles`. These are the two guarantees jsdom cannot
// observe from the stepper alone: that an unmounted figure is untouched, and
// that a reader who asked for less motion gets an instant opacity change.

import { describe, expect, it } from "vitest";
import { getStyles } from "./styles.ts";

/** Every innermost rule of `css`, flattened out of its at-rules. */
function rules(css: string): { selector: string; body: string }[] {
	return [...css.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((match) => ({
		selector: match[1].trim(),
		body: match[2].trim(),
	}));
}

/** The body of the `@media <query>` block, brace-balanced. */
function mediaBlock(css: string, query: string): string {
	const head = css.indexOf(`@media ${query}`);
	expect(head).toBeGreaterThan(-1);
	const open = css.indexOf("{", head);
	let depth = 0;
	for (let index = open; index < css.length; index += 1) {
		if (css[index] === "{") depth += 1;
		if (css[index] === "}") {
			depth -= 1;
			if (depth === 0) return css.slice(open + 1, index);
		}
	}
	throw new Error(`unbalanced @media ${query}`);
}

describe("the stepping styles", () => {
	it("reaches nothing the stepper has not marked", () => {
		const css = getStyles({ textColor: "black", lineColor: "black" });

		// Two directions of the same guarantee. A rule that can dim, move, or
		// recolour anything is keyed on `[data-state]`, which only the stepper
		// writes; and every such rule also names `[data-at]`, which only a tagged
		// diagram carries. So an untagged diagram, and a tagged diagram before
		// mount or after a mermaid failure, match none of them.
		const stepping = rules(css).filter((rule) =>
			rule.selector.includes("data-at"),
		);
		expect(stepping.length).toBeGreaterThan(0);
		for (const rule of stepping) {
			expect(rule.selector).toContain("data-state");
		}
		for (const rule of rules(css)) {
			if (rule.selector.includes("data-state")) {
				expect(rule.selector).toContain("data-at");
			}
		}
	});

	it("leaves a timed element that carries no state exactly as it draws today", () => {
		const style = document.createElement("style");
		style.textContent = getStyles({ textColor: "black", lineColor: "black" });
		document.head.append(style);
		const unmounted = document.createElement("span");
		unmounted.setAttribute("data-at", "3");
		const future = document.createElement("span");
		future.setAttribute("data-at", "3");
		future.setAttribute("data-state", "future");
		document.body.append(unmounted, future);

		expect(getComputedStyle(future).opacity).toBe("0");
		expect(getComputedStyle(unmounted).opacity).not.toBe("0");

		style.remove();
		unmounted.remove();
		future.remove();
	});

	it("collapses every motion to an opacity change when motion is reduced", () => {
		const reduce = mediaBlock(
			getStyles({}),
			"(prefers-reduced-motion: reduce)",
		);

		// Nothing slides, nothing draws, and nothing takes time. Only the base
		// `opacity: 0` on a future item survives, which is the instant change.
		expect(reduce).not.toMatch(/transform:\s*(?!none\b)\S/);
		expect(reduce).not.toMatch(/\b\d*[1-9]\d*m?s\b/);
		expect(reduce).toContain("transition: none");
		expect(reduce).toContain("animation: none");
	});

	it("draws and slides only when the reader has expressed no preference", () => {
		const motion = mediaBlock(
			getStyles({}),
			"(prefers-reduced-motion: no-preference)",
		);

		expect(motion).toContain("transform: translate(-8px, 0)");
		expect(motion).toContain("stroke-dashoffset");
		// A backward move suppresses its own transitions, so Previous and Replay
		// never play a reveal in reverse.
		for (const rule of rules(motion)) {
			if (rule.body.includes("transition:")) {
				expect(rule.selector).toContain(':not([data-motion="none"])');
			}
		}
	});

	it("shows the complete trace on paper", () => {
		const print = mediaBlock(getStyles({}), "print");

		expect(print).toContain('[data-at][data-state="future"] { opacity: 1; }');
		expect(print).toContain("stroke-dashoffset: 0");
	});
});
