import { optgroup, option, select } from "@davidsouther/jiffies/dom/html.ts";
import { DECK_OUTLINE, deckName } from "../../lib/flashcards/deck-outline.ts";

/** A `<select>` of every deck section, grouped by top-level group, with a leading "everything" option. */
export function buildDeckSelect(
	className: string,
	allLabel: string,
): HTMLSelectElement {
	const groups = DECK_OUTLINE.map(({ group, sections }) =>
		optgroup(
			{ label: group },
			...sections.map((s) => option({ value: deckName(group, s) }, s)),
		),
	);
	// `value: ""` set via the attrs shorthand: the attrs runtime treats a falsy
	// value as "remove this attribute" (same pitfall as `tabIndex: 0`), which
	// would leave the option with no value attribute — and a valueless
	// <option> defaults its value to its text content, not "". Set it as a
	// real property afterward so the empty string actually sticks.
	const allOption = option({}, allLabel);
	allOption.value = "";
	return select({ class: className }, allOption, ...groups);
}
