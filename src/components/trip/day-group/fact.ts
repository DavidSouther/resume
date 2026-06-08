import type { DenormChildren } from "@davidsouther/jiffies/dom/dom.ts";
import { dd, dl, dt } from "@davidsouther/jiffies/dom/html.ts";

// A property sheet: a flat list of Fact() pairs (with conditional nulls). Each
// Fact is a [dt, dd] pair; `.flat()` here plus jiffies' normalizeArguments
// (depth-1 flatten + falsy drop) gives the dl a flat dt/dd sequence. Call sites
// pass the pairs directly — Facts(Fact(...), cond ? Fact(...) : null) — with no
// array wrapping (a wrapping array would leave the pairs nested one level, and a
// pair as the first arg would be mis-read as attrs). Styled classlessly by the
// jiffies v2 property-sheet rules on a bare `dl`.
export function Facts(
	...facts: (DenormChildren | DenormChildren[])[]
): HTMLElement {
	return dl(...facts.flat());
}

// A label/value pair is a term and its definition, not bold-label + keycap.
export function Fact(label: string, value: string): [HTMLElement, HTMLElement] {
	return [dt(label), dd(value)];
}
