import { describe, expect, it } from "vitest";
import type { CardTemplate } from "./anki-types.ts";
import { deckName, groupCardsByOutline } from "./deck-outline.ts";

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
	it("joins group and section under the Rust Cheat Sheet root", () => {
		expect(deckName("Tooling", "Cargo")).toBe(
			"Rust Cheat Sheet::Tooling::Cargo",
		);
	});
});

describe("groupCardsByOutline", () => {
	it("buckets cards by deck and preserves the fixed outline order, not insertion order", () => {
		const cards = [
			card(deckName("Tooling", "Cargo"), "t1"),
			card(deckName("Language Constructs", "Data Structures"), "lc1"),
		];
		const sections = groupCardsByOutline(cards);
		expect(sections.map((s) => s.section)).toEqual([
			"Data Structures",
			"Cargo",
		]);
	});

	it("omits sections with no cards", () => {
		const sections = groupCardsByOutline([
			card(deckName("Tooling", "Cargo"), "t1"),
		]);
		expect(sections).toHaveLength(1);
		expect(sections[0]).toMatchObject({ group: "Tooling", section: "Cargo" });
	});

	it("groups multiple cards under the same section together", () => {
		const sections = groupCardsByOutline([
			card(deckName("Tooling", "Cargo"), "t1"),
			card(deckName("Tooling", "Cargo"), "t2"),
		]);
		expect(sections).toHaveLength(1);
		expect(sections[0].cards).toHaveLength(2);
	});
});
