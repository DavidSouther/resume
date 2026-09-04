// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { initialProgress } from "./scheduler.ts";
import { createProgressStore } from "./storage.ts";

beforeEach(() => {
	localStorage.clear();
});

describe("createProgressStore", () => {
	it("round-trips a card's progress through localStorage", () => {
		const store = createProgressStore(localStorage);
		const progress = initialProgress();
		store.set("card-1", progress);
		expect(store.get("card-1")).toEqual(progress);
	});

	it("returns undefined for a card never seen", () => {
		const store = createProgressStore(localStorage);
		expect(store.get("nope")).toBeUndefined();
	});

	it("persists across store instances sharing the same key", () => {
		createProgressStore(localStorage).set("card-1", initialProgress());
		const reopened = createProgressStore(localStorage);
		expect(reopened.get("card-1")).toBeDefined();
	});

	it("keeps separate stores under separate keys isolated", () => {
		createProgressStore(localStorage, "a").set("card-1", initialProgress());
		expect(
			createProgressStore(localStorage, "b").get("card-1"),
		).toBeUndefined();
	});

	it("resets a single card without touching others", () => {
		const store = createProgressStore(localStorage);
		store.set("card-1", initialProgress());
		store.set("card-2", initialProgress());
		store.reset("card-1");
		expect(store.get("card-1")).toBeUndefined();
		expect(store.get("card-2")).toBeDefined();
	});

	it("resets everything when called with no cardId", () => {
		const store = createProgressStore(localStorage);
		store.set("card-1", initialProgress());
		store.reset();
		expect(store.all()).toEqual({});
	});

	it("treats corrupt stored JSON as an empty store rather than throwing", () => {
		localStorage.setItem("flashcards:progress:v1", "{not json");
		const store = createProgressStore(localStorage);
		expect(store.all()).toEqual({});
	});
});
