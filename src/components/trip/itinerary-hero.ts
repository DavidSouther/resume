import type { DenormChildren } from "@davidsouther/jiffies/dom/dom.ts";
import { a, aside, div, h1, p } from "@davidsouther/jiffies/dom/html.ts";
import { initials, rangeLabel } from "../../lib/itinerary-helpers.ts";
import type { Itinerary } from "../../lib/trip-itinerary";
import type { WikiSummary } from "../../lib/wiki-cache.ts";
import { WikiPhoto } from "./wiki-photo.ts";

// (itinerary, wikiSummary) — the hero image is informative (a real photo of the
// place), so it gets a meaningful alt: the trip title.
export function ItineraryHero(
	itinerary: Itinerary,
	wikiSummary?: WikiSummary,
): DenormChildren {
	const { trip } = itinerary;
	const start = String(trip.start_date);
	const end = String(trip.end_date);

	return div(
		WikiPhoto({ summary: wikiSummary, alt: trip.title }),
		p("Itinerary"),
		h1(trip.title),
		aside(initials(trip.traveler)),
		div(start && end ? rangeLabel(start, end) : ""),
		trip.traveler ? a({ href: "/" }, trip.traveler) : null,
		trip.notes ? div(trip.notes) : null,
	);
}
