// Feature: an author edits the two source files beside the page, and the built
// page follows them. content.md narrates exactly its steps, in order, with
// Markdown bodies rendered as HTML. staffing.csv is the sample table: its rows
// are the first keyframe, and the browser bundle receives the same text.
//
// Both files are parsed here with plain regexes, independent of the loaders, so
// the file formats themselves are part of what this test pins down.
// Reads the docs/ that the vitest global setup built.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { buildKeyframes } from "./plan.ts";
import { loadStages } from "./staffing.ts";

const ROOT = join(import.meta.dirname, "..", "..", "..", "..");
const CONTENT = join(import.meta.dirname, "content.md");
const STAFFING = join(import.meta.dirname, "staffing.csv");
const PAGE = join(ROOT, "docs/course/cisc_7510/normal_forms/index.html");

describe("normal forms source files", () => {
	let html: string;
	let source: string;

	beforeAll(() => {
		source = readFileSync(CONTENT, "utf-8");
		html = readFileSync(PAGE, "utf-8");
	}, 180_000);

	it("declares each step as a heading with an ID", () => {
		const ids = [...source.matchAll(/^## \{#([a-z0-9-]+):.+\}\s*$/gm)].map(
			(m) => m[1],
		);
		const frames = buildKeyframes(loadStages());
		expect(ids).toEqual(frames.map((f) => f.id));
		expect(new Set(ids).size).toBe(ids.length);
	});

	it("renders one section per step, in file order, with its ID", () => {
		const fileIds = [...source.matchAll(/^## \{#([a-z0-9-]+):.+\}\s*$/gm)].map(
			(m) => m[1],
		);
		const pageIds = [...html.matchAll(/data-step-id="([^"]+)"/g)].map(
			(m) => m[1],
		);
		expect(pageIds).toEqual(fileIds);
	});

	it("uses the heading text as each step's card title", () => {
		const titles = [...source.matchAll(/^## \{#[a-z0-9-]+:(.+)\}\s*$/gm)].map(
			(m) => m[1],
		);
		for (const title of titles) expect(html).toContain(`<h2>${title}</h2>`);
	});

	it("renders Markdown emphasis in a step body as HTML", () => {
		const emphasis = [...source.matchAll(/(?<![*\w])\*([^*\n]+)\*(?![*\w])/g)];
		expect(emphasis.length).toBeGreaterThan(0);
		for (const [, text] of emphasis) expect(html).toContain(`<em>${text}</em>`);
	});

	it("fills every placeholder", () => {
		expect(html).not.toContain("{{");
	});

	it("renders the page title from the same file", () => {
		const title = /^# (.+)$/m.exec(source)?.[1] ?? "";
		expect(html).toContain(`<h1>${title}</h1>`);
	});

	describe("staffing.csv", () => {
		// RFC 4180 enough for this file: quoted fields may hold commas.
		const rows = (): string[][] =>
			readFileSync(STAFFING, "utf-8")
				.trim()
				.split("\n")
				.map((line) =>
					[...line.matchAll(/("([^"]*)"|[^,]*)(,|$)/g)]
						.slice(0, -1)
						.map((m) => m[2] ?? m[1]),
				);

		it("has a header row and rows of the same width", () => {
			const [header, ...body] = rows();
			expect(body.length).toBeGreaterThan(0);
			for (const row of body) expect(row).toHaveLength(header.length);
		});

		it("renders one row per CSV row and one column per header field", () => {
			const [header, ...body] = rows();
			const table = html.slice(
				html.indexOf("<table"),
				html.indexOf("</table>"),
			);
			expect((table.match(/<th[ >]/g) ?? []).length).toBe(header.length);
			expect((table.match(/<td[ >]/g) ?? []).length).toBe(
				body.length * header.length,
			);
		});

		it("embeds the file text for the browser bundle", () => {
			const embedded = /<script[^>]*id="nf-data"[^>]*>([^<]*)<\/script>/.exec(
				html,
			)?.[1];
			expect(embedded?.trim()).toBe(readFileSync(STAFFING, "utf-8").trim());
		});
	});
});
