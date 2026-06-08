// @vitest-environment jsdom
import { afterEach, describe, expect, it } from "vitest";
import type { ItineraryItem } from "../../lib/itinerary-helpers.ts";
import type { Hotel } from "../../lib/trip-itinerary";
import { emptyWiki, mount, resetDom } from "../test-dom.ts";
import { DayGroup } from "./day-group.ts";

afterEach(resetDom);

// A transfer is the lightest item to render: TransferItem only reads dir,
// airport, and city, so the hotel slot can be an empty stand-in.
function transferItem(): ItineraryItem {
	return {
		kind: "transfer",
		date: "2026-07-12",
		sortKey: 100,
		data: { dir: "in", airport: "LHR", hotel: {} as Hotel, city: "London" },
	};
}

describe("DayGroup timeline list", () => {
	it("renders the timeline as an ordered list, not a div", () => {
		const container = mount(
			DayGroup("2026-07-12", [transferItem()], null, undefined, emptyWiki()),
		);

		// The timeline is the Panel body's ordered list (section > main > ol),
		// identified by shape — no `.tl` class.
		expect(container.querySelector("section > main > ol")).not.toBeNull();
	});

	it("renders each timeline entry as a list item", () => {
		const container = mount(
			DayGroup("2026-07-12", [transferItem()], null, undefined, emptyWiki()),
		);

		expect(container.querySelectorAll("ol > li")).toHaveLength(1);
	});
});
