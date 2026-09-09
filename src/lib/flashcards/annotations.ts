/** One card's local "this is wrong" annotation — a note plus when it was raised. */
export interface CardAnnotation {
	note: string;
	annotatedAt: number;
}

export interface AnnotationStore {
	get(cardId: string): CardAnnotation | undefined;
	set(cardId: string, annotation: CardAnnotation): void;
	all(): Record<string, CardAnnotation>;
	/** Clears one card's annotation, or every card's if `cardId` is omitted. */
	reset(cardId?: string): void;
}

const STORAGE_KEY = "flashcards:annotations:v1";

/**
 * An AnnotationStore backed by a single JSON blob in Web Storage
 * (localStorage by default) — same shape as storage.ts's ProgressStore, but
 * kept under its own key: an annotation ("this card's content is wrong,
 * here's why") is local feedback about a card's content, not FSRS
 * scheduling state, and has its own lifecycle — cleared once the content's
 * fixed, not on every review.
 */
export function createAnnotationStore(
	storage: Storage,
	key: string = STORAGE_KEY,
): AnnotationStore {
	function readAll(): Record<string, CardAnnotation> {
		const raw = storage.getItem(key);
		if (!raw) return {};
		try {
			return JSON.parse(raw) as Record<string, CardAnnotation>;
		} catch {
			// Corrupt or foreign data under our key — treat as empty rather than
			// throw, so a bad write never bricks the whole review session.
			return {};
		}
	}

	function writeAll(all: Record<string, CardAnnotation>): void {
		storage.setItem(key, JSON.stringify(all));
	}

	return {
		get(cardId) {
			return readAll()[cardId];
		},
		set(cardId, annotation) {
			const all = readAll();
			all[cardId] = annotation;
			writeAll(all);
		},
		all() {
			return readAll();
		},
		reset(cardId) {
			if (cardId === undefined) {
				storage.removeItem(key);
				return;
			}
			const all = readAll();
			delete all[cardId];
			writeAll(all);
		},
	};
}
