import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
import { renderTripsList } from "../../src/components/trips-list.ts";
import { pageHead } from "../../src/lib/page-head.ts";
import { getSortedTrips } from "../../src/lib/trips.ts";

export default {
	head: () => pageHead("Trips — David Souther"),
	default: async () => renderTripsList(await getSortedTrips()),
} satisfies PageModule;
