import type { Note } from "../anki-types.ts";

export interface DeckManifestEntry {
	slug: string;
	title: string;
	/**
	 * Same-origin (or absolute, cross-origin CORS permitting) URL to a YAML
	 * array of `Note`s — see decks/README.md. Resolved over the network by
	 * load-client.ts, and straight off disk (as the same relative path under
	 * public/) by load-server.ts at build time.
	 */
	url: string;
}

export interface DeckSource {
	slug: string;
	title: string;
	notes: Note[];
}

/** Every deck this app ships with, by reference — not the data itself. Add a deck by adding an entry here and a YAML file under public/_flashcards/. */
export const DECK_MANIFEST: DeckManifestEntry[] = [
	{
		slug: "rust-cheat-sheet",
		title: "Rust Cheat Sheet",
		url: "/_flashcards/rust-cheat-sheet.yaml",
	},
];
