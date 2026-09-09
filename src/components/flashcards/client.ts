import type { CardTemplate } from "../../lib/flashcards/anki-types.ts";
import {
	type AnnotationStore,
	type CardAnnotation,
	createAnnotationStore,
} from "../../lib/flashcards/annotations.ts";
import { loadDeck } from "../../lib/flashcards/decks/load-client.ts";
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

/**
 * Wires one `.annotation-control` (see annotation-control.ts) to
 * `annotationStore`: toggling open/closed, saving/clearing a note, and
 * reflecting the current card's annotated state. `getCardId` is a thunk
 * rather than a fixed id because the review panel has exactly one control
 * instance retargeted at whichever card is currently showing (browse tiles
 * just close over their own fixed id). `onChange` lets each caller update
 * whatever else depends on the annotation — a tile's `data-annotated` dot,
 * the browse summary count, the review-back note display.
 */
function wireAnnotationControl(
	control: HTMLElement,
	annotationStore: AnnotationStore,
	getCardId: () => string | undefined,
	onChange: (cardId: string, annotation: CardAnnotation | undefined) => void,
): { refresh: () => void; close: () => void; open: () => void } {
	const toggleBtn = one<HTMLButtonElement>(".annotation-toggle", control);
	const form = one<HTMLElement>(".annotation-form", control);
	const noteInput = one<HTMLTextAreaElement>(".annotation-note", control);
	const saveBtn = one<HTMLButtonElement>(".annotation-save", control);
	const clearBtn = one<HTMLButtonElement>(".annotation-clear", control);
	const cancelBtn = one<HTMLButtonElement>(".annotation-cancel", control);

	function refresh(): void {
		const cardId = getCardId();
		const annotation = cardId ? annotationStore.get(cardId) : undefined;
		control.classList.toggle("annotated", annotation !== undefined);
		noteInput.value = annotation?.note ?? "";
		clearBtn.hidden = annotation === undefined;
	}
	function close(): void {
		form.hidden = true;
	}
	function open(): void {
		refresh();
		form.hidden = false;
		noteInput.focus();
	}

	toggleBtn.addEventListener("click", () => (form.hidden ? open() : close()));
	saveBtn.addEventListener("click", () => {
		const cardId = getCardId();
		const note = noteInput.value.trim();
		if (!cardId || !note) return;
		const annotation: CardAnnotation = { note, annotatedAt: Date.now() };
		annotationStore.set(cardId, annotation);
		close();
		refresh();
		onChange(cardId, annotation);
	});
	clearBtn.addEventListener("click", () => {
		const cardId = getCardId();
		if (!cardId) return;
		annotationStore.reset(cardId);
		close();
		refresh();
		onChange(cardId, undefined);
	});
	cancelBtn.addEventListener("click", () => {
		close();
		refresh();
	});

	refresh();
	return { refresh, close, open };
}

