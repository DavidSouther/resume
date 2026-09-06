import { Card, Panel } from "@davidsouther/jiffies/components/index.ts";
import { div, h2, h3 } from "@davidsouther/jiffies/dom/html.ts";
import type { CardTemplate } from "../../lib/flashcards/anki-types.ts";
import { groupCardsByOutline } from "../../lib/flashcards/deck-outline.ts";
import { stripHtml } from "./html-text.ts";

/**
 * One face (front or back) of a flip tile: a jiffies-css elevated Card
 * supplies the surface (background, border, shadow, padding — see
 * css.ts, which only adds the flip positioning on top of it, not the
 * surface look itself). Content is written straight into the Card's own
 * `<main>` rather than nested in another wrapper, so there's exactly one
 * `<main>` here — nesting a second `<main>` inside it would be invalid.
 */
function buildFlashFace(html: string, face: "front" | "back"): HTMLElement {
	const card = Card({ class: `flash-face flash-${face}` });
	const main = card.querySelector("main");
	if (main) main.innerHTML = html;
	return card;
}

/** One flip-on-click tile in the casual browse grid. Flip state and the `data-due` dot are wired up by client.ts. */
export function buildFlashTile(card: CardTemplate): HTMLDivElement {
	const front = buildFlashFace(card.front, "front");
	const back = buildFlashFace(card.back, "back");

	const inner = div({ class: "flash-tile-inner" }, front, back);
	const searchIndex =
		`${stripHtml(card.front)} ${stripHtml(card.back)} ${card.tags.join(" ")}`.toLowerCase();

	const tile = div({ class: "flash-tile", role: "button" }, inner);
	// tabIndex/aria-label set directly: the attrs shorthand can't express a
	// literal 0 (falsy inputs are treated as "remove this attribute") or a
	// hyphenated attribute name (no camelCase-to-kebab conversion).
	tile.tabIndex = 0;
	tile.setAttribute("aria-label", "Flip card");
	tile.dataset.cardId = card.cardId;
	tile.dataset.deck = card.deckName;
	tile.dataset.search = searchIndex;
	// Seeded "due", not left unset: a card with no stored progress IS due
	// (scheduler.ts's initialProgress/isDue — a fresh CardProgress's due: 0 is
	// always <= now), so this is the correct first-visit state, not a
	// placeholder. client.ts's refreshDueDots() overwrites it against real
	// localStorage progress once it runs; seeding it here means the dot is
	// already right for a first-time visitor instead of popping in after
	// load, matching the toolbar summary's same fix.
	tile.dataset.due = "true";
	return tile;
}

/**
 * The full casual/browse view: every card, grouped and headed per the fixed
 * deck outline. Each top-level group is a jiffies-css flat Panel (`<section>
 * > header / main`) — a plain grouping surface, one notch flatter than the
 * elevated Cards inside it.
 */
export function buildBrowseView(cards: CardTemplate[]): HTMLDivElement {
	const bySection = groupCardsByOutline(cards);
	const groups = new Map<string, HTMLElement[]>();
	for (const {
		group,
		section: sectionName,
		deckName,
		cards: sectionCards,
	} of bySection) {
		const grid = div(
			{ class: "card-grid" },
			...sectionCards.map((c) => buildFlashTile(c)),
		);
		const sectionEl = div(
			{ class: "browse-section" },
			h3({}, sectionName),
			grid,
		);
		sectionEl.dataset.deck = deckName;
		const list = groups.get(group) ?? [];
		list.push(sectionEl);
		groups.set(group, list);
	}

	const groupEls = [...groups.entries()].map(([group, sections]) =>
		Panel({ class: "browse-group", header: h2({}, group) }, ...sections),
	);

	const view = div({ class: "browse-view" }, ...groupEls);
	view.setAttribute("role", "region");
	view.setAttribute("aria-label", "Browse cards");
	return view;
}
