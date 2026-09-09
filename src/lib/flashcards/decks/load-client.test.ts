// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from "vitest";
import { stringify as toYaml } from "yaml";
import { loadAllDecks, loadDeck } from "./load-client.ts";
import { DECK_MANIFEST } from "./manifest.ts";

const GOOD_NOTE = {
	noteId: "n1",
	modelName: "Basic",
	deckName: "Rust Cheat Sheet::Test",
	fields: { Front: "f", Back: "b" },
	tags: ["rust"],
};

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("loadAllDecks (client)", () => {
	it("fetches every manifest entry's url and parses the response", async () => {
		const fetchMock = vi.fn(async () => ({
			ok: true,
			status: 200,
			statusText: "OK",
			text: async () => toYaml([GOOD_NOTE]),
		}));
		vi.stubGlobal("fetch", fetchMock);

		const decks = await loadAllDecks();
		expect(decks).toHaveLength(DECK_MANIFEST.length);
		expect(decks[0].notes).toEqual([GOOD_NOTE]);
		expect(fetchMock).toHaveBeenCalledWith(DECK_MANIFEST[0].url);
	});

	it("throws with the status when a fetch fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({ ok: false, status: 404, statusText: "Not Found" })),
		);

		await expect(loadAllDecks()).rejects.toThrow(/404/);
	});
});

describe("loadDeck (client)", () => {
	it("fetches only the matching manifest entry's url", async () => {
		const fetchMock = vi.fn(async () => ({
			ok: true,
			status: 200,
			statusText: "OK",
			text: async () => toYaml([GOOD_NOTE]),
		}));
		vi.stubGlobal("fetch", fetchMock);

		const target = DECK_MANIFEST[0];
		const deck = await loadDeck(target.slug);
		expect(deck.slug).toBe(target.slug);
		expect(deck.title).toBe(target.title);
		expect(deck.notes).toEqual([GOOD_NOTE]);
		expect(fetchMock).toHaveBeenCalledTimes(1);
		expect(fetchMock).toHaveBeenCalledWith(target.url);
	});

	it("throws for a slug not in the manifest", async () => {
		await expect(loadDeck("nope")).rejects.toThrow(/nope/);
	});
});
