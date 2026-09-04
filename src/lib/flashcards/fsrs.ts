// A compact port of the FSRS-6 scheduling algorithm (Free Spaced Repetition
// Scheduler — the algorithm Anki now ships as its default scheduler,
// superseding SM-2). Ported by hand from the reference TypeScript
// implementation (github.com/open-spaced-repetition/ts-fsrs, MIT licensed) to
// avoid a runtime dependency in a project with no client-side bundler — pages
// here ship browser code as plain ES modules (see src/lib/page-head.ts), so a
// bare `import` of an npm package wouldn't resolve in the browser anyway.
//
// Deliberate simplification versus full Anki/ts-fsrs:
//  - No sub-day "learning steps" *queue* (Anki's configurable minute-ladder
//    of relearning steps before a card graduates to day-granularity
//    scheduling). What that queue exists to do — make a failed or new card
//    resurface again soon, this session, rather than only "tomorrow" — is
//    still very much in scope; FSRS's own short-term stability formula
//    (`enableShortTerm`, the `elapsedDays === 0` branch below) is exactly
//    what a same-day re-review is scored against. The re-queuing itself
//    lives one layer up, in review-session.ts, which puts a just-failed card
//    back into the current session's queue instead of only trusting the
//    long-term due date.
//
// Interval fuzzing (Anki randomizes an interval +/- a few percent so cards
// reviewed together don't all clump onto the same future day) is
// implemented below, seeded per review so a re-render never reshuffles a
// card's due date — see `applyFuzz`.
//
// Formulas and default weights verified against ts-fsrs's own test fixtures —
// see fsrs.test.ts, which reproduces github.com/open-spaced-repetition/ts-fsrs
// packages/fsrs/__tests__/FSRS-6.test.ts's "memory state" cases exactly.

/** Anki's four review grades. */
export const Rating = {
	Again: 1,
	Hard: 2,
	Good: 3,
	Easy: 4,
} as const;
export type Rating = (typeof Rating)[keyof typeof Rating];

/** The two numbers FSRS tracks per card between reviews. */
export interface MemoryState {
	/** Perceived difficulty of the card, in [1, 10]. */
	difficulty: number;
	/** Stability: days until recall probability decays to the request retention. */
	stability: number;
}

export interface FsrsParams {
	/** Target recall probability a scheduled interval should hit, in (0, 1]. */
	requestRetention: number;
	/** Hard cap on any scheduled interval, in days. */
	maximumInterval: number;
	/** The 21 FSRS-6 model weights (w0..w20). */
	w: readonly number[];
	/** Whether same-day re-reviews use the short-term stability formula. */
	enableShortTerm: boolean;
	/** Whether `nextIntervalDays` randomizes the interval (given a seed) so same-cohort cards don't all land on the same day. */
	enableFuzz: boolean;
}

/** FSRS-6 default weights, trained by the open-spaced-repetition project. */
export const DEFAULT_FSRS_PARAMS: FsrsParams = {
	requestRetention: 0.9,
	maximumInterval: 36500,
	enableShortTerm: true,
	enableFuzz: true,
	w: [
		0.212, 1.2931, 2.3065, 8.2956, 6.4133, 0.8334, 3.0194, 0.001, 1.8722,
		0.1666, 0.796, 1.4835, 0.0614, 0.2629, 1.6483, 0.6014, 1.8729, 0.5425,
		0.0912, 0.0658, 0.1542,
	],
};

const S_MIN = 0.001;
const S_MAX = 36500.0;

function clamp(value: number, min: number, max: number): number {
	return Math.min(Math.max(value, min), max);
}

function roundTo(value: number, digits: number): number {
	const factor = 10 ** digits;
	return Math.round(value * factor) / factor;
}

/**
 * FSRS-6 folds retention decay into a per-user weight (w20) instead of a
 * fixed constant. decay = -w20; factor makes R(9*S, S) == 0.9 exactly.
 */
function decayFactor(w: readonly number[]): { decay: number; factor: number } {
	const decay = -w[20];
	const factor = Math.exp(decay ** -1 * Math.log(0.9)) - 1.0;
	return { decay, factor: roundTo(factor, 8) };
}

/**
 * Retrievability: probability of recall after `elapsedDays` since a card had
 * stability `stability`. R(t, S) = (1 + FACTOR * t / S) ^ DECAY.
 */
