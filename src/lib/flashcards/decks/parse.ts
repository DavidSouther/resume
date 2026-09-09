import type { ModelName, Note } from "../anki-types.ts";

const MODEL_NAMES: readonly ModelName[] = [
	"Basic",
	"Basic (and reversed card)",
	"Cloze",
];

function isModelName(value: unknown): value is ModelName {
	return (
		typeof value === "string" &&
		(MODEL_NAMES as readonly string[]).includes(value)
	);
}

/**
 * Parses one raw deck entry into a `Note` — the typed value itself is the
 * proof it's well-formed, so nothing downstream re-checks its shape.
 * `modelName` defaults to "Basic" when absent, since that's the common case
 * for hand-authored decks; an explicit but unrecognized modelName still
 * fails parsing rather than silently falling back.
 */
function parseNote(value: unknown): Note {
	if (typeof value !== "object" || value === null) {
		throw new Error("not an object");
	}
	const v = value as Record<string, unknown>;
	if (typeof v.noteId !== "string") {
		throw new Error("missing or non-string noteId");
	}
	if (typeof v.deckName !== "string") {
		throw new Error("missing or non-string deckName");
	}
	const modelName = v.modelName ?? "Basic";
	if (!isModelName(modelName)) {
		throw new Error(`unrecognized modelName "${String(v.modelName)}"`);
	}
	if (typeof v.fields !== "object" || v.fields === null) {
		throw new Error("missing or non-object fields");
	}
	if (!Array.isArray(v.tags)) {
		throw new Error("missing or non-array tags");
	}
	return {
		noteId: v.noteId,
		modelName,
		deckName: v.deckName,
		fields: v.fields as Note["fields"],
		tags: v.tags,
	};
}

/**
 * Parses a deck payload loaded from any source — bundled with this repo or
 * fetched from somewhere else entirely (see decks/README.md) — dropping
 * malformed entries with a warning rather than crashing the whole app on one
 * bad note.
 */
export function parseDeckNotes(data: unknown, sourceLabel: string): Note[] {
	if (!Array.isArray(data)) {
		throw new Error(`Deck "${sourceLabel}" is not an array of notes`);
	}
	const notes: Note[] = [];
	for (const [i, entry] of data.entries()) {
		try {
			notes.push(parseNote(entry));
		} catch (err) {
			console.warn(
				`Deck "${sourceLabel}": dropping malformed note at index ${i}: ${
					(err as Error).message
				}`,
			);
		}
	}
	return notes;
}
