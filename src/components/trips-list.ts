import type { Trip } from "../lib/trips.ts";
import { card } from "./card.ts";
import { IDLinkList } from "./list.ts";

// The /trips index: a "Trips" card linking each trip by title.
export function renderTripsList(trips: Trip[]): HTMLElement {
	return card(
		"",
		"Trips",
		IDLinkList(
			trips,
			({ id }) => `/trips/${id}`,
			({ title }) => title ?? "Unknown",
		),
	);
}
