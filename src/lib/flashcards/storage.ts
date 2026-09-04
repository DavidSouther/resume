import type { CardProgress } from "./scheduler.ts";

const STORAGE_KEY = "flashcards:progress:v1";

export interface ProgressStore {
	get(cardId: string): CardProgress | undefined;
	set(cardId: string, progress: CardProgress): void;
	all(): Record<string, CardProgress>;
	/** Clears one card's progress, or every card's if `cardId` is omitted. */
	reset(cardId?: string): void;
}

/**
 * A ProgressStore backed by a single JSON blob in Web Storage (localStorage by
 * default). One key for the whole deck set keeps writes atomic-ish (a single
 * setItem per review) and avoids scattering hundreds of `localStorage` keys.
 */
export function createProgressStore(
	storage: Storage,
	key: string = STORAGE_KEY,
): ProgressStore {
	function readAll(): Record<string, CardProgress> {
		const raw = storage.getItem(key);
		if (!raw) return {};
		try {
			return JSON.parse(raw) as Record<string, CardProgress>;
		} catch {
			// Corrupt or foreign data under our key — treat as empty rather than throw,
			// so a bad write never bricks the whole review session.
			return {};
		}
	}

	function writeAll(all: Record<string, CardProgress>): void {
		storage.setItem(key, JSON.stringify(all));
	}

	return {
		get(cardId) {
			return readAll()[cardId];
		},
		set(cardId, progress) {
			const all = readAll();
			all[cardId] = progress;
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
