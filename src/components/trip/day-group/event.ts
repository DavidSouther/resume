import { mark, p, span, strong } from "@davidsouther/jiffies/dom/html.ts";
import {
	braveSearch,
	type ItineraryItem,
} from "../../../lib/itinerary-helpers.ts";
import type { TripEnrichment } from "../../../lib/trip-enrichment";
import type { WikiData } from "../../../lib/wiki-cache.ts";
import { TimelineItem } from "../timeline-item.ts";
import { WikiCard } from "../wiki-card.ts";
import { Actions, BtnLink } from "./btn-link.ts";
import { Clock } from "./clock.ts";
import { Fact, Facts } from "./fact.ts";

type EventItemData = Extract<ItineraryItem, { kind: "event" }>;

// (item, enrichment, wiki) — EventItem owns its destination/page-card title
// fallback chain, so it takes the WikiData lookup (not a resolved summary) and
// resolves its own title.
export function EventItem(
	item: EventItemData,
	enrichment: TripEnrichment | undefined,
	wiki: WikiData,
): HTMLElement {
	const tripEvent = item.data;
	const isMeal = /meal|dinner|lunch|restaurant/i.test(
		(tripEvent.category ?? "") + (tripEvent.title ?? ""),
	);

	const row = [
		Clock(tripEvent.start),
		span(
			strong(tripEvent.title ?? ""),
			tripEvent.status === "to_book" && mark("To book"),
		),
		tripEvent.location && span(tripEvent.location),
	];

	const activity = enrichment?.activities?.find(
		(a) => a.event === tripEvent.title,
	);
	const destRef = activity?.destination_ref;
	const destination = destRef
		? enrichment?.destinations?.find((d) => d.name === destRef)
		: null;
	const wikiTitle =
		destination?.wikipedia?.title ??
		(() => {
			const city = enrichment?.page_cards?.find(
				(card) =>
					tripEvent.location &&
					card.city &&
					tripEvent.location.toLowerCase().includes(card.city.toLowerCase()),
			)?.city;
			return city
				? enrichment?.page_cards?.find((card) => card.city === city)?.wikipedia
						?.title
				: undefined;
		})();

	const searchQuery = [
		(tripEvent.title ?? "").replace(/\s*\(.*?\)/g, "").trim(),
		tripEvent.location,
		"book tickets",
	]
		.filter(Boolean)
		.join(" ");

	const detail = [
		Facts(
			tripEvent.location ? Fact("Location", tripEvent.location) : null,
			tripEvent.notes ? Fact("Note", tripEvent.notes) : null,
		),
		activity?.blurb ? p(activity.blurb.trim()) : null,
		Actions(
			activity?.official_url
				? BtnLink(activity.official_url, "ext", "Details")
				: null,
			BtnLink(
				braveSearch(searchQuery),
				"ext",
				tripEvent.status === "to_book" ? "Search to book" : "Search",
			),
		),
		activity?.tips && p(activity.tips),
		(() => {
			const summary = wiki.get(wikiTitle);
			return summary ? WikiCard({ summary }) : null;
		})(),
	];

	return TimelineItem({ icon: isMeal ? "fork" : "compass", row }, ...detail);
}
