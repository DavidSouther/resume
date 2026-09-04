// Feature: /flashcards serves a working Rust Cheat Sheet flashcard app.
//
// Builds the real SSG pipeline (same convention as astrolabe's feature test)
// and asserts on the produced docs/flashcards/ output, so this exercises the
// actual page module, deck data, and client bundling together rather than
// each in isolation.

import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { beforeAll, describe, expect, it } from "vitest";
import { parse as parseYaml } from "yaml";

const ROOT = join(import.meta.dirname, "..", "..");
const PAGE = join(ROOT, "docs/flashcards/index.html");
const DECK_ASSET = join(ROOT, "docs/_flashcards/rust-cheat-sheet.yaml");

describe("flashcards: SSG pipeline produces /flashcards/", () => {
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
	}, 120_000);

	it("produces docs/flashcards/index.html", () => {
		expect(existsSync(PAGE)).toBe(true);
	});

	it("titles the page", () => {
		expect(html).toContain("<title>Rust Cheat Sheet Flashcards</title>");
	});

	it("copies the deck YAML to docs/_flashcards/, fetchable at the URL the client requests", () => {
		expect(existsSync(DECK_ASSET)).toBe(true);
		const notes = parseYaml(readFileSync(DECK_ASSET, "utf-8"));
		expect(Array.isArray(notes)).toBe(true);
		expect(notes.length).toBeGreaterThan(0);
	});

	it("server-renders one tile per derived card, not just per note", () => {
		const notes = parseYaml(readFileSync(DECK_ASSET, "utf-8"));
		const tileCount = (html.match(/class="flash-tile"/g) ?? []).length;
		// Some notes (Cloze) derive more than one card, so there are at least as
		// many tiles as notes.
		expect(tileCount).toBeGreaterThanOrEqual(notes.length);
	});

	it("renders every top-level group heading from the deck outline", () => {
		for (const group of [
			"Language Constructs",
			"The Abstract Machine",
			"Tooling",
			"Coding Guides",
		]) {
			expect(html).toContain(`>${group}<`);
		}
	});

	it("renders the toolbar controls and the Browse/Review tab strip", () => {
		expect(html).toContain('class="flashcards-search"');
		expect(html).toContain('class="flashcards-deck-select"');
		expect(html).toMatch(/role="tablist"/);
		expect(html).toMatch(/role="tab"[^>]*>Browse</);
		expect(html).toMatch(/role="tab"[^>]*>Review</);
	});

	it("renders the review panel shell as a tabpanel", () => {
		expect(html).toMatch(/class="review-view"[^>]*role="tabpanel"/);
		expect(html).toContain('class="review-start"');
	});

	it("injects the bundled client module into the page", () => {
		expect(html).toMatch(
			/\/assets\/src-components-flashcards-client-[^"]+\.js/,
		);
	});
});
