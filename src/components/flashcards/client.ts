import { loadDeck } from "../../lib/flashcards/decks/load-client.ts";
import { mountApp } from "./app-runtime.ts";

// Used on every /flashcards/<slug>/ page (see pages/flashcards/[slug]/) —
// the deck is already server-rendered, so this just resolves which manifest
// entry it is and wires up interactivity (see app-runtime.ts's mountApp).
// hub-client.ts is the other mountApp caller, for a "bring your own URL"
// deck that has no server-rendered markup to find here.
function main(): void {
	const el = document.querySelector<HTMLElement>(".flashcards[data-deck-slug]");
	if (!el) return;
	const slug = el.dataset.deckSlug as string;
	mountApp(slug, () => loadDeck(slug));
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", main);
} else {
	main();
}
