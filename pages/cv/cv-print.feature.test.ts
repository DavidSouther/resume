// @vitest-environment jsdom
//
// Feature: /cv prints as a professional, compact academic CV.
//
// jsdom never evaluates `print` media, so this suite cannot observe rendered
// print output. It asserts the two things that produce it: the CV markup
// carries the scoping hooks, and src/global.css declares the @page geometry
// and the .cv print rules the design specifies. The CSS source is parsed into
// real CSSOM via a <style> tag, so the assertions survive lightningcss
// minification (which reorders and rewrites the built public/global.css).
//
// The rendered look itself is verified manually with a Playwright print
// screenshot of the served docs/ page.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, beforeAll, describe, expect, it } from "vitest";
import { resetDom } from "../../src/components/test-dom.ts";
import cvPage from "./page.ts";

const ROOT = join(import.meta.dirname, "..", "..");
const GLOBAL_CSS = join(ROOT, "src", "global.css");

const CSSRULE_PAGE = 6; // CSSRule.PAGE_RULE

afterEach(resetDom);

async function renderCv(): Promise<HTMLElement> {
	const node = await cvPage.default();
	return node as HTMLElement;
}

/** Every style rule inside a `@media print` block of src/global.css. */
let printRules: CSSStyleRule[];
/** The document-level `@page` rule, if src/global.css declares one. */
let pageRule: CSSPageRule | undefined;
let cssSource: string;

beforeAll(() => {
	cssSource = readFileSync(GLOBAL_CSS, "utf-8");
	const style = document.createElement("style");
	style.textContent = cssSource;
	document.head.append(style);
	const sheet = style.sheet;
	if (!sheet) throw new Error("src/global.css did not parse into a stylesheet");

	printRules = [];
	pageRule = undefined;
	for (const rule of sheet.cssRules) {
		// `@media not print` also contains "print"; match the condition exactly.
		if (rule instanceof CSSMediaRule && rule.conditionText.trim() === "print") {
			for (const nested of rule.cssRules) {
				if (nested instanceof CSSStyleRule) printRules.push(nested);
			}
		}
		if (rule.type === CSSRULE_PAGE) pageRule = rule as CSSPageRule;
	}
	style.remove();
});

/**
 * Look up a declaration the CV print sheet makes about `target` elements.
 *
 * Scans every `@media print` style rule for a comma-separated selector that is
 * scoped under `.cv` and whose right-most simple selector is `target`, so any
 * of `.cv h2`, `.cv section h2`, or `.cv > section > h2` satisfies it.
 * Returns "" when no such declaration exists.
 */
function cvPrintValue(target: string, property: string): string {
	for (const rule of printRules) {
		for (const selector of rule.selectorText.split(",")) {
			const trimmed = selector.trim();
			if (!trimmed.startsWith(".cv ") && !trimmed.startsWith(".cv>")) continue;
			const parts = trimmed.split(/[\s>]+/).filter(Boolean);
			if (parts.at(-1) !== target) continue;
			const value = rule.style.getPropertyValue(property);
			if (value) return value;
		}
	}
	return "";
}

/**
 * Look up a declaration the print sheet makes on the `.cv` root itself, where
 * the jiffies-css token overrides live. Matches a rule whose selector is exactly
 * `.cv`, not a descendant selector.
 */
function cvRootPrintValue(property: string): string {
	for (const rule of printRules) {
		for (const selector of rule.selectorText.split(",")) {
			if (selector.trim() !== ".cv") continue;
			const value = rule.style.getPropertyValue(property);
			if (value) return value;
		}
	}
	return "";
}

/** Look up a declaration any `@media print` rule makes about bare `element`. */
function printValue(element: string, property: string): string {
	for (const rule of printRules) {
		for (const selector of rule.selectorText.split(",")) {
			if (selector.trim() !== element) continue;
			const value = rule.style.getPropertyValue(property);
			if (value) return value;
		}
	}
	return "";
}

