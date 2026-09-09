import { describe, expect, it } from "vitest";
import { loadAllDecks, loadDeck } from "./load-server.ts";
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
		for (const deck of await loadAllDecks()) {
			for (const note of deck.notes) {
				expect(note.deckName.startsWith(`${deck.title}::`)).toBe(true);
			}
		}
	});
});

describe("loadDeck (server)", () => {
	it("loads only the matching manifest entry", async () => {
		for (const entry of DECK_MANIFEST) {
			const deck = await loadDeck(entry.slug);
			expect(deck.slug).toBe(entry.slug);
			expect(deck.title).toBe(entry.title);
			expect(deck.notes.length).toBeGreaterThan(0);
		}
	});

	it("throws for a slug not in the manifest", async () => {
		await expect(loadDeck("nope")).rejects.toThrow(/nope/);
	});
});
