// Data shapes mirroring AnkiConnect's `notesInfo`/`addNote` JSON, so a real
// Anki export (or an AnkiConnect dump) could be dropped in as a deck later
// without changing this shape. See src/lib/flashcards/decks/README.md.

export type ModelName = "Basic" | "Basic (and reversed card)" | "Cloze";

export interface BasicFields {
	Front: string;
	Back: string;
}

export interface ClozeFields {
	Text: string;
	"Back Extra"?: string;
}

export type NoteFields = BasicFields | ClozeFields;

/** One authored fact — the unit of content authoring, independent of how many cards it produces. */
export interface Note {
	noteId: string;
	modelName: ModelName;
	deckName: string;
	fields: NoteFields;
	tags: string[];
}

/** One studyable card, derived from a note + its model's card template(s). */
export interface CardTemplate {
	/** `${noteId}::${ord}` — stable across re-derivation as long as the note doesn't change shape. */
	cardId: string;
	noteId: string;
	ord: number;
	deckName: string;
	tags: string[];
	/** Rendered HTML for the question face. */
	front: string;
	/** Rendered HTML for the answer face (Anki convention: front + rule + answer). */
	back: string;
}

/** A named collection of notes — one Anki deck's worth of source data. */
export interface Deck {
	name: string;
	notes: Note[];
}
