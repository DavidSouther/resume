import { style } from "@davidsouther/jiffies/dom/html.ts";
import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
import { FLASHCARDS_CSS } from "../../src/components/flashcards/css.ts";
import { buildFlashcardsHub } from "../../src/components/flashcards/hub.ts";
import { loadAllDecks } from "../../src/lib/flashcards/decks/load-server.ts";
import { cardsForNotes } from "../../src/lib/flashcards/models.ts";
import { pageHead } from "../../src/lib/page-head.ts";

// The deck picker: one tile per registered deck, linking to its own
// /flashcards/<slug>/ page (see [slug]/page.ts). Studying itself always
// happens scoped to one deck — this page is just the "which one" step.
export default {
	head: () => [
		...pageHead("Flashcards — David Souther"),
		style({}, FLASHCARDS_CSS),
	],
	default: async () => {
		const decks = await loadAllDecks();
		return buildFlashcardsHub(
			decks.map((d) => ({
				slug: d.slug,
				title: d.title,
				cardCount: cardsForNotes(d.notes).length,
			})),
		);
	},
} satisfies PageModule;
