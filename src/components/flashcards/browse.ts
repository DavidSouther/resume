import { Card, Panel } from "@davidsouther/jiffies/components/index.ts";
import { div, h2, h3 } from "@davidsouther/jiffies/dom/html.ts";
import type { CardTemplate } from "../../lib/flashcards/anki-types.ts";
import {
	type DeckOutline,
	groupCardsByOutline,
} from "../../lib/flashcards/deck-outline.ts";
import { buildAnnotationControl } from "./annotation-control.ts";
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

/**
 * One flip-on-click tile in the casual browse grid. Flip state and the
 * `data-due`/`data-annotated` dots are wired up by client.ts, which also
 * owns the annotation control's open/save/clear behavior (see
 * annotation-control.ts) — positioned outside `.flash-tile-inner` so it
 * never takes part in the flip transform and stays reachable in either
 * face.
 */
export function buildFlashTile(card: CardTemplate): HTMLDivElement {
	const front = buildFlashFace(card.front, "front");
	const back = buildFlashFace(card.back, "back");

	const inner = div({ class: "flash-tile-inner" }, front, back);
	const annotationControl = buildAnnotationControl("📝");
	annotationControl.classList.add("flash-tile-annotation");
	const searchIndex =
		`${stripHtml(card.front)} ${stripHtml(card.back)} ${card.tags.join(" ")}`.toLowerCase();

	const tile = div(
		{ class: "flash-tile", role: "button" },
		inner,
		annotationControl,
	);
	// tabIndex/aria-label set directly: the attrs shorthand can't express a
	// literal 0 (falsy inputs are treated as "remove this attribute") or a
	// hyphenated attribute name (no camelCase-to-kebab conversion).
	tile.tabIndex = 0;
	tile.setAttribute("aria-label", "Flip card");
	tile.dataset.cardId = card.cardId;
	tile.dataset.deck = card.deckName;
	tile.dataset.search = searchIndex;
	tile.dataset.due = "true";
	tile.dataset.annotated = "false";
	return tile;
}

/**
 * The full casual/browse view: every card, grouped and headed per `outline`
 * (see deck-outline.ts). Each top-level group is a jiffies-css flat Panel
 * (`<section> > header / main`) — a plain grouping surface, one notch
 * flatter than the elevated Cards inside it.
 */
export function buildBrowseView(
	outline: DeckOutline,
	cards: CardTemplate[],
): HTMLDivElement {
	const bySection = groupCardsByOutline(outline, cards);
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