export function retrievability(
	elapsedDays: number,
	stability: number,
	params: FsrsParams = DEFAULT_FSRS_PARAMS,
): number {
	const { decay, factor } = decayFactor(params.w);
	return roundTo((1 + (factor * elapsedDays) / stability) ** decay, 8);
}

/** How many days until retrievability decays to `params.requestRetention`. */
function intervalModifier(params: FsrsParams): number {
	const { decay, factor } = decayFactor(params.w);
	return roundTo((params.requestRetention ** (1 / decay) - 1) / factor, 8);
}

/** S_0(G) = w[G-1], floored at S_MIN. */
function initStability(grade: Rating, w: readonly number[]): number {
	return Math.max(w[grade - 1], S_MIN);
}

/**
 * D_0(G) = w4 - e^((G-1)*w5) + 1, unclamped. Used as the mean-reversion
 * anchor inside `nextDifficulty` — which needs the *raw* value (it can run
 * well below 1 for Easy) — as well as, clamped, to seed a new card's
 * difficulty. Keep both call sites sharing this one raw formula.
 */
function rawInitDifficulty(grade: Rating, w: readonly number[]): number {
	return roundTo(w[4] - Math.exp((grade - 1) * w[5]) + 1, 8);
}

/** D_0(G) clamped to the [1, 10] difficulty range — for seeding a new card. */
function initDifficulty(grade: Rating, w: readonly number[]): number {
	return clamp(rawInitDifficulty(grade, w), 1, 10);
}

function linearDamping(deltaD: number, oldD: number): number {
	return roundTo((deltaD * (10 - oldD)) / 9, 8);
}

function meanReversion(
	init: number,
	current: number,
	w: readonly number[],
): number {
	return roundTo(w[7] * init + (1 - w[7]) * current, 8);
}

/** D' = mean-reversion of D0(Easy) and (D + linear-damped delta), clamped to [1, 10]. */
function nextDifficulty(
	difficulty: number,
	grade: Rating,
	w: readonly number[],
): number {
	const deltaD = -w[6] * (grade - 3);
	const nextD = difficulty + linearDamping(deltaD, difficulty);
	return clamp(
		meanReversion(rawInitDifficulty(Rating.Easy, w), nextD, w),
		1,
		10,
	);
}

/** Stability update after a successful recall (Hard/Good/Easy). */
function nextRecallStability(
	difficulty: number,
	stability: number,
	r: number,
	grade: Rating,
	w: readonly number[],
): number {
	const hardPenalty = grade === Rating.Hard ? w[15] : 1;
	const easyBonus = grade === Rating.Easy ? w[16] : 1;
	return roundTo(
		clamp(
			stability *
				(1 +
					Math.exp(w[8]) *
						(11 - difficulty) *
						stability ** -w[9] *
						(Math.exp((1 - r) * w[10]) - 1) *
						hardPenalty *
						easyBonus),
			S_MIN,
			S_MAX,
		),
		8,
	);
}

/** Stability update after a lapse (Again). */
function nextForgetStability(
	difficulty: number,
	stability: number,
	r: number,
	w: readonly number[],
): number {
	return roundTo(
		clamp(
			w[11] *
				difficulty ** -w[12] *
				((stability + 1) ** w[13] - 1) *
				Math.exp((1 - r) * w[14]),
			S_MIN,
			S_MAX,
		),
		8,
	);
}

/** Stability update for a same-day (elapsed_days === 0) re-review. */
function nextShortTermStability(
	stability: number,
	grade: Rating,
	w: readonly number[],
): number {
	const sinc = stability ** -w[19] * Math.exp(w[17] * (grade - 3 + w[18]));
	const maskedSinc = grade >= Rating.Hard ? Math.max(sinc, 1.0) : sinc;
	return roundTo(clamp(stability * maskedSinc, S_MIN, S_MAX), 8);
}

/**
 * Advance memory state by one review.
 *
 * @param state Current memory state, or `null` for a card never reviewed.
 * @param elapsedDays Days since the card was last reviewed (0 for a new card,
 *   or for a same-day re-review).
 * @param grade The rating given this review.
 */
