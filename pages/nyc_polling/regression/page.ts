import {
	a,
	div,
	h1,
	main,
	meta,
	noscript,
	p,
	style,
} from "@davidsouther/jiffies/dom/html.ts";
import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
import { pageHead } from "../../../src/lib/page-head.ts";
import { PLOTLY_URL } from "../../../src/lib/plotly-bundle.ts";

const CSS = `
.nyc-regression { max-width: 60rem; margin: 0 auto; padding: 1rem; }
#nyc-scatter { width: 100%; height: 32rem; }
#nyc-fits table { width: auto; }
`;

export default {
	head: () => [
		...pageHead("NYC Poverty and Distance to Early Voting — David Souther"),
		// The client module reads the pinned URL from here rather than importing it.
		meta({ name: "plotly-src", content: PLOTLY_URL }),
		style({}, CSS),
	],
	default: () =>
		main(
			{ class: "nyc-regression" },
			h1({}, "Poverty rate and distance to the early voting site"),
			p(
				{},
				"Each point is one tract district: x is its tract's poverty rate, y is the straight line distance from the district's center to its assigned early voting site. ",
				a({ href: "/nyc_polling/" }, "Back to the map"),
				".",
			),
			div({
				id: "nyc-scatter",
				ariaLabel: "Scatter plot with regression curves",
			}),
			div({ id: "nyc-fits" }),
			noscript({}, p({}, "This chart needs JavaScript.")),
		),
	clientModules: ["/src/components/nyc_polling/regression.ts"],
} satisfies PageModule;
