// Feature: /course/cisc_7510/normal_forms/ shows one messy staffing table and
// steps it through the normal forms by animating the data itself.
//
// Reads the docs/ the vitest global setup built from the real SSG pipeline, so
// the page module, dataset, and client bundling are exercised together.
// This suite does not verify animation, scroll sync, or layout.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buildKeyframes } from "./plan.ts";
import { loadStages } from "./staffing.ts";

const ROOT = join(import.meta.dirname, "..", "..", "..", "..");
const PAGE = join(ROOT, "docs/course/cisc_7510/normal_forms/index.html");

describe("normal forms page", () => {
	let html: string;

	beforeAll(() => {
		html = readFileSync(PAGE, "utf-8");
	}, 180_000);

	it("produces the page", () => {
		expect(existsSync(PAGE)).toBe(true);
	});

	it("server-renders the first stage as one table with a cell per dataset cell", () => {
		const [first] = loadStages();
		const cells = first.tables.flatMap((t) => t.rows.flat());
		const tables = html.slice(
			html.indexOf("<table"),
			html.lastIndexOf("</table>"),
		);
		expect((tables.match(/<table/g) ?? []).length).toBe(first.tables.length);
		expect((tables.match(/data-cell-id="/g) ?? []).length).toBe(cells.length);
		expect((tables.match(/data-null="true"/g) ?? []).length).toBe(
			cells.filter((c) => c.value === null).length,
		);
	});

	it("has one narration section per keyframe", () => {
		expect((html.match(/class="nf-step"/g) ?? []).length).toBe(
			buildKeyframes(loadStages()).length,
		);
	});

	it("has a jump button for every form in its controls", () => {
		for (const form of ["1NF", "2NF", "3NF", "BCNF / 4NF", "Post BCNF"]) {
			expect(html).toMatch(
				new RegExp(`<button[^>]*data-nf-jump="\\d+"[^>]*>${form}</button>`),
			);
		}
	});

	it("links a bundled client module", () => {
		expect(html).toMatch(
			/<script[^>]*type="module"[^>]*>\s*import "[^"]*client[^"]*"/,
		);
	});
});
