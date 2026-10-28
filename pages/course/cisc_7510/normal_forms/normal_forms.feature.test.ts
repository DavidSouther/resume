// Feature: /course/cisc_7510/normal_forms/ shows one messy staffing table and
// steps it through the normal forms by animating the data itself.
//
// Builds the real SSG pipeline and asserts on the produced docs/ output, so
// the page module, dataset, and client bundling are exercised together.
// This suite does not verify animation, scroll sync, or layout.

import { spawnSync } from "node:child_process";
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
		const result = spawnSync("npm", ["run", "build"], {
			cwd: ROOT,
			encoding: "utf-8",
		});
		if (result.status !== 0) {
			throw new Error(
				`Build failed (exit ${result.status}):\n${result.stderr}`,
			);
		}
		html = readFileSync(PAGE, "utf-8");
	}, 180_000);

	it("produces the page", () => {
		expect(existsSync(PAGE)).toBe(true);
	});

	it("server-renders the unnormalized table with list cells and nulls", () => {
		expect(html).toContain("Staffing");
		expect(html).toContain("P1 Apollo (12h), P2 Zephyr (8h)");
		expect(html).toContain('data-null="true"');
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
