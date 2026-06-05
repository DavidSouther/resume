import type { Itinerary } from "~/lib/itinerary";

export type {
	BookingStatus,
	City,
	ConfirmationCode,
	FlightDesignator,
	IataCode,
	ZonedDateTime,
} from "~/lib/itinerary";

export type Place = {
	city: import("~/lib/itinerary").City;
	spot:
		| { kind: "airport"; code: import("~/lib/itinerary").IataCode }
		| { kind: "lodging"; name: string }
		| { kind: "named"; label: string }
		| { kind: "home" };
};

export type Stay = {
	place: Place;
	interval: { start: string; end: string };
	lodging?: unknown;
	events: unknown[];
};

export type Leg = {
	mode: string;
	from: Place;
	to: Place;
	depart?: import("~/lib/itinerary").ZonedDateTime;
	arrive?: import("~/lib/itinerary").ZonedDateTime;
	status: import("~/lib/itinerary").BookingStatus;
	inferred?: boolean;
};

export type Move = {
	from: Place;
	to: Place;
	legs: Leg[];
	depart: import("~/lib/itinerary").ZonedDateTime;
	arrive: import("~/lib/itinerary").ZonedDateTime;
};

export type Segment = ({ kind: "stay" } & Stay) | ({ kind: "move" } & Move);

export type Timeline = {
	meta: unknown;
	segments: Segment[];
};

export function deriveTimeline(_itinerary: Itinerary): Timeline {
	throw new Error("not implemented");
}