function main(): void {
	// One deck per page (see app.ts) — the slug is stamped onto the root
	// element server-side so this bundle, shared across every /flashcards/
	// <slug>/ page, knows which deck it's for without a build-time param.
	const slug = one<HTMLElement>(".flashcards").dataset.deckSlug;
	if (!slug) throw new Error("flashcards: root element missing data-deck-slug");

	// Kicked off immediately but not awaited here: browse mode is fully
	// interactive from server-rendered markup with no need for the deck data
	// itself, so it shouldn't wait on a network round-trip. Review mode does
	// need it and awaits this same promise (see startSession) — by the time
	// someone's read the toolbar and clicked "Start review" it's typically
	// already resolved.
	const deckPromise = loadDeck(slug);
	let cardsCache: CardTemplate[] | null = null;
	async function getAllCards(): Promise<CardTemplate[]> {
		if (!cardsCache) {
			const deck = await deckPromise;
			cardsCache = cardsForNotes(deck.notes);
		}
		return cardsCache;
	}

	// Namespaced per deck: cards from different decks never collide (noteIds
	// are deck-prefixed already), but keeping progress/annotations under
	// separate keys per deck means "reset this deck" or inspecting one
	// deck's storage blob stays simple as more decks ship.
	const store = createProgressStore(
		window.localStorage,
		`flashcards:progress:v1:${slug}`,
	);
	const progressFor = (cardId: string): CardProgress =>
		store.get(cardId) ?? initialProgress();
	const annotationStore = createAnnotationStore(
		window.localStorage,
		`flashcards:annotations:v1:${slug}`,
	);

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
	const annotatedOnlyCheckbox = one<HTMLInputElement>(
		".annotated-only-checkbox",
	);
	const summary = one<HTMLElement>(".flashcards-summary");

	function refreshDueDots(): void {
		const now = Date.now();
		for (const tile of tiles) {
			const id = tile.dataset.cardId;
			if (id) tile.dataset.due = String(isDue(progressFor(id), now));
		}
	}

	function refreshAnnotationDots(): void {
		for (const tile of tiles) {
			const id = tile.dataset.cardId;
			tile.dataset.annotated = String(
				!!id && annotationStore.get(id) !== undefined,
			);
		}
	}

	function applyFilters(): void {
		const query = searchInput.value.trim().toLowerCase();
		const deck = deckSelect.value;
		const onlyDue = dueOnlyCheckbox.checked;
		const onlyAnnotated = annotatedOnlyCheckbox.checked;
		let visible = 0;
		for (const tile of tiles) {
			const show =
				(!query || (tile.dataset.search ?? "").includes(query)) &&
				(!deck || tile.dataset.deck === deck) &&
				(!onlyDue || tile.dataset.due === "true") &&
				(!onlyAnnotated || tile.dataset.annotated === "true");
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

	// Every tile carries its own annotation control (see browse.ts) — clicks
	// and space/enter keydowns inside it must not also flip the tile
	// underneath.
	browseView.addEventListener("click", (e) => {
		const target = e.target as HTMLElement;
		if (target.closest(".annotation-control")) return;
		const tile = target.closest<HTMLElement>(".flash-tile");
		if (tile) tile.classList.toggle("flipped");
	});
	browseView.addEventListener("keydown", (e) => {
		if (e.key !== " " && e.key !== "Enter") return;
		const target = e.target as HTMLElement;
		if (target.closest(".annotation-control")) return;
		const tile = target.closest<HTMLElement>(".flash-tile");
		if (!tile) return;
		e.preventDefault();
		tile.classList.toggle("flipped");
	});
	searchInput.addEventListener("input", applyFilters);
	deckSelect.addEventListener("change", applyFilters);
	dueOnlyCheckbox.addEventListener("change", applyFilters);
	annotatedOnlyCheckbox.addEventListener("change", applyFilters);

	for (const tile of tiles) {
		const control = tile.querySelector<HTMLElement>(".annotation-control");
		const cardId = tile.dataset.cardId;
		if (!control || !cardId) continue;
		wireAnnotationControl(
			control,
			annotationStore,
			() => cardId,
			(_id, annotation) => {
				tile.dataset.annotated = String(annotation !== undefined);
				applyFilters();
			},
		);
	}

	refreshDueDots();
	refreshAnnotationDots();
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
	// Lives in the back Card's footer (see review.ts's buildReviewFace), not
	// its <main> — showCurrentCard() replaces reviewBack's innerHTML on every
	// card, which would otherwise wipe this out along with the card content.
	const reviewAnnotationNoteEl = one<HTMLElement>(".review-annotation-note");

	let queue: QueueItem[] = [];
	let sessionDone = 0;

	function isFlipped(): boolean {
		return reviewCard.classList.contains("flipped");
	}

	function currentCardId(): string | undefined {
		return queue[0]?.card.cardId;
	}

	function updateAnnotationNote(): void {
		const cardId = currentCardId();
		const annotation = cardId ? annotationStore.get(cardId) : undefined;
		reviewAnnotationNoteEl.hidden = annotation === undefined;
		reviewAnnotationNoteEl.textContent = annotation
			? `📝 Annotated: ${annotation.note}`
			: "";
	}

	// The one review-panel annotation control (see review.ts), retargeted at
	// whichever card is current via currentCardId() rather than a fixed id.
	const reviewAnnotationControl = one<HTMLElement>(
		".review-grades .annotation-control",
	);
	const reviewAnnotation = wireAnnotationControl(
		reviewAnnotationControl,
		annotationStore,
		currentCardId,
		(cardId, annotation) => {
			const tile = tileById.get(cardId);
			if (tile) tile.dataset.annotated = String(annotation !== undefined);
			applyFilters();
			updateAnnotationNote();
		},
	);

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

		reviewAnnotation.close();
		reviewAnnotation.refresh();
		updateAnnotationNote();
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
		} else if (!gradesEl.hidden && e.key === "5") {
			reviewAnnotation.open();
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
