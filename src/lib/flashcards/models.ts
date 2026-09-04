import type { CardTemplate, ClozeFields, Note } from "./anki-types.ts";

/** Matches `{{c1::answer}}` and `{{c1::answer::hint}}`, across cloze numbers. */
const CLOZE_PATTERN = /\{\{c(\d+)::([\s\S]*?)(?:::([\s\S]*?))?\}\}/g;

function clozeNumbers(text: string): number[] {
	const seen = new Set<number>();
	for (const match of text.matchAll(CLOZE_PATTERN)) {
		seen.add(Number(match[1]));
	}
	return [...seen].sort((a, b) => a - b);
}

/** Renders a Cloze field for one target cloze number: target hidden (or its hint shown), others revealed. */
function renderCloze(
	text: string,
	targetOrd: number,
	revealTarget: boolean,
): string {
	return text.replace(CLOZE_PATTERN, (_all, numStr, answer, hint) => {
		const num = Number(numStr);
		if (num !== targetOrd) return answer;
		if (revealTarget) return `<span class="cloze-answer">${answer}</span>`;
		return `<span class="cloze-blank">[${hint ?? "..."}]</span>`;
	});
}

/**
 * Derives the studyable card(s) for one note, following Anki's own
 * per-model card templates:
 *  - Basic: one card, Front → Front + rule + Back.
 *  - Basic (and reversed card): two cards, the second swapping Front/Back.
 *  - Cloze: one card per distinct `{{cN::...}}` number in Text, hiding only
 *    that number's answer and revealing the rest.
 */
export function cardsForNote(note: Note): CardTemplate[] {
	switch (note.modelName) {
		case "Basic": {
			const { Front, Back } = note.fields as { Front: string; Back: string };
			return [basicCard(note, 0, Front, Back)];
		}
		case "Basic (and reversed card)": {
			const { Front, Back } = note.fields as { Front: string; Back: string };
			return [basicCard(note, 0, Front, Back), basicCard(note, 1, Back, Front)];
		}
		case "Cloze": {
			const { Text, "Back Extra": backExtra } = note.fields as ClozeFields;
			const ords = clozeNumbers(Text);
			if (ords.length === 0) {
				throw new Error(
					`Cloze note "${note.noteId}" has no {{cN::...}} markers`,
				);
			}
			return ords.map((ord) => {
				const front = renderCloze(Text, ord, false);
				let back = renderCloze(Text, ord, true);
				if (backExtra) back += `<div class="cloze-extra">${backExtra}</div>`;
				return {
					cardId: `${note.noteId}::${ord}`,
					noteId: note.noteId,
					ord,
					deckName: note.deckName,
					tags: note.tags,
					front,
					back,
				};
			});
		}
		default: {
			const exhaustive: never = note.modelName;
			throw new Error(`Unknown model name: ${exhaustive}`);
		}
	}
}

function basicCard(
	note: Note,
	ord: number,
	front: string,
	back: string,
): CardTemplate {
	return {
		cardId: `${note.noteId}::${ord}`,
		noteId: note.noteId,
		ord,
		deckName: note.deckName,
		tags: note.tags,
		front,
		back: `${front}<hr>${back}`,
	};
}

/** Derives cards for every note in a deck, in order. */
export function cardsForNotes(notes: Note[]): CardTemplate[] {
	return notes.flatMap(cardsForNote);
}
