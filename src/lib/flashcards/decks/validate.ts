import type { ModelName, Note } from "../anki-types.ts";

const MODEL_NAMES: readonly ModelName[] = [
	"Basic",
	"Basic (and reversed card)",
	"Cloze",
];

function isNote(value: unknown): value is Note {
	if (typeof value !== "object" || value === null) return false;
	const v = value as Record<string, unknown>;
	return (
		typeof v.noteId === "string" &&
		typeof v.deckName === "string" &&
		typeof v.modelName === "string" &&
		(MODEL_NAMES as readonly string[]).includes(v.modelName) &&
		typeof v.fields === "object" &&
		v.fields !== null &&
		Array.isArray(v.tags)
	);
}

/**
 * Validates a deck payload loaded from any source — bundled with this repo
 * or fetched from somewhere else entirely (see decks/README.md) — dropping
 * malformed entries with a warning rather than crashing the whole app on one
 * bad note.
 */
export function parseDeckNotes(data: unknown, sourceLabel: string): Note[] {
	if (!Array.isArray(data)) {
		throw new Error(`Deck "${sourceLabel}" is not an array of notes`);
	}
	const notes: Note[] = [];
	for (const [i, entry] of data.entries()) {
		if (isNote(entry)) {
			notes.push(entry);
		} else {
			console.warn(
				`Deck "${sourceLabel}": dropping malformed note at index ${i}`,
			);
		}
	}
	return notes;
}
