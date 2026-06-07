import { div, h2 } from "@davidsouther/jiffies/dom/html.ts";
import { kids } from "../children.ts";
import { WikiPhoto } from "./wiki-photo.ts";

// (city, wikiTitle) — positional from the original prop object.
export function CityBanner(city: string, wikiTitle?: string): HTMLElement {
	return div(
		{ class: "city-banner" },
		...kids(wikiTitle ? WikiPhoto(wikiTitle) : null),
		div(
			{ class: "city-banner-inner" },
			div({ class: "eyebrow" }, "Next stop"),
			h2(city),
		),
	);
}
