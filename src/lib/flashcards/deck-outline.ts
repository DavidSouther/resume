import type { CardTemplate } from "./anki-types.ts";

/** The reading order this app presents decks in — independent of any sort order the data happens to be in. */
export const DECK_OUTLINE: { group: string; sections: string[] }[] = [
	{
		group: "Language Constructs",
		sections: [
			"Data Structures",
			"References & Pointers",
			"Functions & Behavior",
			"Control Flow",
			"Organizing Code",
			"Type Aliases and Casts",
			"Macros & Attributes",
			"Pattern Matching",
			"Generics & Constraints",
			"Strings & Chars",
			"Documentation",
			"Miscellaneous",
		],
	},
	{
		group: "The Abstract Machine",
		sections: ["Language Sugar", "Memory & Lifetimes"],
	},
	{
		group: "Memory Layout",
		sections: [
			"Basic Types",
			"Custom Types",
			"References & Pointers",
			"Closures",
			"Standard Library Types",
		],
	},
	{
		group: "Standard Library",
		sections: [
			"One-Liners",
			"Thread Safety",
			"Iterators",
			"Number Conversions",
			"String Conversions",
			"String Output",
		],
	},
	{
		group: "Tooling",
		sections: [
			"Project Anatomy",
			"Cargo",
			"Cross Compilation",
			"Tooling Directives",
		],
	},
	{
		group: "Working with Types",
		sections: ["Types, Traits, Generics", "Type Conversions"],
	},
	{ group: "Coding Guides", sections: ["Idiomatic Rust", "Performance Tips"] },
];

export const DECK_ROOT = "Rust Cheat Sheet";

export function deckName(group: string, section: string): string {
	return `${DECK_ROOT}::${group}::${section}`;
}

export interface SectionCards {
	group: string;
	section: string;
	deckName: string;
	cards: CardTemplate[];
}

/** Buckets cards by deck name, in the fixed `DECK_OUTLINE` reading order. Sections with no cards are omitted. */
export function groupCardsByOutline(cards: CardTemplate[]): SectionCards[] {
	const byDeck = new Map<string, CardTemplate[]>();
	for (const card of cards) {
		const bucket = byDeck.get(card.deckName);
		if (bucket) bucket.push(card);
		else byDeck.set(card.deckName, [card]);
	}

	const result: SectionCards[] = [];
	for (const { group, sections } of DECK_OUTLINE) {
		for (const section of sections) {
			const name = deckName(group, section);
			const bucket = byDeck.get(name);
			if (bucket?.length)
				result.push({ group, section, deckName: name, cards: bucket });
		}
	}
	return result;
}
