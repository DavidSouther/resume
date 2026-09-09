// Feature: /flashcards serves a deck picker, and each deck gets its own
// working Browse/Review flashcard page.
//
// Builds the real SSG pipeline (same convention as astrolabe's feature test)
// and asserts on the produced docs/flashcards/ output, so this exercises the
// actual page modules, deck data, and client bundling together rather than
// each in isolation.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

const ROOT = join(import.meta.dirname, "..", "..");
const HUB_PAGE = join(ROOT, "docs/flashcards/index.html");
const RUST_PAGE = join(ROOT, "docs/flashcards/rust/index.html");
const SQL_PAGE = join(ROOT, "docs/flashcards/sql/index.html");
const RUST_ASSET = join(ROOT, "docs/_flashcards/rust-cheat-sheet.yaml");
const SQL_ASSET = join(ROOT, "docs/_flashcards/sql-cheat-sheet.yaml");

describe("flashcards: SSG pipeline produces the hub and per-deck pages", () => {
	let hubHtml: string;
	let rustHtml: string;

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
		hubHtml = readFileSync(HUB_PAGE, "utf-8");
		rustHtml = readFileSync(RUST_PAGE, "utf-8");
	}, 120_000);

	describe("/flashcards/ (hub)", () => {
		it("produces docs/flashcards/index.html", () => {
			expect(existsSync(HUB_PAGE)).toBe(true);
		});

		it("links to every registered deck's own page", () => {
			expect(hubHtml).toContain('href="/flashcards/rust/"');
			expect(hubHtml).toContain('href="/flashcards/sql/"');
		});

		it("names each deck by title", () => {
			expect(hubHtml).toContain("Rust Cheat Sheet");
			expect(hubHtml).toContain("SQL Cheat Sheet");
		});
	});

	describe("/flashcards/rust/", () => {
		it("produces docs/flashcards/rust/index.html", () => {
			expect(existsSync(RUST_PAGE)).toBe(true);
		});

		it("titles the page", () => {
			expect(rustHtml).toContain("<title>Rust Cheat Sheet Flashcards</title>");
		});

		it("links back to the hub", () => {
			expect(rustHtml).toContain('href="/flashcards/"');
		});

		it("copies the deck YAML to docs/_flashcards/, fetchable at the URL the client requests", () => {
			expect(existsSync(RUST_ASSET)).toBe(true);
			const notes = parseYaml(readFileSync(RUST_ASSET, "utf-8"));
			expect(Array.isArray(notes)).toBe(true);
			expect(notes.length).toBeGreaterThan(0);
		});

		it("server-renders one tile per derived card, not just per note", () => {
			const notes = parseYaml(readFileSync(RUST_ASSET, "utf-8"));
			const tileCount = (rustHtml.match(/class="flash-tile"/g) ?? []).length;
			// Some notes (Cloze) derive more than one card, so there are at least as
			// many tiles as notes.
			expect(tileCount).toBeGreaterThanOrEqual(notes.length);
		});

		it("renders every top-level group heading from the deck's outline", () => {
			for (const group of [
				"Language Constructs",
				"The Abstract Machine",
				"Tooling",
				"Coding Guides",
			]) {
				expect(rustHtml).toContain(`>${group}<`);
			}
		});

		it("renders the toolbar controls and the Browse/Review tab strip", () => {
			expect(rustHtml).toContain('class="flashcards-search"');
			expect(rustHtml).toContain('class="flashcards-deck-select"');
			expect(rustHtml).toMatch(/role="tablist"/);
			expect(rustHtml).toMatch(/role="tab"[^>]*>Browse</);
			expect(rustHtml).toMatch(/role="tab"[^>]*>Review</);
		});

		it("renders the review panel shell as a tabpanel", () => {
			expect(rustHtml).toMatch(/class="review-view"[^>]*role="tabpanel"/);
			expect(rustHtml).toContain('class="review-start"');
		});

		it("stamps its deck slug onto the root element for client.ts", () => {
			expect(rustHtml).toContain('data-deck-slug="rust"');
		});

		it("injects the bundled client module into the page", () => {
			expect(rustHtml).toMatch(
				/\/assets\/src-components-flashcards-client-[^"]+\.js/,
			);
		});
	});

	describe("/flashcards/sql/", () => {
		it("produces docs/flashcards/sql/index.html, scoped to its own deck", () => {
			expect(existsSync(SQL_PAGE)).toBe(true);
			const html = readFileSync(SQL_PAGE, "utf-8");
			expect(html).toContain("<title>SQL Cheat Sheet Flashcards</title>");
			expect(html).toContain('data-deck-slug="sql"');
		});

		it("copies its own deck YAML to docs/_flashcards/", () => {
			expect(existsSync(SQL_ASSET)).toBe(true);
		});
	});
});