describe("the CV page prints as a compact academic CV", () => {
	it("scopes its print styling with a .cv root that opts out of href expansion", async () => {
		const root = await renderCv();

		// `.cv` keeps the CV's print rules off the resume/home/blog pages;
		// `.no-print-href` is the repo's existing opt-out for the unscoped
		// `a::after { content: " (" attr(href) ")" }` rule, which would otherwise
		// print a raw URL after all 35 of this CV's links.
		expect([...root.classList].sort()).toEqual(
			expect.arrayContaining(["cv", "no-print-href"]),
		);
	});

	it("marks the draft disclaimer .no-print so it never reaches the committee", async () => {
		const root = await renderCv();

		const draft = [...root.querySelectorAll("p")].find((p) =>
			p.textContent?.includes("Draft CV"),
		);
		expect(draft, "the draft disclaimer paragraph is missing").toBeDefined();
		expect(draft?.classList.contains("no-print")).toBe(true);
	});

	it("sets US Letter page geometry with compact vertical margins", () => {
		expect(pageRule, "src/global.css declares no @page rule").toBeDefined();
		// jsdom's CSS parser drops the unknown `size` property from the CSSOM, so
		// that one declaration is checked against the source text.
		expect(cssSource).toMatch(/@page\s*\{[^}]*\bsize\s*:\s*letter\b/);
		expect(pageRule?.style.getPropertyValue("margin")).not.toBe("");
	});

	it("never strands a section heading at the foot of a page", () => {
		for (const heading of ["h1", "h2", "h3"]) {
			expect(
				cvPrintValue(heading, "break-after"),
				`.cv ${heading} does not avoid a page break after it`,
			).toBe("avoid");
			expect(
				cvPrintValue(heading, "page-break-after"),
				`.cv ${heading} is missing the legacy page-break-after alias`,
			).toBe("avoid");
		}
	});

	it("keeps paragraphs and list entries whole across a page break", () => {
		// Long interest/appointment paragraphs stay breakable; orphan and widow
		// control keeps at least three lines on each side of the break.
		expect(Number(cvPrintValue("p", "orphans"))).toBeGreaterThanOrEqual(2);
		expect(Number(cvPrintValue("p", "widows"))).toBeGreaterThanOrEqual(2);
		// The one-line essay bullets are short enough to keep intact.
		expect(cvPrintValue("li", "break-inside")).toBe("avoid");
	});

	it("drops the twelve section rules that only separate sections on screen", () => {
		expect(cvPrintValue("hr", "display")).toBe("none");
	});

	it("prints links as plain black text rather than colored underlined runs", () => {
		expect(cvPrintValue("a", "text-decoration")).toBe("none");
		// The global print block declares `--color` on anchors and reads it back as
		// `color: var(--color)`. Feeding that variable is enough; a `color`
		// override would be fighting a rule that is already asking for input.
		expect(cvPrintValue("a", "--color")).not.toBe("");
	});

	// The three regressions below were invisible to the assertions above: each
	// one is a bundle rule *winning*, not a `.cv` rule being absent, and jsdom
	// never evaluates print media to notice. A Chrome PDF export of the served
	// page ran to 17 pages for a ~3,700-word CV because of them.

	it("retunes the jiffies-css type tokens rather than overriding font-size", () => {
		// The bundle reads `--font-size-base: var(--base-font-size)` on each block
		// element, so setting the token on `.cv` reaches every descendant and no
		// per-element `font-size` override is needed.
		expect(cvRootPrintValue("--base-font-size")).not.toBe("");
		expect(cvRootPrintValue("--base-line-height")).not.toBe("");
	});

	it("sets the heading tokens directly, since they resolve at :root", () => {
		// `--font-size-h1: calc(var(--base-font-size) * pow(var(--font-scale), 6))`
		// is declared on :root, so it resolves there against :root's 18px and
		// inherits as a fixed length. Overriding `--base-font-size` on `.cv` never
		// reaches it: measured in print emulation, h1 printed at 68.66px (18 *
		// 1.25^6) and h2 at 54.93px while body text correctly followed the token
		// down to 10pt. These three have to be declared on `.cv` itself.
		for (const token of [
			"--font-size-h1",
			"--font-size-h2",
			"--font-size-h3",
		]) {
			expect(
				cvRootPrintValue(token),
				`${token} is left to resolve at :root, where it ignores the CV's base size`,
			).not.toBe("");
		}
	});

	it("flattens the section cards through tokens, plus the border it cannot reach", () => {
		// jiffdown nests a <section> per heading level. The bundle's card gives
		// each one a surface fill, a radius, and --size-medium/--size-large
		// gutters; those it reads from public tokens on the element, so setting
		// them on `.cv` is enough. The 2px rule is the exception -- it comes from
		// neither --card-border (already `none`) nor --base-border-size, so it
		// needs the one property override in the sheet. Nested three deep it
		// printed as rules running down both page edges.
		expect(cvRootPrintValue("--card-background-color")).not.toBe("");
		expect(cvRootPrintValue("--size-medium")).toBe("0");
		expect(cvRootPrintValue("--size-large")).toBe("0");
		// jsdom serializes the `border` shorthand back as `medium`, so assert the
		// longhand it does keep.
		expect(
			cvPrintValue("section", "border-style"),
			".cv section keeps its card border, which prints as a rule down the page edge",
		).toBe("none");
	});

	it("prints on white paper rather than the site's tinted background", () => {
		// `body` is an ancestor of the `.cv` root, so no `.cv `-scoped selector can
		// reach it. The global print block clears it for every printed page, which
		// is the right scope: --color-surface: white does not touch
		// --color-background, a tinted oklch value.
		expect(
			printValue("body", "background-color"),
			"the print sheet never clears the tinted body background",
		).not.toBe("");
	});
});
