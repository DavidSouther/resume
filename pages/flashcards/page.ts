import { style } from "@davidsouther/jiffies/dom/html.ts";
import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
import { buildFlashcardsApp } from "../../src/components/flashcards/app.ts";
import { FLASHCARDS_CSS } from "../../src/components/flashcards/css.ts";
import { loadAllDecks } from "../../src/lib/flashcards/decks/load-server.ts";
import { cardsForNotes } from "../../src/lib/flashcards/models.ts";
import { pageHead } from "../../src/lib/page-head.ts";

export default {
	head: () => [
		...pageHead("Rust Cheat Sheet Flashcards"),
		style({}, FLASHCARDS_CSS),
	],
	default: async () => {
		const decks = await loadAllDecks();
		return buildFlashcardsApp(cardsForNotes(decks.flatMap((d) => d.notes)));
	},
	clientModules: ["/src/components/flashcards/client.ts"],
} satisfies PageModule;
