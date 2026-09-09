// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { createAnnotationStore } from "./annotations.ts";

beforeEach(() => {
	localStorage.clear();
});

describe("createAnnotationStore", () => {
	it("round-trips a card's annotation through localStorage", () => {
		const store = createAnnotationStore(localStorage);
		const annotation = { note: "typo in the answer", annotatedAt: 1 };
		store.set("card-1", annotation);
		expect(store.get("card-1")).toEqual(annotation);
	});

	it("returns undefined for a card never annotated", () => {
		const store = createAnnotationStore(localStorage);
		expect(store.get("nope")).toBeUndefined();
	});

	it("persists across store instances sharing the same key", () => {
		createAnnotationStore(localStorage).set("card-1", {
			note: "n",
			annotatedAt: 1,
		});
		const reopened = createAnnotationStore(localStorage);
		expect(reopened.get("card-1")).toBeDefined();
	});

	it("keeps separate stores under separate keys isolated", () => {
		createAnnotationStore(localStorage, "a").set("card-1", {
			note: "n",
			annotatedAt: 1,
		});
		expect(
			createAnnotationStore(localStorage, "b").get("card-1"),
		).toBeUndefined();
	});

	it("resets a single card's annotation without touching others", () => {
		const store = createAnnotationStore(localStorage);
		store.set("card-1", { note: "n1", annotatedAt: 1 });
		store.set("card-2", { note: "n2", annotatedAt: 1 });
		store.reset("card-1");
		expect(store.get("card-1")).toBeUndefined();
		expect(store.get("card-2")).toBeDefined();
	});

	it("resets everything when called with no cardId", () => {
		const store = createAnnotationStore(localStorage);
		store.set("card-1", { note: "n", annotatedAt: 1 });
		store.reset();
		expect(store.all()).toEqual({});
	});

	it("treats corrupt stored JSON as an empty store rather than throwing", () => {
		localStorage.setItem("flashcards:annotations:v1", "{not json");
		const store = createAnnotationStore(localStorage);
		expect(store.all()).toEqual({});
	});
});
