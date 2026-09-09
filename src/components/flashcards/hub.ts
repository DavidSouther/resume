import { Card, Chip } from "@davidsouther/jiffies/components/index.ts";
import { a, div, h2, p } from "@davidsouther/jiffies/dom/html.ts";

export interface HubDeck {
	slug: string;
	title: string;
	cardCount: number;
}

/**
 * One deck's tile on the /flashcards/ picker: the whole tile is a link to
 * /flashcards/<slug>/ (a static page — see pages/flashcards/[slug]/), not a
 * button with a client-side handler, so it's a plain crawlable/bookmarkable
 * anchor with no JS required to navigate.
 */
function buildDeckTile(deck: HubDeck): HTMLElement {
	const link = a({ href: `/flashcards/${deck.slug}/`, class: "hub-deck-link" });
	link.append(
		Card(
			{ class: "hub-deck-card" },
			h2({}, deck.title),
			p({}, Chip({ variant: "neutral" }, `${deck.cardCount} cards`)),
		),
	);
	return link;
}

/**
 * The /flashcards/ deck picker: one tile per registered deck (see
 * decks/manifest.ts), each linking to its own Browse/Review page. This is
 * the entry point for "which cheat sheet do I want to study" — studying
 * itself always happens scoped to one deck (see app.ts's buildFlashcardsApp).
 */
export function buildFlashcardsHub(decks: HubDeck[]): HTMLDivElement {
	const grid = div(
		{ class: "hub-grid" },
		...decks.map((d) => buildDeckTile(d)),
	);
	const view = div(
		{ class: "hub-view" },
		p({ class: "hub-intro" }, "Pick a cheat sheet to browse or review."),
		grid,
	);
	view.setAttribute("role", "region");
	view.setAttribute("aria-label", "Cheat sheets");
	return view;
}
