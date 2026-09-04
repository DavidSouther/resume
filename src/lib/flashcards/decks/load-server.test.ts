import { describe, expect, it } from "vitest";
import { loadAllDecks } from "./load-server.ts";
import { DECK_MANIFEST } from "./manifest.ts";

describe("loadAllDecks (server)", () => {
	it("reads every manifest entry's YAML straight off disk under public/", async () => {
		const decks = await loadAllDecks();
		expect(decks).toHaveLength(DECK_MANIFEST.length);
		for (const [i, deck] of decks.entries()) {
			expect(deck.slug).toBe(DECK_MANIFEST[i].slug);
			expect(deck.title).toBe(DECK_MANIFEST[i].title);
			expect(deck.notes.length).toBeGreaterThan(0);
		}
	});

	it("every loaded note sits under its own deck's expected root", async () => {
		const [rust] = await loadAllDecks();
		for (const note of rust.notes) {
			expect(note.deckName.startsWith("Rust Cheat Sheet::")).toBe(true);
		}
	});
});
