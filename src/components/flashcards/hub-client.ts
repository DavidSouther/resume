import { parse as parseYaml } from "yaml";
import type { Note } from "../../lib/flashcards/anki-types.ts";
import type { DeckSource } from "../../lib/flashcards/decks/manifest.ts";
import { parseDeckNotes } from "../../lib/flashcards/decks/parse.ts";
import { cardsForNotes } from "../../lib/flashcards/models.ts";
import { buildFlashcardsApp } from "./app.ts";
import { mountApp } from "./app-runtime.ts";

/**
 * The picker's "bring your own deck" (see hub.ts) has no idea what a
 * pasted-in deck is actually called — its notes carry a deckName like
 * "Some Deck::Section", same shape as any registered deck's, so the root
 * segment (everything before the first "::") stands in for a title.
 */
export function titleFrom(notes: Note[]): string {
	return notes[0]?.deckName.split("::")[0] ?? "External deck";
}

/**
 * Fetches, parses, and mounts the deck at `url` into `.hub-external-mount`
 * — the client-side counterpart to a /flashcards/<slug>/ page for a deck
 * that was never in DECK_MANIFEST and never will be (see hub.ts's doc
 * comment on why this can't be a real static route). Reuses the exact same
 * builder (app.ts's buildFlashcardsApp) and the exact same interactivity
 * (app-runtime.ts's mountApp) as every registered deck's page — an external
 * deck is a first-class deck once it's loaded, not a lesser preview of one.
 */
export async function loadExternalDeck(url: string): Promise<void> {
	const status = document.querySelector<HTMLElement>(".hub-external-status");
	const mount = document.querySelector<HTMLElement>(".hub-external-mount");
	if (!status || !mount) return;
	status.hidden = true;
	mount.replaceChildren();

	let notes: Note[];
	try {
		const res = await fetch(url);
		if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
		notes = parseDeckNotes(parseYaml(await res.text()), url);
	} catch (err) {
		status.hidden = false;
		status.textContent = `Couldn't load that deck: ${(err as Error).message}`;
		return;
	}
	if (notes.length === 0) {
		status.hidden = false;
		status.textContent =
			"No valid notes found at that URL — see “Where to find decks” below for the expected shape.";
		return;
	}

	// A slug this deck's local progress/annotations can be namespaced under
	// (see app-runtime.ts's mountApp) — the URL itself, since nothing else
	// uniquely and stably identifies a deck nobody registered.
	const slug = `external:${url}`;
	const title = titleFrom(notes);
	const deck: DeckSource = { slug, title, notes };

	let cards: ReturnType<typeof cardsForNotes>;
	try {
		cards = cardsForNotes(notes);
	} catch (err) {
		status.hidden = false;
		status.textContent = `Couldn't derive cards from that deck: ${(err as Error).message}`;
		return;
	}

	mount.appendChild(
		buildFlashcardsApp({ slug, title }, cards, { showBackLink: false }),
	);
	mountApp(slug, async () => deck);
}

function main(): void {
	const url = new URLSearchParams(location.search).get("deck");
	if (!url) return;
	const urlInput =
		document.querySelector<HTMLInputElement>(".hub-external-url");
	if (urlInput) urlInput.value = url;
	loadExternalDeck(url);
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", main);
} else {
	main();
}
