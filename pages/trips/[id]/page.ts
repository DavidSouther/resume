import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
import { renderTripPage } from "../../../src/components/trip/trip-page.ts";
import { pageHead } from "../../../src/lib/page-head.ts";
import { getTripItinerary, getTripPaths } from "../../../src/lib/trips.ts";

export default {
	generateStaticParams: async () => getTripPaths().map((id) => ({ id })),
	head: async (params) => {
		const { itinerary } = await getTripItinerary(params?.id ?? "");
		return [...pageHead(`${itinerary.trip.title} — David Souther`)];
	},
	default: async (params) => {
		const { itinerary, enrichment, wiki } = await getTripItinerary(
			params?.id ?? "",
		);
		return renderTripPage(itinerary, enrichment, wiki);
	},
} satisfies PageModule;
