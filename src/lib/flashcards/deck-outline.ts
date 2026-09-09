import type { CardTemplate } from "./anki-types.ts";

export interface DeckOutlineGroup {
	group: string;
	sections: string[];
}

/** One deck's reading order — independent of any sort order its data happens to be in. */
export interface DeckOutline {
	/** The deckName root every one of this deck's notes shares, e.g. "Rust Cheat Sheet". */
	root: string;
	groups: DeckOutlineGroup[];
}

/**
 * The Rust Cheat Sheet's authored reading order, curated by hand (see
 * decks/README.md) rather than derived from however cheats.rs happens to
 * order its own sections.
 */
export const RUST_OUTLINE: DeckOutline = {
	root: "Rust Cheat Sheet",
	groups: [
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
		{
			group: "Coding Guides",
			sections: ["Idiomatic Rust", "Performance Tips"],
		},
	],
};

/**
 * Decks with a hand-curated reading order, keyed by their root. Most decks
 * don't need an entry here — see `outlineFor`, which falls back to deriving
 * one from the data itself. A deck earns a place here when its pedagogical
 * order benefits from deliberate regrouping (see RUST_OUTLINE's own doc
 * comment) rather than whatever order its source material happened to use.
 */
const AUTHORED_OUTLINES: Record<string, DeckOutline> = {
	[RUST_OUTLINE.root]: RUST_OUTLINE,
};

/**
 * The outline for `root`: its authored one if `AUTHORED_OUTLINES` has one,
 * otherwise derived from `cards` themselves — first-appearance order,
 * grouped by the deckName segment right after the root (a bare
 * `Root::Section` deck, with nothing between root and leaf, gets one
 * synthetic group named after the root itself).
 */
export function outlineFor(root: string, cards: CardTemplate[]): DeckOutline {
	const authored = AUTHORED_OUTLINES[root];
	if (authored) return authored;

	const prefix = `${root}::`;
	const groups = new Map<string, string[]>();
	for (const card of cards) {
		if (!card.deckName.startsWith(prefix)) continue;
		const rest = card.deckName.slice(prefix.length).split("::");
		const group = rest.length > 1 ? rest[0] : root;
		const section = rest[rest.length - 1];
		const sections = groups.get(group);
		if (sections) {
			if (!sections.includes(section)) sections.push(section);
		} else {
			groups.set(group, [section]);
		}
	}
	return {
		root,
		groups: [...groups.entries()].map(([group, sections]) => ({
			group,
			sections,
		})),
	};
}

export function deckName(
	outline: DeckOutline,
	group: string,
	section: string,
): string {
	return group === outline.root
		? `${outline.root}::${section}`
		: `${outline.root}::${group}::${section}`;
}

export interface SectionCards {
	group: string;
	section: string;
	deckName: string;
	cards: CardTemplate[];
}

/** Buckets `cards` by deck name, in `outline`'s reading order. Sections with no cards are omitted. */
export function groupCardsByOutline(
	outline: DeckOutline,
	cards: CardTemplate[],
): SectionCards[] {
	const byDeck = new Map<string, CardTemplate[]>();
	for (const card of cards) {
		const bucket = byDeck.get(card.deckName);
		if (bucket) bucket.push(card);
		else byDeck.set(card.deckName, [card]);
	}

	const result: SectionCards[] = [];
	for (const { group, sections } of outline.groups) {
		for (const section of sections) {
			const name = deckName(outline, group, section);
			const bucket = byDeck.get(name);
			if (bucket?.length)
				result.push({ group, section, deckName: name, cards: bucket });
		}
	}
	return result;
}
