// @vitest-environment jsdom
//
// Page-module head contract for the /astrolabe/ route. The feature test
// (src/components/astrolabe/shell.feature.test.ts) owns the body assertions;
// this guard covers what it does not: the <head> ships pageHead's output PLUS
// the two Google Fonts <link>s (Cormorant Garamond for display, DM Mono for
// the readouts), and default() renders the shell.
import { describe, expect, it } from "vitest";
import { mount, resetDom } from "../../src/components/test-dom.ts";
import astrolabePage from "./page.ts";

function headFragment(): Element {
	const head = astrolabePage.head?.();
	if (head === undefined || head instanceof Promise) {
		throw new Error("astrolabe head() must return a synchronous Node | Node[]");
	}
	const container = mount(head);
	return container;
}

describe("astrolabe page module head", () => {
	it("includes pageHead output (the page <title>)", () => {
		const head = headFragment();
		const title = head.querySelector("title");
		expect(title?.textContent).toBe("Astrolabe — David Souther");
		resetDom();
	});

	it("appends a Cormorant Garamond Google Fonts stylesheet link", () => {
		const head = headFragment();
		const hrefs = [...head.querySelectorAll<HTMLLinkElement>("link")].map(
			(l) => l.getAttribute("href") ?? "",
		);
		expect(
			hrefs.some(
				(h) =>
					h.includes("fonts.googleapis.com") &&
					h.includes("Cormorant+Garamond"),
			),
		).toBe(true);
		resetDom();
	});

	it("appends a DM Mono Google Fonts stylesheet link", () => {
		const head = headFragment();
		const hrefs = [...head.querySelectorAll<HTMLLinkElement>("link")].map(
			(l) => l.getAttribute("href") ?? "",
		);
		expect(
			hrefs.some(
				(h) => h.includes("fonts.googleapis.com") && h.includes("DM+Mono"),
			),
		).toBe(true);
		resetDom();
	});

	it("default() renders the shell figure with an empty dial container", () => {
		const node = astrolabePage.default();
		if (node instanceof Promise) {
			throw new Error("astrolabe default() must be synchronous");
		}
		const container = mount(node);
		expect(container.querySelector("figure")).not.toBeNull();
		expect(container.querySelectorAll("[data-astrolabe-dial]").length).toBe(1);
		resetDom();
	});
});
