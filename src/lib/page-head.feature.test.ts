// @vitest-environment jsdom

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { mount, resetDom } from "../components/test-dom.ts";
import {
	JIFFIES_CSS_UNPKG_FILENAME,
	JIFFIES_CSS_BUNDLE as UNPKG_JIFFIES_CSS,
} from "./jiffies-css-bundle.ts";
import { pageHead } from "./page-head.ts";

function stylesheetHrefs(): string[] {
	const container = mount(pageHead("Test Title"));
	const links = container.querySelectorAll<HTMLLinkElement>(
		'link[rel="stylesheet"]',
	);
	const hrefs = [...links].map((l) => l.getAttribute("href") ?? "");
	resetDom();
	return hrefs;
}

describe("published deps: page head links jiffies-css from unpkg", () => {
	it("links the jiffies-css bundle from the pinned unpkg URL", () => {
		expect(stylesheetHrefs()).toContain(UNPKG_JIFFIES_CSS);
	});

	it("no longer links the bundle as a local path", () => {
		// The bundle filename still appears inside the pinned unpkg URL, so
		// assert the exact root-relative local href is absent, not the substring.
		expect(stylesheetHrefs()).not.toContain(`/${JIFFIES_CSS_UNPKG_FILENAME}`);
	});

	it("still links the built /global.css", () => {
		expect(stylesheetHrefs()).toContain("/global.css");
	});

	it("consumes @davidsouther/jiffies from the registry, not a file: path", () => {
		const pkg = JSON.parse(
			readFileSync(
				join(import.meta.dirname, "..", "..", "package.json"),
				"utf-8",
			),
		);
		const spec = pkg.devDependencies?.["@davidsouther/jiffies"] ?? "";
		expect(spec, `jiffies devDep is "${spec}"`).not.toMatch(/^file:/);
	});
});
