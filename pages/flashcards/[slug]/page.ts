import { style } from "@davidsouther/jiffies/dom/html.ts";
import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
import { buildFlashcardsApp } from "../../../src/components/flashcards/app.ts";
import { FLASHCARDS_CSS } from "../../../src/components/flashcards/css.ts";
import { loadDeck } from "../../../src/lib/flashcards/decks/load-server.ts";
import { DECK_MANIFEST } from "../../../src/lib/flashcards/decks/manifest.ts";
import { cardsForNotes } from "../../../src/lib/flashcards/models.ts";
import { pageHead } from "../../../src/lib/page-head.ts";

// One page per registered deck (see decks/manifest.ts) — Browse/Review
// scoped to that deck's own cards only, never several decks merged. Adding
// a deck to the manifest is enough to get it a page here; nothing in this
// file names any deck specifically.
export default {
	generateStaticParams: async () =>
		DECK_MANIFEST.map((d) => ({ slug: d.slug })),
	head: async (params) => {
		const deck = await loadDeck(params?.slug ?? "");
		return [...pageHead(`${deck.title} Flashcards`), style({}, FLASHCARDS_CSS)];
	},
	default: async (params) => {
		const deck = await loadDeck(params?.slug ?? "");
		return buildFlashcardsApp(deck, cardsForNotes(deck.notes));
	},
	clientModules: ["/src/components/flashcards/client.ts"],
} satisfies PageModule;
