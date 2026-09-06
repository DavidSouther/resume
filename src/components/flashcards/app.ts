import { Chip } from "@davidsouther/jiffies/components/index.ts";
import { Switch } from "@davidsouther/jiffies/dom/form/form.ts";
import { button, div, input } from "@davidsouther/jiffies/dom/html.ts";
import type { CardTemplate } from "../../lib/flashcards/anki-types.ts";
import { buildBrowseView } from "./browse.ts";
import { buildDeckSelect } from "./deck-select.ts";
import { buildReviewView } from "./review.ts";

/**
 * The Browse/Review tab strip. Hand-built rather than via jiffies'
 * `TabList`/`StaticTabList` helpers: tabs.css shows a tabpanel by matching
 * `[role="tab"][aria-selected="true"] + [role="tabpanel"]`, and a bare
 * `button[role=tab][aria-selected]` (the "JS tabs" shape from the
 * jiffies-css-semantic-html skill) satisfies that directly — no radio/label
 * nesting to get exactly right. client.ts flips `aria-selected` on click;
 * the CSS (not a `hidden` attribute — see below) does the rest.
 */
function buildTab(label: string, selected: boolean): HTMLButtonElement {
	const tab = button({ type: "button" }, label);
	tab.setAttribute("role", "tab");
	tab.setAttribute("aria-selected", String(selected));
	return tab;
}

function buildToolbar(cardCount: number): HTMLDivElement {
	const search = input({
		class: "flashcards-search",
		type: "search",
		placeholder: "Search cards…",
	});
	search.setAttribute("aria-label", "Search cards");

	const dueOnly = Switch("Due only", { class: "due-only-checkbox" });

	const summary = Chip(
		{ variant: "neutral", class: "flashcards-summary" },
		`${cardCount} of ${cardCount} cards · ${cardCount} due`,
	);

	const filters = div(
		{ class: "flashcards-filters flex row" },
		search,
		buildDeckSelect("flashcards-deck-select", "All decks"),
	);
	const status = div(
		{ class: "flashcards-status flex row align-center" },
		dueOnly,
		summary,
	);

	return div(
		{ class: "flashcards-toolbar flex row align-center" },
		filters,
		status,
	);
}

/**
 * Builds the whole /flashcards page body: a Browse/Review tab strip, each
 * tab's panel holding that mode's content (Browse: toolbar + the
 * server-rendered casual grid; Review: the review panel shell).
 */
export function buildFlashcardsApp(cards: CardTemplate[]): HTMLDivElement {
	const browseTab = buildTab("Browse", true);
	const reviewTab = buildTab("Review", false);

	const browsePanel = div(
		{ class: "browse-panel" },
		buildToolbar(cards.length),
		buildBrowseView(cards),
	);
	browsePanel.setAttribute("role", "tabpanel");

	const reviewPanel = buildReviewView();
	reviewPanel.setAttribute("role", "tabpanel");

	const tablist = div(
		{ class: "flashcards-tablist" },
		browseTab,
		browsePanel,
		reviewTab,
		reviewPanel,
	);
	tablist.setAttribute("role", "tablist");

	return div({ class: "flashcards" }, tablist);
}
