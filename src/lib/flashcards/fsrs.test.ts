import { describe, expect, it } from "vitest";
import {
	DEFAULT_FSRS_PARAMS,
	nextIntervalDays,
	nextState,
	Rating,
	retrievability,
} from "./fsrs.ts";

// Fixture values below are reproduced (not copied — recomputed by hand from the
// published FSRS-6 formulas) from
// github.com/open-spaced-repetition/ts-fsrs packages/fsrs/__tests__/FSRS-6.test.ts
// ("first repeat" and "memory state" cases), MIT licensed, using the same
// default weights. They pin our port to the reference implementation's output.

describe("nextState", () => {
	it("initializes stability from w[grade-1] and difficulty from the D0 formula", () => {
		// "first repeat": a brand-new card (state=null) reviewed once under each grade.
		const again = nextState(null, 0, Rating.Again);
		const hard = nextState(null, 0, Rating.Hard);
		const good = nextState(null, 0, Rating.Good);
		const easy = nextState(null, 0, Rating.Easy);

		expect([again, hard, good, easy].map((s) => s.stability)).toEqual([
			0.212, 1.2931, 2.3065, 8.2956,
		]);
		expect(again.difficulty).toBeCloseTo(6.4133, 4);
		expect(hard.difficulty).toBeCloseTo(5.11217071, 4);
		expect(good.difficulty).toBeCloseTo(2.11810397, 4);
		// Easy's raw D0 formula goes below 1 and is clamped to the [1, 10] floor.
		expect(easy.difficulty).toBe(1);
	});

	it("matches the reference short-term memory-state trajectory", () => {
		// Again, then five Goods, with these elapsed-day gaps between reviews.
		const ratings = [
			Rating.Again,
			Rating.Good,
			Rating.Good,
			Rating.Good,
			Rating.Good,
			Rating.Good,
		];
		const elapsed = [0, 0, 1, 3, 8, 21];

		let state = null as ReturnType<typeof nextState> | null;
		for (const [i, grade] of ratings.entries()) {
			state = nextState(state, elapsed[i], grade);
		}

		expect(state?.stability).toBeCloseTo(53.62691, 4);
		expect(state?.difficulty).toBeCloseTo(6.3574867, 4);
	});

	it("matches the reference long-term (enableShortTerm: false) trajectory", () => {
		const ratings = [
			Rating.Again,
			Rating.Good,
			Rating.Good,
			Rating.Good,
			Rating.Good,
			Rating.Good,
		];
		const elapsed = [0, 0, 1, 3, 8, 21];
		const params = { ...DEFAULT_FSRS_PARAMS, enableShortTerm: false };

		let state = null as ReturnType<typeof nextState> | null;
		for (const [i, grade] of ratings.entries()) {
			state = nextState(state, elapsed[i], grade, params);
		}

		expect(state?.stability).toBeCloseTo(53.335106, 4);
		expect(state?.difficulty).toBeCloseTo(6.3574867, 4);
	});

	it("rejects a negative elapsed-days gap", () => {
		expect(() => nextState(null, -1, Rating.Good)).toThrow(RangeError);
	});
});

describe("retrievability", () => {
	it("is 1 immediately after a review", () => {
		expect(retrievability(0, 10)).toBe(1);
	});

	it("decreases as more days elapse", () => {
		const soon = retrievability(1, 10);
		const later = retrievability(30, 10);
		expect(later).toBeLessThan(soon);
		expect(soon).toBeLessThan(1);
	});
});

describe("nextIntervalDays", () => {
	it("returns ~stability days at the default 90% request retention", () => {
		// At request_retention === 0.9, the interval modifier collapses to 1.0
		// exactly (the forgetting curve is defined so R(stability, stability) ==
		// 0.9), so the schedule interval is just the rounded stability.
		expect(nextIntervalDays(8.2956)).toBe(8); // matches the "first repeat" Easy case
		expect(nextIntervalDays(2.3065)).toBe(2);
		expect(nextIntervalDays(53.62691)).toBe(54);
	});

	it("never schedules less than one day out", () => {
		expect(nextIntervalDays(0.001)).toBe(1);
	});

	it("caps at the configured maximum interval", () => {
		expect(
			nextIntervalDays(100000, { ...DEFAULT_FSRS_PARAMS, maximumInterval: 30 }),
		).toBe(30);
	});
});

describe("nextIntervalDays fuzzing", () => {
	it("is deterministic for the same seed", () => {
		const params = { ...DEFAULT_FSRS_PARAMS, enableFuzz: true };
		const a = nextIntervalDays(30, params, "card-1:2");
		const b = nextIntervalDays(30, params, "card-1:2");
		expect(a).toBe(b);
	});

	it("stays within the ts-fsrs fuzz window around the raw interval", () => {
		const params = { ...DEFAULT_FSRS_PARAMS, enableFuzz: true };
		const raw = nextIntervalDays(30, { ...params, enableFuzz: false });
		for (let i = 0; i < 20; i++) {
			const fuzzed = nextIntervalDays(30, params, `seed-${i}`);
			expect(Math.abs(fuzzed - raw)).toBeLessThanOrEqual(6); // 30d window is well under +/-6d
		}
	});

	it("produces some variation across different seeds", () => {
		const params = { ...DEFAULT_FSRS_PARAMS, enableFuzz: true };
		const results = new Set(
			Array.from({ length: 20 }, (_, i) =>
				nextIntervalDays(60, params, `seed-${i}`),
			),
		);
		expect(results.size).toBeGreaterThan(1);
	});

	it("does not fuzz short intervals (< 2.5 days), matching ts-fsrs", () => {
		const params = { ...DEFAULT_FSRS_PARAMS, enableFuzz: true };
		expect(nextIntervalDays(2, params, "seed-a")).toBe(
			nextIntervalDays(2, params, "seed-b"),
		);
	});

	it("leaves the interval unfuzzed when no seed is given, even with enableFuzz on", () => {
		const params = { ...DEFAULT_FSRS_PARAMS, enableFuzz: true };
		expect(nextIntervalDays(30, params)).toBe(
			nextIntervalDays(30, { ...params, enableFuzz: false }),
		);
	});

	it("never exceeds the maximum interval even when fuzzed", () => {
		const params = {
			...DEFAULT_FSRS_PARAMS,
			enableFuzz: true,
			maximumInterval: 30,
		};
		for (let i = 0; i < 20; i++) {
			expect(nextIntervalDays(1000, params, `seed-${i}`)).toBeLessThanOrEqual(
				30,
			);
		}
	});
});
