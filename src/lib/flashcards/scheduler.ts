import {
	DEFAULT_FSRS_PARAMS,
	type FsrsParams,
	type MemoryState,
	nextIntervalDays,
	nextState,
	Rating,
} from "./fsrs.ts";

const DAY_MS = 24 * 60 * 60 * 1000;

/** Per-card scheduling state, persisted independently of the card's content. */
export interface CardProgress {
	/** null until the card's first review. */
	state: MemoryState | null;
	/** Epoch ms this card is next due. 0 for a never-reviewed card — always due. */
	due: number;
	lastReview: number | null;
	reps: number;
	lapses: number;
}

/**
 * A never-studied card is due right away — always, not just "as of the
 * instant this was created" (an epoch-ms `due: Date.now()` would race a
 * caller checking `isDue` against a `now` captured a tick earlier).
 */
export function initialProgress(): CardProgress {
	return { state: null, due: 0, lastReview: null, reps: 0, lapses: 0 };
}

/** Whether a card should appear in today's review queue. */
export function isDue(progress: CardProgress, now: number): boolean {
	return progress.due <= now;
}

/**
 * Applies one grade to a card's progress, returning the next progress. Pure —
 * callers own persistence (see storage.ts).
 *
 * @param seed Passed through to `nextIntervalDays` for deterministic interval
 *   fuzzing — pass something stable per review (e.g. `${cardId}:${reps}`, see
 *   review-session.ts) so re-rendering never reshuffles a due date.
 */
export function review(
	progress: CardProgress,
	grade: Rating,
	now: number,
	params: FsrsParams = DEFAULT_FSRS_PARAMS,
	seed?: string,
): CardProgress {
	const elapsedDays =
		progress.lastReview === null
			? 0
			: Math.max(0, (now - progress.lastReview) / DAY_MS);
	const state = nextState(progress.state, elapsedDays, grade, params);
	const intervalDays = nextIntervalDays(state.stability, params, seed);
	return {
		state,
		due: now + intervalDays * DAY_MS,
		lastReview: now,
		reps: progress.reps + 1,
		lapses: progress.lapses + (grade === Rating.Again ? 1 : 0),
	};
}

/** Days until this card is next due, for display (can be negative if overdue). */
export function daysUntilDue(progress: CardProgress, now: number): number {
	return (progress.due - now) / DAY_MS;
}
