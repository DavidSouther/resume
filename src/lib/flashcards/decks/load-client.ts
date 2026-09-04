// Browser-only deck loader — used by components/flashcards/client.ts. Never
// import this from page.ts: at SSG build time there's no page to `fetch`
// against yet. load-server.ts is the Node-side counterpart, reading the same
// same-origin path off disk instead of over the network.

import { parse as parseYaml } from "yaml";
import { DECK_MANIFEST, type DeckSource } from "./manifest.ts";
import { parseDeckNotes } from "./validate.ts";

async function loadDeckNotes(url: string) {
	const res = await fetch(url);
	if (!res.ok) {
		throw new Error(
			`Failed to load deck "${url}": ${res.status} ${res.statusText}`,
		);
	}
	return parseDeckNotes(parseYaml(await res.text()), url);
}

export async function loadAllDecks(): Promise<DeckSource[]> {
	return Promise.all(
		DECK_MANIFEST.map(async (d) => ({
			slug: d.slug,
			title: d.title,
			notes: await loadDeckNotes(d.url),
		})),
	);
}
