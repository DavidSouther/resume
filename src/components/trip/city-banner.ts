import { div, h2, p, small } from "@davidsouther/jiffies/dom/html.ts";
import type { WikiSummary } from "../../lib/wiki-cache.ts";
import { WikiPhoto } from "./wiki-photo.ts";

// (city, wikiSummary) — the banner background sits behind a heading, so it is
// decorative: alt="".
export function CityBanner(
	city: string,
	wikiSummary?: WikiSummary,
): HTMLElement {
	return div(
		WikiPhoto({ summary: wikiSummary, alt: "" }),
		div(p(small("Next stop")), h2(city)),
	);
}
