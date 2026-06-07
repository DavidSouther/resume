import { div, h1, p } from "@davidsouther/jiffies/dom/html.ts";
import { initials, rangeLabel } from "../../lib/itinerary-helpers.ts";
import type { Itinerary } from "../../lib/trip-itinerary";
import { WikiPhoto } from "./wiki-photo.ts";

// (itinerary, wikiTitle) — positional from the original prop object.
export function ItineraryHero(
	itinerary: Itinerary,
	wikiTitle?: string,
): HTMLElement {
	const { trip } = itinerary;
	const start = String(trip.start_date);
	const end = String(trip.end_date);

	return div(
		{ class: "hero" },
		wikiTitle ? WikiPhoto(wikiTitle) : null,
		div(
			{ class: "hero-inner" },
			p({ class: "kicker" }, "Itinerary"),
			h1(trip.title),
			div(
				{ class: "hero-meta" },
				div({ class: "avatar" }, initials(trip.traveler)),
				div(
					div(
						{ class: "hero-dates" },
						start && end ? rangeLabel(start, end) : "",
					),
					trip.traveler ? div({ class: "hero-traveler" }, trip.traveler) : null,
				),
			),
			trip.notes ? div({ class: "hero-note" }, trip.notes) : null,
		),
	);
}
