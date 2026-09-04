import type { CardTemplate } from "./anki-types.ts";
import { DEFAULT_FSRS_PARAMS, type FsrsParams, Rating } from "./fsrs.ts";
import { type CardProgress, isDue, review } from "./scheduler.ts";

export interface QueueItem {
	card: CardTemplate;
	progress: CardProgress;
}

/**
 * Builds today's review queue: cards in scope (all, or one deck) that are
 * due, soonest-overdue first. New cards (no progress yet) sort first since
 * `initialProgress` makes them due immediately.
 */
export function buildQueue(
	cards: CardTemplate[],
	progressFor: (cardId: string) => CardProgress,
	now: number,
	deckScope?: string,
): QueueItem[] {
	return cards
		.filter((c) => !deckScope || c.deckName === deckScope)
		.map((card) => ({ card, progress: progressFor(card.cardId) }))
		.filter(({ progress }) => isDue(progress, now))
		.sort((a, b) => a.progress.due - b.progress.due);
}

/** Human-scale rendering of a day count for the grade-button interval preview. */
export function formatDays(days: number): string {
	if (days < 1) return "<1d";
	if (days < 21) return `${Math.round(days)}d`;
	if (days < 90) return `${Math.round(days / 7)}w`;
	return `${Math.round(days / 30)}mo`;
}

/**
 * What pressing each grade right now would schedule this card's next review
 * as — for the button previews. Again is special-cased to "Soon": grading
 * Again doesn't wait for its (still-recorded, for future sessions) long-term
 * due date — see `requeue` — so showing that day count would be misleading.
 */
export function intervalPreviews(
	progress: CardProgress,
	now: number,
	params: FsrsParams = DEFAULT_FSRS_PARAMS,
): Record<Rating, string> {
	const previews = { [Rating.Again]: "Soon" } as Record<Rating, string>;
	for (const grade of [Rating.Hard, Rating.Good, Rating.Easy] as const) {
		const next = review(progress, grade, now, params);
		previews[grade] = formatDays((next.due - now) / (24 * 60 * 60 * 1000));
	}
	return previews;
}

/**
 * Where to reinsert a just-failed card into the remaining session queue, so
 * it resurfaces again this session rather than only waiting for its
 * long-term due date — a rough echo of Anki's relearning steps (which
 * default to minutes) without a full minute-granularity queue: a roughly
 * constant number of cards later, not a fraction of however long the queue
 * happens to be (100+ cards away is not "soon," whatever the session size).
 * Not immediately next, either — the same card shouldn't repeat back-to-back.
 */
export function requeuePosition(remainingLength: number): number {
	const CARDS_LATER = 8;
	return Math.min(remainingLength, CARDS_LATER);
}

/** Reinserts `item` into `queue` at `requeuePosition`, returning a new array. */
export function requeue(queue: QueueItem[], item: QueueItem): QueueItem[] {
	const next = [...queue];
	next.splice(requeuePosition(next.length), 0, item);
	return next;
}
