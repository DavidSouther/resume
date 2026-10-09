import { a, div, h1, iframe, p } from "@davidsouther/jiffies/dom/html.ts";
import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
import { pageHead } from "../../src/lib/page-head.ts";

// Google My Maps id of the published map. Until the combined KML is imported into
// My Maps and shared publicly, this is the source early voting poll sites map.
// Replace it with the id from the new map's embed URL (My Maps > Share > Embed).
const PUBLISHED_MAP_ID = "10uQAlVO5wBkETzGnkm1no2f1LYGmt1w";
const KML_PATHS = [
	["/nyc_polling/nyc_tracts_bronx.kml", "Bronx tracts"],
	["/nyc_polling/nyc_tracts_brooklyn.kml", "Brooklyn tracts"],
	["/nyc_polling/nyc_tracts_manhattan.kml", "Manhattan tracts"],
	["/nyc_polling/nyc_tracts_queens.kml", "Queens tracts"],
	["/nyc_polling/nyc_tracts_staten_island.kml", "Staten Island tracts"],
	["/nyc_polling/nyc_tracts_low_population.kml", "low population tracts"],
	["/nyc_polling/nyc_tracts_zero_population.kml", "zero population tracts"],
	["/nyc_polling/nyc_poll_sites.kml", "early voting poll sites"],
] as const;

export default {
	head: () => pageHead("NYC Poverty and Early Voting Sites — David Souther"),
	default: () =>
		div(
			{ class: "nyc-polling" },
			h1({}, "NYC poverty and early voting sites"),
			p(
				{},
				"Census tracts colored by ACS 2024 5-year poverty rate, with early voting poll sites as points. Click a tract for median household income and margins of error.",
			),
			iframe({
				src: `https://www.google.com/maps/d/embed?mid=${PUBLISHED_MAP_ID}`,
				title: "NYC census tract poverty and early voting poll sites map",
				width: "100%",
				height: "640",
				loading: "lazy",
				style: "border: 0",
			}),
			p(
				{},
				"Download the KML files to import into Google My Maps: ",
				...KML_PATHS.flatMap(([href, label], i) => [
					i ? ", " : "",
					a({ href }, label),
				]),
				".",
			),
		),
} satisfies PageModule;
