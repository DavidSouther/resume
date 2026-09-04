import type { CardTemplate } from "../../lib/flashcards/anki-types.ts";
import { loadAllDecks } from "../../lib/flashcards/decks/load-client.ts";
import { Rating } from "../../lib/flashcards/fsrs.ts";
import { cardsForNotes } from "../../lib/flashcards/models.ts";
import {
	buildQueue,
	intervalPreviews,
	type QueueItem,
	requeue,
} from "../../lib/flashcards/review-session.ts";
import {
	type CardProgress,
	initialProgress,
	isDue,
	review,
} from "../../lib/flashcards/scheduler.ts";
import { createProgressStore } from "../../lib/flashcards/storage.ts";

function all<T extends Element>(sel: string, root: ParentNode = document): T[] {
	return [...root.querySelectorAll<T>(sel)];
}
function one<T extends Element>(sel: string, root: ParentNode = document): T {
	const el = root.querySelector<T>(sel);
	if (!el) throw new Error(`flashcards: missing element "${sel}"`);
	return el;
}

function main(): void {
	// Kicked off immediately but not awaited here: browse mode is fully
	// interactive from server-rendered markup with no need for the deck data
	// itself, so it shouldn't wait on a network round-trip. Review mode does
	// need it and awaits this same promise (see startSession) — by the time
	// someone's read the toolbar and clicked "Start review" it's typically
	// already resolved.
	const decksPromise = loadAllDecks();
	let cardsCache: CardTemplate[] | null = null;
	async function getAllCards(): Promise<CardTemplate[]> {
		if (!cardsCache) {
			const decks = await decksPromise;
			cardsCache = cardsForNotes(decks.flatMap((d) => d.notes));
		}
		return cardsCache;
	}

	const store = createProgressStore(window.localStorage);
	const progressFor = (cardId: string): CardProgress =>
		store.get(cardId) ?? initialProgress();

	// ---------------------------------------------------------------- Mode switch
	// Pure jiffies-css tabs: tabs.css shows the panel adjacent to whichever
	// [role=tab] carries aria-selected="true" — no `hidden` involved (its
	// [hidden] reset is `!important`, which would permanently defeat that).
	// `currentMode` just tracks which panel is live for the keyboard-shortcut
	// gate below; the tab buttons and their aria-selected state are the
	// source of truth for what's actually visible.
	const tabButtons = all<HTMLButtonElement>('[role="tablist"] > [role="tab"]');
	let currentMode: "browse" | "review" = "browse";
	for (const tab of tabButtons) {
		tab.addEventListener("click", () => {
			for (const other of tabButtons) {
				other.setAttribute("aria-selected", String(other === tab));
			}
			currentMode =
				tab.textContent?.trim().toLowerCase() === "review"
					? "review"
					: "browse";
		});
	}

	// ---------------------------------------------------------------- Browse
	const browseView = one<HTMLElement>(".browse-view");
	const tiles = all<HTMLElement>(".flash-tile");
	const tileById = new Map(tiles.map((t) => [t.dataset.cardId, t]));
	const sections = all<HTMLElement>(".browse-section");
	const groups = all<HTMLElement>(".browse-group");
	const searchInput = one<HTMLInputElement>(".flashcards-search");
	const deckSelect = one<HTMLSelectElement>(".flashcards-deck-select");
	const dueOnlyCheckbox = one<HTMLInputElement>(".due-only-checkbox");
	const summary = one<HTMLElement>(".flashcards-summary");

	function refreshDueDots(): void {
		const now = Date.now();
		for (const tile of tiles) {
			const id = tile.dataset.cardId;
			if (id) tile.dataset.due = String(isDue(progressFor(id), now));
		}
	}

	function applyFilters(): void {
		const query = searchInput.value.trim().toLowerCase();
		const deck = deckSelect.value;
		const onlyDue = dueOnlyCheckbox.checked;
		let visible = 0;
		for (const tile of tiles) {
			const show =
				(!query || (tile.dataset.search ?? "").includes(query)) &&
				(!deck || tile.dataset.deck === deck) &&
				(!onlyDue || tile.dataset.due === "true");
			tile.hidden = !show;
			if (show) visible++;
		}
		for (const section of sections) {
			section.hidden = !all<HTMLElement>(".flash-tile", section).some(
				(t) => !t.hidden,
			);
		}
		for (const group of groups) {
			group.hidden = !all<HTMLElement>(".browse-section", group).some(
				(s) => !s.hidden,
			);
		}
		const dueCount = tiles.filter((t) => t.dataset.due === "true").length;
		summary.textContent = `${visible} of ${tiles.length} cards · ${dueCount} due`;
	}

	browseView.addEventListener("click", (e) => {
		const tile = (e.target as HTMLElement).closest<HTMLElement>(".flash-tile");
		if (tile) tile.classList.toggle("flipped");
	});
	browseView.addEventListener("keydown", (e) => {
		if (e.key !== " " && e.key !== "Enter") return;
		const tile = (e.target as HTMLElement).closest<HTMLElement>(".flash-tile");
		if (!tile) return;
		e.preventDefault();
		tile.classList.toggle("flipped");
	});
	searchInput.addEventListener("input", applyFilters);
	deckSelect.addEventListener("change", applyFilters);
	dueOnlyCheckbox.addEventListener("change", applyFilters);

	refreshDueDots();
	applyFilters();

	// ---------------------------------------------------------------- Review
	const reviewDeckSelect = one<HTMLSelectElement>(".review-deck-select");
	const startBtn = one<HTMLButtonElement>(".review-start");
	const session = one<HTMLElement>(".review-session");
	const progressEl = one<HTMLProgressElement>("progress.review-progress");
	const reviewCard = one<HTMLElement>(".review-card");
	// .review-front/.review-back are jiffies-css Cards (see review.ts) — the
	// content goes in the Card's own <main>, not a separate wrapper div.
	const reviewFront = one<HTMLElement>(".review-front main");
	const reviewBack = one<HTMLElement>(".review-back main");
	const gradesEl = one<HTMLElement>(".review-grades");
	const gradeButtons = all<HTMLButtonElement>("button[data-grade]", gradesEl);
	const emptyEl = one<HTMLElement>(".review-empty");
	const doneEl = one<HTMLElement>(".review-done");
	const doneSummary = one<HTMLElement>(".review-done-summary");

	let queue: QueueItem[] = [];
	let sessionDone = 0;

	function isFlipped(): boolean {
		return reviewCard.classList.contains("flipped");
	}

	/**
	 * Field markdown is rendered once, server-side, when a deck's data file is
	 * published (see ../../lib/flashcards/render.ts and decks/README.md) —
	 * not at display time. That's a deliberate constraint, not just an
	 * optimization: this client bundle is plain Rollup-bundled ES modules
	 * with no JSON-import plugin configured (see @davidsouther/jiffies'
	 * ssg/bundle.js), and jiffdown (the renderer) imports a JSON file
	 * internally, so pulling it into the client bundle breaks the build.
	 *
	 * Every card in this deck already has a rendered tile in the browse grid
	 * (browse.ts server-renders the whole deck), so reuse that HTML instead
	 * of re-rendering. A card with no matching tile (e.g. a deck fetched
	 * dynamically that isn't part of this page's browse grid) falls back to
	 * its raw field text — unrendered, but not broken: this deck's fields are
	 * themselves valid HTML, same as Anki fields normally are.
	 */
	function renderedFace(
		cardId: string,
		face: "front" | "back",
		fallback: string,
	): string {
		const tile = tileById.get(cardId);
		const rendered = tile?.querySelector(`.flash-${face} main`)?.innerHTML;
		return rendered ?? fallback;
	}

	function showCurrentCard(): void {
		reviewCard.classList.remove("flipped");
		gradesEl.hidden = true;
		const item = queue[0];
		reviewFront.innerHTML = renderedFace(
			item.card.cardId,
			"front",
			item.card.front,
		);
		reviewBack.innerHTML = renderedFace(
			item.card.cardId,
			"back",
			item.card.back,
		);
		// Recomputed from the live queue rather than a fixed session total: an
		// Again requeues the card (see gradeCurrentCard), which would otherwise
		// overshoot a total fixed at session start.
		progressEl.max = sessionDone + queue.length;
		progressEl.value = sessionDone;
	}

	function revealAnswer(): void {
		if (queue.length === 0 || isFlipped()) return;
		reviewCard.classList.add("flipped");
		const previews = intervalPreviews(queue[0].progress, Date.now());
		for (const btn of gradeButtons) {
			const grade = Number(btn.dataset.grade) as Rating;
			const preview = btn.querySelector(".grade-interval");
			if (preview) preview.textContent = previews[grade];
		}
		gradesEl.hidden = false;
	}

	function gradeCurrentCard(rating: Rating): void {
		if (queue.length === 0 || !isFlipped()) return;
		const item = queue.shift();
		if (!item) return;
		const now = Date.now();
		// Seeded per (card, rep) so re-rendering a review never reshuffles the
		// fuzzed interval it already committed to.
		const seed = `${item.card.cardId}:${item.progress.reps}`;
		const next = {
			card: item.card,
			progress: review(item.progress, rating, now, undefined, seed),
		};
		store.set(item.card.cardId, next.progress);

		const tile = tileById.get(item.card.cardId);
		if (tile) tile.dataset.due = String(isDue(next.progress, now));

		if (rating === Rating.Again) {
			// Again doesn't wait for the long-term due date it just recorded —
			// it resurfaces later this same session (see review-session.ts's
			// `requeue`), matching what a spaced-repetition "Again" means to
			// most users. sessionDone stays put: this card isn't done yet.
			queue = requeue(queue, next);
		} else {
			sessionDone++;
		}
		applyFilters();

		if (queue.length === 0) {
			session.hidden = true;
			doneEl.hidden = false;
			doneSummary.textContent = `Reviewed ${sessionDone} card${sessionDone === 1 ? "" : "s"}.`;
		} else {
			showCurrentCard();
		}
	}

	async function startSession(): Promise<void> {
		const originalLabel = startBtn.textContent;
		startBtn.disabled = true;
		startBtn.textContent = "Loading…";
		let allCards: CardTemplate[];
		try {
			allCards = await getAllCards();
		} catch (err) {
			startBtn.textContent = "Couldn't load deck — retry?";
			startBtn.disabled = false;
			console.error("flashcards: failed to load deck data", err);
			return;
		}
		startBtn.disabled = false;
		startBtn.textContent = originalLabel;

		const scope = reviewDeckSelect.value || undefined;
		queue = buildQueue(allCards, progressFor, Date.now(), scope);
		sessionDone = 0;
		doneEl.hidden = true;
		if (queue.length === 0) {
			emptyEl.hidden = false;
			session.hidden = true;
			return;
		}
		emptyEl.hidden = true;
		session.hidden = false;
		showCurrentCard();
	}

	startBtn.addEventListener("click", startSession);
	reviewCard.addEventListener("click", revealAnswer);

	document.addEventListener("keydown", (e) => {
		if (currentMode !== "review" || session.hidden) return;
		if (
			e.target instanceof HTMLInputElement ||
			e.target instanceof HTMLSelectElement
		)
			return;
		if (e.key === " " || e.key === "Enter") {
			e.preventDefault();
			revealAnswer();
		} else if (!gradesEl.hidden && ["1", "2", "3", "4"].includes(e.key)) {
			gradeCurrentCard(Number(e.key) as Rating);
		}
	});
	for (const btn of gradeButtons) {
		btn.addEventListener("click", () =>
			gradeCurrentCard(Number(btn.dataset.grade) as Rating),
		);
	}
}

if (document.readyState === "loading") {
	document.addEventListener("DOMContentLoaded", main);
} else {
	main();
}
