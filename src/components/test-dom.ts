// Test-only helper: mount a jiffies-rendered node (or fragment) into a fresh
// container attached to document.body, so @testing-library/dom queries can run
// against it. Pair with `resetDom()` in an afterEach. Conditional/absent
// children (null/undefined/false) are dropped here, mirroring how the real tag
// functions filter them when a fragment is spread into a parent element.
import { CLEAR, type DenormChildren } from "@davidsouther/jiffies/dom/dom.ts";
import type { WikiData } from "../lib/wiki-cache.ts";

// Test-only empty Wikipedia lookup: every title misses, so WikiPhoto renders the
// empty `.hero-img` and WikiCard returns null. Lets unit suites that build
// synthetic itineraries (no committed cache) call the 3-arg renderTripPage /
// 5-arg DayGroup without a real cache.
export function emptyWiki(): WikiData {
	return { get: () => undefined };
}

export function mount(node: DenormChildren | DenormChildren[]): HTMLElement {
	const container = document.createElement("div");
	const nodes = (Array.isArray(node) ? node : [node]).filter(
		(n): n is Node | string => n != null && n !== false && n !== CLEAR,
	);
	container.append(...nodes);
	document.body.append(container);
	return container;
}

export function resetDom(): void {
	document.body.innerHTML = "";
}