export function nextState(
	state: MemoryState | null,
	elapsedDays: number,
	grade: Rating,
	params: FsrsParams = DEFAULT_FSRS_PARAMS,
): MemoryState {
	if (elapsedDays < 0) {
		throw new RangeError(`elapsedDays must be >= 0, got ${elapsedDays}`);
	}
	const { w } = params;

	if (state === null) {
		return {
			difficulty: initDifficulty(grade, w),
			stability: initStability(grade, w),
		};
	}

	const { difficulty, stability } = state;
	const r = retrievability(elapsedDays, stability, params);

	let newStability: number;
	if (elapsedDays === 0 && params.enableShortTerm) {
		newStability = nextShortTermStability(stability, grade, w);
	} else if (grade === Rating.Again) {
		const afterFail = nextForgetStability(difficulty, stability, r, w);
		const [w17, w18] = params.enableShortTerm ? [w[17], w[18]] : [0, 0];
		const minStability = stability / Math.exp(w17 * w18);
		newStability = clamp(roundTo(minStability, 8), S_MIN, afterFail);
	} else {
		newStability = nextRecallStability(difficulty, stability, r, grade, w);
	}

	return {
		difficulty: nextDifficulty(difficulty, grade, w),
		stability: newStability,
	};
}

/**
 * A small, fast, deterministic PRNG (mulberry32) seeded from a 32-bit int.
 * Not cryptographic — it doesn't need to be, it only needs to turn "the same
 * card graded the same way" into "the same fuzzed interval," so re-rendering
 * a review never silently reshuffles a due date.
 */
function mulberry32(seed: number): () => number {
	let a = seed;
	return () => {
		a = (a + 0x6d2b79f5) | 0;
		let t = Math.imul(a ^ (a >>> 15), 1 | a);
		t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** FNV-1a: turns an arbitrary seed string into the 32-bit int mulberry32 wants. */
function hashSeed(seed: string): number {
	let h = 0x811c9dc5;
	for (let i = 0; i < seed.length; i++) {
		h ^= seed.charCodeAt(i);
		h = Math.imul(h, 0x01000193);
	}
	return h >>> 0;
}

/**
 * The +/- fuzz window around a raw interval, widening with the interval
 * itself (a short interval barely moves; a long one can drift by weeks) —
 * ported from ts-fsrs's `get_fuzz_range`.
 */
const FUZZ_RANGES = [
	{ start: 2.5, end: 7.0, factor: 0.15 },
	{ start: 7.0, end: 20.0, factor: 0.1 },
	{ start: 20.0, end: Number.POSITIVE_INFINITY, factor: 0.05 },
] as const;

function fuzzRange(
	interval: number,
	maximumInterval: number,
): { min: number; max: number } {
	let delta = 1.0;
	for (const range of FUZZ_RANGES) {
		delta +=
			range.factor * Math.max(Math.min(interval, range.end) - range.start, 0);
	}
	const capped = Math.min(interval, maximumInterval);
	return {
		min: Math.max(2, Math.round(capped - delta)),
		max: Math.min(Math.round(capped + delta), maximumInterval),
	};
}

/** Randomizes `interval` within its fuzz window, deterministically for a given `seed`. Below 2.5 days, fuzzing would round back to the same day anyway, so it's skipped. */
function applyFuzz(
	interval: number,
	maximumInterval: number,
	seed: string,
): number {
	if (interval < 2.5) return interval;
	const { min, max } = fuzzRange(interval, maximumInterval);
	const roll = mulberry32(hashSeed(seed))();
	return Math.floor(roll * (max - min + 1) + min);
}

/**
 * Next interval (whole days, >= 1, capped at `params.maximumInterval`).
 *
 * @param seed When `params.enableFuzz` is set, the interval is randomized
 *   within a small window around the raw value, deterministically for this
 *   seed (pass something stable per review, e.g. `${cardId}:${reps}` — see
 *   scheduler.ts's `review`). Omitted or fuzzing disabled: no randomization.
 */
export function nextIntervalDays(
	stability: number,
	params: FsrsParams = DEFAULT_FSRS_PARAMS,
	seed?: string,
): number {
	const raw = stability * intervalModifier(params);
	const days = Math.min(Math.max(1, Math.round(raw)), params.maximumInterval);
	if (!params.enableFuzz || seed === undefined) return days;
	return applyFuzz(days, params.maximumInterval, seed);
}
