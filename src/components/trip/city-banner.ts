import { div, h2 } from "@davidsouther/jiffies/dom/html.ts";
import { WikiPhoto } from "./wiki-photo.ts";

// (city, wikiTitle) — positional from the original prop object.
export function CityBanner(city: string, wikiTitle?: string): HTMLElement {
	return div(
		{ class: "city-banner" },
		wikiTitle ? WikiPhoto(wikiTitle) : null,
		div(
			{ class: "city-banner-inner" },
			div({ class: "eyebrow" }, "Next stop"),
			h2(city),
		),
	);
}
