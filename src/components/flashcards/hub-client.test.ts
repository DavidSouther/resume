// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { stringify as toYaml } from "yaml";
import type { Note } from "../../lib/flashcards/anki-types.ts";
import { loadExternalDeck, titleFrom } from "./hub-client.ts";

const GOOD_NOTE: Note = {
	noteId: "n1",
	modelName: "Basic",
	deckName: "Test Deck::General",
	fields: { Front: "f", Back: "b" },
	tags: [],
};

function setUpHub(): void {
	document.body.innerHTML = `
		<div class="hub-external-status" role="alert" hidden></div>
		<div class="hub-external-mount"></div>
	`;
}

beforeEach(() => {
	setUpHub();
	localStorage.clear();
});

afterEach(() => {
	vi.unstubAllGlobals();
});

describe("titleFrom", () => {
	it("uses the shared root segment of the notes' deckName", () => {
		expect(titleFrom([GOOD_NOTE])).toBe("Test Deck");
	});

	it("falls back to a generic label for an empty note list", () => {
		expect(titleFrom([])).toBe("External deck");
	});
});

describe("loadExternalDeck", () => {
	it("mounts a working app and hides the status alert on success", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: true,
				status: 200,
				statusText: "OK",
				text: async () => toYaml([GOOD_NOTE]),
			})),
		);

		await loadExternalDeck("https://example.com/deck.yaml");

		const status = document.querySelector<HTMLElement>(".hub-external-status");
		const mount = document.querySelector<HTMLElement>(".hub-external-mount");
		expect(status?.hidden).toBe(true);
		expect(mount?.querySelector(".flashcards")).not.toBeNull();
		expect(mount?.querySelector(".flash-tile")).not.toBeNull();
	});

	it("shows an error and mounts nothing when the fetch fails", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({ ok: false, status: 404, statusText: "Not Found" })),
		);

		await loadExternalDeck("https://example.com/missing.yaml");

		const status = document.querySelector<HTMLElement>(".hub-external-status");
		const mount = document.querySelector<HTMLElement>(".hub-external-mount");
		expect(status?.hidden).toBe(false);
		expect(status?.textContent).toMatch(/404/);
		expect(mount?.querySelector(".flashcards")).toBeNull();
	});

	it("shows an error when the response isn't a parseable note array", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: true,
				status: 200,
				statusText: "OK",
				text: async () => "not: [valid, note, array",
			})),
		);

		await loadExternalDeck("https://example.com/broken.yaml");

		const status = document.querySelector<HTMLElement>(".hub-external-status");
		expect(status?.hidden).toBe(false);
	});

	it("shows a specific message when nothing in the payload parses as a note", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: true,
				status: 200,
				statusText: "OK",
				text: async () => toYaml([{ not: "a note" }]),
			})),
		);

		await loadExternalDeck("https://example.com/empty.yaml");

		const status = document.querySelector<HTMLElement>(".hub-external-status");
		expect(status?.hidden).toBe(false);
		expect(status?.textContent).toMatch(/no valid notes/i);
	});

	it("clears a previous mount before loading again", async () => {
		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({
				ok: true,
				status: 200,
				statusText: "OK",
				text: async () => toYaml([GOOD_NOTE]),
			})),
		);
		await loadExternalDeck("https://example.com/deck.yaml");

		vi.stubGlobal(
			"fetch",
			vi.fn(async () => ({ ok: false, status: 500, statusText: "Boom" })),
		);
		await loadExternalDeck("https://example.com/deck-2.yaml");

		const mount = document.querySelector<HTMLElement>(".hub-external-mount");
		expect(mount?.querySelector(".flashcards")).toBeNull();
	});
});
