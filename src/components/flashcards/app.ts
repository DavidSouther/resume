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

	// Switch() wraps the input in its label per the jiffies-css labelled-
	// control pattern and forwards attrs to the <input> itself, so the class
	// client.ts queries for lands on the checkbox, not the wrapping label. It's
	// a switch, not a bare Checkbox, because "Due only" filters the grid the
	// instant it's toggled — no submit, no other options in a group — which is
	// exactly what jiffies-css's switch affordance (and its fully-styled pill
	// track, unlike an unstyled native checkbox) communicates.
	const dueOnly = Switch("Due only", { class: "due-only-checkbox" });

	// Seeded with the true first-visit state, not left empty: a card with no
	// stored progress is due by definition (see scheduler.ts's
	// initialProgress/isDue — a fresh CardProgress has due: 0, which is always
	// <= now), so "every card, all due" is the correct count until client.ts's
	// localStorage-aware applyFilters() runs, not just a placeholder. Leaving
	// this blank server-side and filling it in from JS produced a visible
	// pop-in flash (blank, or a stale "0 of 0", jumping to the real count) on
	// every load; a returning visitor now sees one brief, plausible number
	// settle into their real one instead of an empty-to-full jump.
	const summary = Chip(
		{ variant: "neutral", class: "flashcards-summary" },
		`${cardCount} of ${cardCount} cards · ${cardCount} due`,
	);

	// Two grouped children, not four flat ones: letting flex-wrap reflow each
	// control independently produces a different, unplanned line count at
	// every in-between width (search+deck together, then the switch stranded
	// alone, then the chip stranded alone — three ragged lines instead of a
	// deliberate two). Grouping the filters and the status readout each into
	// one flex item means the toolbar has exactly two wrap candidates, so it
	// only ever resolves to one clean line or two.
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
