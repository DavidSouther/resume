import { describe, expect, it } from "vitest";
import type { Note } from "./anki-types.ts";
import { cardsForNote } from "./models.ts";

function note(overrides: Partial<Note> = {}): Note {
	return {
		noteId: "n1",
		modelName: "Basic",
		deckName: "Rust Cheat Sheet::Test",
		fields: { Front: "front text", Back: "back text" },
		tags: ["rust"],
		...overrides,
	};
}

describe("cardsForNote", () => {
	it("derives one card from a Basic note, back showing front + rule + back", () => {
		const cards = cardsForNote(note());
		expect(cards).toHaveLength(1);
		expect(cards[0]).toMatchObject({
			cardId: "n1::0",
			noteId: "n1",
			front: "front text",
			back: "front text<hr>back text",
		});
	});

	it("derives two cards from a Basic (and reversed card) note", () => {
		const cards = cardsForNote(
			note({ modelName: "Basic (and reversed card)" }),
		);
		expect(cards).toHaveLength(2);
		expect(cards[0]).toMatchObject({ cardId: "n1::0", front: "front text" });
		expect(cards[1]).toMatchObject({ cardId: "n1::1", front: "back text" });
	});

	it("derives one card per distinct cloze number", () => {
		const cards = cardsForNote(
			note({
				modelName: "Cloze",
				fields: {
					Text: "A {{c1::Vec<T>}} is growable; a {{c2::[T; N]}} is fixed-size.",
				},
			}),
		);
		expect(cards).toHaveLength(2);
		expect(cards[0].cardId).toBe("n1::1");
		expect(cards[0].front).toContain("[...]");
		expect(cards[0].front).toContain("[T; N]"); // the *other* cloze stays revealed
		expect(cards[0].back).toContain("Vec<T>");
	});

	it("shows a cloze hint instead of ... when one is given", () => {
		const cards = cardsForNote(
			note({
				modelName: "Cloze",
				fields: {
					Text: "The growable vector type is {{c1::Vec<T>::a std collection}}.",
				},
			}),
		);
		expect(cards[0].front).toContain("a std collection");
	});

	it("appends Back Extra to every cloze card's back face", () => {
		const cards = cardsForNote(
			note({
				modelName: "Cloze",
				fields: {
					Text: "{{c1::Vec<T>}} is growable.",
					"Back Extra": "See also VecDeque.",
				},
			}),
		);
		expect(cards[0].back).toContain("See also VecDeque.");
	});

	it("throws for a Cloze note with no cloze markers", () => {
		expect(() =>
			cardsForNote(
				note({ modelName: "Cloze", fields: { Text: "no markers here" } }),
			),
		).toThrow(/no \{\{cN/);
	});
});
