import { IATA } from "~/lib/itinerary-helpers";
import type {
	City,
	IanaTimeZone,
	IataCode,
	Itinerary,
	ZonedDateTime,
} from "~/lib/itinerary";

export type {
	BookingStatus,
	City,
	ConfirmationCode,
	FlightDesignator,
	IataCode,
	ZonedDateTime,
} from "~/lib/itinerary";

export type Place = {
	city: City;
	spot:
		| { kind: "airport"; code: IataCode }
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
	depart?: ZonedDateTime;
	arrive?: ZonedDateTime;
	status: import("~/lib/itinerary").BookingStatus;
	inferred?: boolean;
};

export type Move = {
	from: Place;
	to: Place;
	legs: Leg[];
	depart: ZonedDateTime;
	arrive: ZonedDateTime;
};

export type Segment = ({ kind: "stay" } & Stay) | ({ kind: "move" } & Move);

export type Timeline = {
	meta: unknown;
	segments: Segment[];
};

const KNOWN_CITIES = new Set<string>([
	...Object.values(IATA),
	"Hvar",
	"Bath",
	"Heathrow",
]);

function resolveCity(name: string): City {
	const lower = name.toLowerCase();
	for (const city of KNOWN_CITIES) {
		if (lower.includes(city.toLowerCase())) {
			return city as City;
		}
	}
	// fall back: substring after last comma or dash
	const commaIdx = name.lastIndexOf(",");
	if (commaIdx !== -1) return name.slice(commaIdx + 1).trim() as City;
	const dashIdx = name.lastIndexOf(" - ");
	if (dashIdx !== -1) return name.slice(dashIdx + 3).trim() as City;
	return name as City;
}

function iataCity(code: string): City {
	return (IATA[code] ?? code) as City;
}

export function deriveTimeline(itinerary: Itinerary): Timeline {
	// 1. Hotels → ordered stays
	const sortedHotels = [...itinerary.hotels].sort((a, b) =>
		a.check_in.date < b.check_in.date ? -1 : 1,
	);

	const stays: ({ kind: "stay" } & Stay)[] = sortedHotels.map((hotel) => ({
		kind: "stay" as const,
		place: {
			city: resolveCity(hotel.name),
			spot: { kind: "lodging" as const, name: hotel.name },
		},
		interval: { start: hotel.check_in.date, end: hotel.check_out.date },
		events: [],
	}));

	// 2. Home anchor
	const homeCity = iataCity(itinerary.flights[0]?.origin.code ?? "");
	const homePlace: Place = { city: homeCity, spot: { kind: "home" } };

	// 3. Placeholder timestamps from trip dates
	const tz = (itinerary.trip.home_timezone ?? "UTC") as IanaTimeZone;
	const tripStart: ZonedDateTime = {
		datetime: `${itinerary.trip.start_date}T00:00:00`,
		timezone: tz,
	};
	const tripEnd: ZonedDateTime = {
		datetime: `${itinerary.trip.end_date}T00:00:00`,
		timezone: tz,
	};

	// 4. Build anchor sequence: [home, s1, s2, …, home]
	const anchorPlaces: Place[] = [
		homePlace,
		...stays.map((s) => s.place),
		homePlace,
	];

	// 5. Gap moves between consecutive anchor pairs
	const moves: ({ kind: "move" } & Move)[] = [];
	for (let i = 0; i < anchorPlaces.length - 1; i++) {
		moves.push({
			kind: "move" as const,
			from: anchorPlaces[i],
			to: anchorPlaces[i + 1],
			legs: [],
			depart: tripStart,
			arrive: tripEnd,
		});
	}

	// 6. Interleave: move, stay, move, stay, …, move
	const segments: Segment[] = [];
	for (let i = 0; i < moves.length; i++) {
		segments.push(moves[i]);
		if (i < stays.length) segments.push(stays[i]);
	}

	return { meta: itinerary.trip, segments };
}
