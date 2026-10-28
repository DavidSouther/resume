// Feature: an author edits the two source files beside the page, and the built
// page follows them. content.md narrates exactly its steps, in order, with
// Markdown bodies rendered as HTML. staffing.csv is the sample table: its rows
// are the first keyframe, and the browser bundle receives the same text.
//
// Both files are parsed here with plain regexes, independent of the loaders, so
// the file formats themselves are part of what this test pins down.
// One build serves both stories: parallel builds would race on docs/.

import { spawnSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";

const ROOT = join(import.meta.dirname, "..", "..", "..", "..");
const CONTENT = join(import.meta.dirname, "content.md");
const STAFFING = join(import.meta.dirname, "staffing.csv");
const PAGE = join(ROOT, "docs/course/cisc_7510/normal_forms/index.html");

describe("normal forms source files", () => {
	let html: string;
	let source: string;

	beforeAll(() => {
		source = readFileSync(CONTENT, "utf-8");
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

	it("declares each step as a heading with an ID", () => {
		const ids = [...source.matchAll(/^## \{#([a-z0-9-]+):.+\}\s*$/gm)].map(
			(m) => m[1],
		);
		expect(ids).toHaveLength(11);
		expect(new Set(ids).size).toBe(ids.length);
		expect(ids[0]).toBe("raw");
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

	it("renders Markdown in a step body as HTML", () => {
		expect(html).toContain("<em>multivalued dependency</em>");
	});

	it("fills placeholders from the dataset", () => {
		expect(html).not.toContain("{{");
		expect(html).toMatch(/Marked columns break the rule: .*projects/);
		expect(html).toMatch(/Row counts: .*\d/);
	});

	it("renders the page title and intro from the same file", () => {
		const title = /^# (.+)$/m.exec(source)?.[1] ?? "";
		expect(html).toContain(`<h1>${title}</h1>`);
		expect(html).toContain("Introduction to Normalization</a>");
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

		it("has a header row and five employees", () => {
			const [header, ...body] = rows();
			expect(header[0]).toBe("emp_id");
			expect(body).toHaveLength(5);
		});

		it("renders every CSV row as a row of the first table", () => {
			const [, ...body] = rows();
			const table = html.slice(
				html.indexOf("<table"),
				html.indexOf("</table>"),
			);
			for (const row of body)
				for (const value of row.filter(Boolean)) expect(table).toContain(value);
			expect(table).toContain('data-null="true"');
		});

		it("embeds the file text for the browser bundle", () => {
			const embedded = /<script[^>]*id="nf-data"[^>]*>([^<]*)<\/script>/.exec(
				html,
			)?.[1];
			expect(embedded?.trim()).toBe(readFileSync(STAFFING, "utf-8").trim());
		});
	});
});
