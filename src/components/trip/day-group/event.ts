import { div, p, span } from "@davidsouther/jiffies/dom/html.ts";
import {
	braveSearch,
	formatClock,
	type ItineraryItem,
	parseDateTime,
	timezoneAbbreviation,
} from "../../../lib/itinerary-helpers.ts";
import type { TripEnrichment } from "../../../lib/trip-enrichment";
import { kids } from "../../children.ts";
import { TimelineItem } from "../timeline-item.ts";
import { WikiCard } from "../wiki-card.ts";
import { BtnLink } from "./btn-link.ts";
import { Fact, Facts } from "./fact.ts";

type EventItemData = Extract<ItineraryItem, { kind: "event" }>;

// (item, enrichment) — positional from the original prop object.
export function EventItem(
	item: EventItemData,
	enrichment: TripEnrichment | undefined,
): HTMLElement {
	const tripEvent = item.data;
	const startDateTime = parseDateTime(tripEvent.start?.datetime);
	const isMeal = /meal|dinner|lunch|restaurant/i.test(
		(tripEvent.category ?? "") + (tripEvent.title ?? ""),
	);

	const row = kids(
		startDateTime
			? span(
					{ class: "timeline-times" },
					span(
						`${formatClock(startDateTime.hours, startDateTime.minutes)} ${timezoneAbbreviation(startDateTime.date, tripEvent.start?.timezone)}`,
					),
				)
			: null,
		span(
			{ class: "title" },
			tripEvent.title ?? "",
			...kids(
				tripEvent.status === "to_book"
					? span({ class: "badge book" }, "To book")
					: null,
			),
		),
		tripEvent.location ? span({ class: "sub" }, tripEvent.location) : null,
	);

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

	const detail = kids(
		Facts(
			kids(
				tripEvent.location ? Fact("Location", tripEvent.location) : null,
				tripEvent.notes ? Fact("Note", tripEvent.notes) : null,
			),
		),
		activity?.blurb ? p({ class: "blurb" }, activity.blurb.trim()) : null,
		div(
			{ class: "links" },
			...kids(
				activity?.official_url
					? BtnLink(activity.official_url, "ext", "Details")
					: null,
				BtnLink(
					braveSearch(searchQuery),
					"ext",
					tripEvent.status === "to_book" ? "Search to book" : "Search",
				),
			),
		),
		activity?.tips ? div({ class: "tips" }, activity.tips) : null,
		wikiTitle ? WikiCard(wikiTitle) : null,
	);

	return TimelineItem(
		isMeal ? "fork" : "compass",
		true,
		tripEvent.status === "to_book",
		row,
		detail,
	);
}
