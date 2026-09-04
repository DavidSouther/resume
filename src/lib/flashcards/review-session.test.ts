import { describe, expect, it } from "vitest";
import type { CardTemplate } from "./anki-types.ts";
import { Rating } from "./fsrs.ts";
import {
	buildQueue,
	formatDays,
	intervalPreviews,
	requeue,
	requeuePosition,
} from "./review-session.ts";
import { initialProgress, review } from "./scheduler.ts";

const NOW = Date.parse("2026-01-01T00:00:00Z");
const DAY_MS = 24 * 60 * 60 * 1000;

function card(deckName: string, cardId: string): CardTemplate {
	return {
		cardId,
		noteId: cardId,
		ord: 0,
		deckName,
		tags: [],
		front: "f",
		back: "b",
	};
}

describe("buildQueue", () => {
	const cards = [card("A", "a1"), card("A", "a2"), card("B", "b1")];

	it("includes new cards (they're due immediately)", () => {
		const queue = buildQueue(cards, () => initialProgress(), NOW);
		expect(queue).toHaveLength(3);
	});

	it("excludes cards not yet due", () => {
		const notDue = review(initialProgress(), Rating.Good, NOW); // due days out
		const queue = buildQueue(
			cards,
			(id) => (id === "a1" ? notDue : initialProgress()),
			NOW,
		);
		expect(queue.map((q) => q.card.cardId)).toEqual(["a2", "b1"]);
	});

	it("filters to a single deck when given a scope", () => {
		const queue = buildQueue(cards, () => initialProgress(), NOW, "A");
		expect(queue.map((q) => q.card.cardId)).toEqual(["a1", "a2"]);
	});

	it("orders soonest-due first", () => {
		const soon = review(initialProgress(), Rating.Good, NOW - 10 * DAY_MS);
		const later = review(initialProgress(), Rating.Easy, NOW - 10 * DAY_MS);
		// Scoped to deck "A" so the never-reviewed b1 (always due) doesn't sort
		// ahead of both — this test is about ordering *among already-scheduled* cards.
		const queue = buildQueue(
			cards,
			(id) => (id === "a1" ? later : soon),
			NOW,
			"A",
		);
		expect(queue[0].card.cardId).toBe("a2");
	});
});

describe("formatDays", () => {
	it("renders sub-day, day, week, and month scales", () => {
		expect(formatDays(0.5)).toBe("<1d");
		expect(formatDays(3)).toBe("3d");
		expect(formatDays(30)).toBe("4w");
		expect(formatDays(120)).toBe("4mo");
	});
});

describe("intervalPreviews", () => {
	it("returns a preview for all four grades", () => {
		const previews = intervalPreviews(initialProgress(), NOW);
		expect(Object.keys(previews).map(Number).sort()).toEqual([1, 2, 3, 4]);
		expect(previews[Rating.Easy]).not.toBe(previews[Rating.Again]);
	});

	it("labels Again 'Soon', not a long-term day count", () => {
		// Again gets requeued this session (see `requeue`) rather than waiting
		// for the FSRS-computed long-term due date, so the button shouldn't
		// imply a multi-day wait.
		const previews = intervalPreviews(initialProgress(), NOW);
		expect(previews[Rating.Again]).toBe("Soon");
	});
});

describe("requeuePosition", () => {
	it("never exceeds the remaining queue length", () => {
		expect(requeuePosition(2)).toBeLessThanOrEqual(2);
		expect(requeuePosition(0)).toBe(0);
	});

	it("doesn't place the card immediately next", () => {
		expect(requeuePosition(10)).toBeGreaterThanOrEqual(3);
	});
});

describe("requeue", () => {
	const a = { card: card("A", "a1"), progress: initialProgress() };
	const b = { card: card("A", "a2"), progress: initialProgress() };
	const c = { card: card("A", "a3"), progress: initialProgress() };
	const d = { card: card("A", "a4"), progress: initialProgress() };
	const failed = { card: card("A", "failed"), progress: initialProgress() };

	it("reinserts the item somewhere after the front of the queue, not lost", () => {
		const requeued = requeue([a, b, c, d], failed);
		expect(requeued).toHaveLength(5);
		expect(requeued[0]).toBe(a); // not immediately next
		expect(requeued.some((item) => item === failed)).toBe(true);
	});

	it("appends to an otherwise-empty queue", () => {
		expect(requeue([], failed)).toEqual([failed]);
	});
});
