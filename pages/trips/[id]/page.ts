import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
import { TripPage } from "../../../src/components/trip/trip-page.ts";
import { pageHead } from "../../../src/lib/page-head.ts";
import { getTripItinerary, getTripPaths } from "../../../src/lib/trips.ts";

export default {
	// The trips detail root is uncontested (no site theme, no theme picker), so
	// declaring the theme on <html> is safe and is the mechanism that lets the M3
	// roles re-derive from the bronze seed on :root (jiffies ssg htmlAttributes hook).
	htmlAttributes: { "data-theme": "itinerary" },
	generateStaticParams: async () => getTripPaths().map((id) => ({ id })),
	head: async (params) => {
		const { itinerary } = await getTripItinerary(params?.id ?? "");
		return [...pageHead(`${itinerary.trip.title} — David Souther`)];
	},
	default: async (params) => {
		const { itinerary, enrichment, wiki } = await getTripItinerary(
			params?.id ?? "",
		);
		return TripPage({ itinerary, enrichment, wiki });
	},
} satisfies PageModule;
