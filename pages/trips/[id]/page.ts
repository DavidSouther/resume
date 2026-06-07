import { link } from "@davidsouther/jiffies/dom/html.ts";
import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
import { renderTripPage } from "../../../src/components/trip/trip-page.ts";
import { pageHead } from "../../../src/lib/page-head.ts";
import { getTripItinerary, getTripPaths } from "../../../src/lib/trips.ts";

// The trip detail head adds the Fraunces/Spectral display fonts and the
// trip-only stylesheet on top of the shared page head.
const FONTS =
	"https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Spectral:ital,wght@0,300;0,400;0,500;0,600;1,400&display=swap";

export default {
	generateStaticParams: async () => getTripPaths().map((id) => ({ id })),
	head: async (params) => {
		const { itinerary } = await getTripItinerary(params?.id ?? "");
		return [
			...pageHead(`${itinerary.trip.title} — David Souther`),
			link({ rel: "preconnect", href: "https://fonts.googleapis.com" }),
			link({
				rel: "preconnect",
				href: "https://fonts.gstatic.com",
				crossOrigin: "anonymous",
			}),
			link({ rel: "stylesheet", href: FONTS }),
			link({ rel: "stylesheet", href: "/trip.css" }),
		];
	},
	default: async (params) => {
		const { itinerary, enrichment } = await getTripItinerary(params?.id ?? "");
		return renderTripPage(itinerary, enrichment);
	},
} satisfies PageModule;
