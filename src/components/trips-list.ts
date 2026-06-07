import { Card } from "@davidsouther/jiffies/components/card.ts";
import { h3 } from "@davidsouther/jiffies/dom/html.ts";
import type { Trip } from "../lib/trips.ts";
import { IDLinkList } from "./list.ts";

// The /trips index: a "Trips" card linking each trip by title.
export function renderTripsList(trips: Trip[]): HTMLElement {
	return Card(
		{ header: h3("Trips") },
		IDLinkList(
			trips,
			({ id }) => `/trips/${id}`,
			({ title }) => title ?? "Unknown",
		),
	);
}
