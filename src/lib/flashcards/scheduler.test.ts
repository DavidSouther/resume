import { describe, expect, it } from "vitest";
import { Rating } from "./fsrs.ts";
import { daysUntilDue, initialProgress, isDue, review } from "./scheduler.ts";

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = Date.parse("2026-01-01T00:00:00Z");

describe("initialProgress", () => {
	it("is due immediately and has no memory state yet", () => {
		const p = initialProgress();
		expect(p.state).toBeNull();
		expect(isDue(p, NOW)).toBe(true);
	});
});

describe("review", () => {
	it("schedules a first Good review a few days out and bumps reps", () => {
		const p = review(initialProgress(), Rating.Good, NOW);
		expect(p.reps).toBe(1);
		expect(p.lapses).toBe(0);
		expect(p.state).not.toBeNull();
		expect(p.due).toBeGreaterThan(NOW);
		expect(isDue(p, NOW)).toBe(false);
	});

	it("counts Again as a lapse", () => {
		const p = review(initialProgress(), Rating.Again, NOW);
		expect(p.lapses).toBe(1);
	});

	it("computes elapsed days from lastReview to the new review time", () => {
		const first = review(initialProgress(), Rating.Good, NOW);
		const laterNow = first.due; // review exactly when it's due
		const second = review(first, Rating.Good, laterNow);
		// A second consecutive Good should extend the interval further out.
		expect(second.due - laterNow).toBeGreaterThan(first.due - NOW);
	});

	it("shortens the schedule after a lapse compared to a repeated success", () => {
		const good = review(
			review(initialProgress(), Rating.Good, NOW),
			Rating.Good,
			NOW + 3 * DAY_MS,
		);
		const again = review(
			review(initialProgress(), Rating.Good, NOW),
			Rating.Again,
			NOW + 3 * DAY_MS,
		);
		expect(daysUntilDue(again, NOW + 3 * DAY_MS)).toBeLessThan(
			daysUntilDue(good, NOW + 3 * DAY_MS),
		);
	});
});
