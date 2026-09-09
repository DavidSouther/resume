import { describe, expect, it } from "vitest";
import type { CardTemplate } from "./anki-types.ts";
import {
	deckName,
	groupCardsByOutline,
	outlineFor,
	RUST_OUTLINE,
} from "./deck-outline.ts";

function card(deck: string, id: string): CardTemplate {
	return {
		cardId: id,
		noteId: id,
		ord: 0,
		deckName: deck,
		tags: [],
		front: "f",
		back: "b",
	};
}

describe("deckName", () => {
	it("joins group and section under the outline's root", () => {
		expect(deckName(RUST_OUTLINE, "Tooling", "Cargo")).toBe(
			"Rust Cheat Sheet::Tooling::Cargo",
		);
	});

	it("omits the middle segment when group equals root (a flat, two-level deck)", () => {
		const outline = outlineFor("SQL Cheat Sheet", []);
		expect(deckName(outline, "SQL Cheat Sheet", "Connecting")).toBe(
			"SQL Cheat Sheet::Connecting",
		);
	});
});

describe("groupCardsByOutline (authored outline)", () => {
	it("buckets cards by deck and preserves the fixed outline order, not insertion order", () => {
		const cards = [
			card(deckName(RUST_OUTLINE, "Tooling", "Cargo"), "t1"),
			card(
				deckName(RUST_OUTLINE, "Language Constructs", "Data Structures"),
				"lc1",
			),
		];
		const sections = groupCardsByOutline(RUST_OUTLINE, cards);
		expect(sections.map((s) => s.section)).toEqual([
			"Data Structures",
			"Cargo",
		]);
	});

	it("omits sections with no cards", () => {
		const sections = groupCardsByOutline(RUST_OUTLINE, [
			card(deckName(RUST_OUTLINE, "Tooling", "Cargo"), "t1"),
		]);
		expect(sections).toHaveLength(1);
		expect(sections[0]).toMatchObject({ group: "Tooling", section: "Cargo" });
	});

	it("groups multiple cards under the same section together", () => {
		const sections = groupCardsByOutline(RUST_OUTLINE, [
			card(deckName(RUST_OUTLINE, "Tooling", "Cargo"), "t1"),
			card(deckName(RUST_OUTLINE, "Tooling", "Cargo"), "t2"),
		]);
		expect(sections).toHaveLength(1);
		expect(sections[0].cards).toHaveLength(2);
	});
});

describe("outlineFor (derived outline)", () => {
	it("returns the authored outline for a root that has one", () => {
		expect(outlineFor("Rust Cheat Sheet", [])).toBe(RUST_OUTLINE);
	});

	it("derives a flat, single-group outline for a two-level (Root::Section) deck", () => {
		const cards = [
			card("SQL Cheat Sheet::Connecting", "c1"),
			card("SQL Cheat Sheet::Joins", "c2"),
			card("SQL Cheat Sheet::Connecting", "c3"),
		];
		const outline = outlineFor("SQL Cheat Sheet", cards);
		expect(outline.groups).toEqual([
			{ group: "SQL Cheat Sheet", sections: ["Connecting", "Joins"] },
		]);
	});

	it("derives a Group::Section outline for a three-level deck with no authored entry", () => {
		const cards = [
			card("New Deck::Basics::Intro", "c1"),
			card("New Deck::Basics::Setup", "c2"),
			card("New Deck::Advanced::Tuning", "c3"),
		];
		const outline = outlineFor("New Deck", cards);
		expect(outline.groups).toEqual([
			{ group: "Basics", sections: ["Intro", "Setup"] },
			{ group: "Advanced", sections: ["Tuning"] },
		]);
	});

	it("ignores cards belonging to a different root", () => {
		const cards = [card("Other Deck::Section", "c1")];
		expect(outlineFor("New Deck", cards).groups).toEqual([]);
	});

	it("preserves each section's first-appearance order and de-duplicates repeats", () => {
		const cards = [
			card("New Deck::Basics::Setup", "c1"),
			card("New Deck::Basics::Intro", "c2"),
			card("New Deck::Basics::Setup", "c3"),
		];
		expect(outlineFor("New Deck", cards).groups[0].sections).toEqual([
			"Setup",
			"Intro",
		]);
	});
});
