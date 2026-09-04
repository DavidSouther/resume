// Node-only deck loader — used by pages/flashcards/page.ts at SSG build
// time. Never import this from client.ts: it uses jiffies' Node filesystem
// adapter, which the browser's Rollup bundle (see bundle.js in
// @davidsouther/jiffies) can't resolve. load-client.ts is the browser-side
// counterpart, fetching the same same-origin path over the network instead
// of reading it off disk.

import { NodeFileSystem } from "@davidsouther/jiffies/fs_node.ts";
import { parse as parseYaml } from "yaml";
import { DECK_MANIFEST, type DeckSource } from "./manifest.ts";
import { parseDeckNotes } from "./validate.ts";

// Rooted at the repo's cwd (the build always runs from there), so a deck's
// `url` — same leading-"/" form the browser fetches (see load-client.ts) —
// just needs "public" prefixed to become the on-disk path.
const fs = new NodeFileSystem();

async function loadDeckNotes(url: string) {
	// The build has the file locally under public/ anyway, so read it
	// directly instead of a loopback network round-trip.
	const raw = await fs.readFile(`public${url}`);
	return parseDeckNotes(parseYaml(raw), url);
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
