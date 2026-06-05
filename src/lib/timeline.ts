import { IATA } from "~/lib/itinerary-helpers";
import type {
	BookingStatus,
	City,
	Flight,
	Hotel,
	IanaTimeZone,
	IataCode,
	Itinerary,
	Transfer,
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
	status: BookingStatus;
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

// === city helpers ===

const KNOWN_CITIES = new Set<string>([
	...Object.values(IATA),
	"Hvar",
	"Bath",
	"Heathrow",
]);

function resolveCity(name: string): City {
	const lower = name.toLowerCase();
	for (const city of KNOWN_CITIES) {
		if (lower.includes(city.toLowerCase())) return city as City;
	}
	const commaIdx = name.lastIndexOf(",");
	if (commaIdx !== -1) return name.slice(commaIdx + 1).trim() as City;
	const dashIdx = name.lastIndexOf(" - ");
	if (dashIdx !== -1) return name.slice(dashIdx + 3).trim() as City;
	return name as City;
}

function iataCity(code: string): City {
	return (IATA[code] ?? code) as City;
}

// === date helpers ===

function isoDate(v: string): string {
	return v.slice(0, 10);
}

// === place resolution ===

function resolvePlace(location: string, hotels: Hotel[]): Place {
	const iataMatch = location.match(/\(([A-Z]{3})\)/);
	if (iataMatch && IATA[iataMatch[1]]) {
		return {
			city: iataCity(iataMatch[1]),
			spot: { kind: "airport", code: iataMatch[1] as IataCode },
		};
	}
	const hotel = hotels.find((h) => h.name === location);
	if (hotel) {
		return {
			city: resolveCity(hotel.name),
			spot: { kind: "lodging", name: hotel.name },
		};
	}
	return {
		city: resolveCity(location),
		spot: { kind: "named", label: location },
	};
}

// === leg builders ===

function buildFlightLeg(flight: Flight): Leg {
	return {
		mode: "flight",
		from: {
			city: iataCity(flight.origin.code),
			spot: { kind: "airport", code: flight.origin.code },
		},
		to: {
			city: iataCity(flight.destination.code),
			spot: { kind: "airport", code: flight.destination.code },
		},
		depart: flight.depart,
		arrive: flight.arrive,
		status: flight.status,
	};
}

function buildTransferLeg(transfer: Transfer, hotels: Hotel[]): Leg {
	const from = resolvePlace(transfer.pickup.location, hotels);
	const to = transfer.dropoff
		? resolvePlace(transfer.dropoff.location, hotels)
		: from;

	const depart =
		transfer.pickup.datetime && transfer.pickup.timezone
			? {
					datetime: transfer.pickup.datetime,
					timezone: transfer.pickup.timezone,
				}
			: undefined;
	const arrive =
		transfer.dropoff?.datetime && transfer.dropoff?.timezone
			? {
					datetime: transfer.dropoff.datetime,
					timezone: transfer.dropoff.timezone,
				}
			: undefined;

	return {
		mode: transfer.type,
		from,
		to,
		...(depart ? { depart } : {}),
		...(arrive ? { arrive } : {}),
		status: transfer.status,
	};
}

// === leg ordering ===

function orderLegs(legs: Leg[], gapFromCity: City): Leg[] {
	const timed = legs
		.filter((l) => l.depart)
		.sort((a, b) =>
			(a.depart?.datetime ?? "") < (b.depart?.datetime ?? "") ? -1 : 1,
		);
	const untimed = legs.filter((l) => !l.depart);

	const result: Leg[] = [];
	const remainingTimed = [...timed];
	const remainingUntimed = [...untimed];
	let currentCity = gapFromCity;

	while (remainingTimed.length > 0 || remainingUntimed.length > 0) {
		const untimedIdx = remainingUntimed.findIndex(
			(l) => l.from.city === currentCity,
		);
		if (untimedIdx !== -1) {
			const leg = remainingUntimed.splice(untimedIdx, 1)[0];
			result.push(leg);
			currentCity = leg.to.city;
			continue;
		}
		if (remainingTimed.length > 0) {
			const timedIdx = remainingTimed.findIndex(
				(l) => l.from.city === currentCity,
			);
			const leg =
				timedIdx !== -1
					? remainingTimed.splice(timedIdx, 1)[0]
					: remainingTimed.shift();
			if (!leg) break;
			result.push(leg);
			currentCity = leg.to.city;
		} else {
			const leg = remainingUntimed.shift();
			if (!leg) break;
			result.push(leg);
			currentCity = leg.to.city;
		}
	}
	return result;
}

function insertInferredLegs(legs: Leg[]): Leg[] {
	const result: Leg[] = [];
	for (let i = 0; i < legs.length; i++) {
		result.push(legs[i]);
		if (i < legs.length - 1 && legs[i].to.city !== legs[i + 1].from.city) {
			result.push({
				mode: "transfer",
				from: legs[i].to,
				to: legs[i + 1].from,
				status: { kind: "to_book" },
				inferred: true,
			});
		}
	}
	return result;
}

// === main export ===

export function deriveTimeline(itinerary: Itinerary): Timeline {
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

	const homeCity = iataCity(itinerary.flights[0]?.origin.code ?? "");
	const homePlace: Place = { city: homeCity, spot: { kind: "home" } };

	const anchorPlaces: Place[] = [
		homePlace,
		...stays.map((s) => s.place),
		homePlace,
	];

	// Gap date windows: gap i runs from startDates[i] to endDates[i]
	const gapStartDates = [
		itinerary.trip.start_date,
		...sortedHotels.map((h) => h.check_out.date),
	];
	const gapEndDates = [
		...sortedHotels.map((h) => h.check_in.date),
		itinerary.trip.end_date,
	];

	const tz = (itinerary.trip.home_timezone ?? "UTC") as IanaTimeZone;
	const placeholder: ZonedDateTime = {
		datetime: `${itinerary.trip.start_date}T00:00:00`,
		timezone: tz,
	};

	const moves: ({ kind: "move" } & Move)[] = anchorPlaces
		.slice(0, -1)
		.map((from, i) => ({
			kind: "move" as const,
			from,
			to: anchorPlaces[i + 1],
			legs: [],
			depart: placeholder,
			arrive: placeholder,
		}));

	const findGapIndex = (datetime: string): number =>
		gapEndDates.findIndex(
			(end, i) =>
				isoDate(datetime) >= isoDate(gapStartDates[i]) &&
				isoDate(datetime) <= isoDate(end),
		);

	// Assign transports to gap indices
	const legsByGap: Leg[][] = Array.from({ length: moves.length }, () => []);

	for (const flight of itinerary.flights) {
		const idx = findGapIndex(flight.depart.datetime);
		if (idx !== -1) legsByGap[idx].push(buildFlightLeg(flight));
	}

	for (const transfer of itinerary.transfers) {
		const refDatetime = transfer.pickup.datetime ?? transfer.dropoff?.datetime;
		if (!refDatetime) continue;
		const idx = findGapIndex(refDatetime);
		if (idx !== -1)
			legsByGap[idx].push(buildTransferLeg(transfer, itinerary.hotels));
	}

	// Order legs, insert inferred, fix move depart/arrive
	for (let i = 0; i < moves.length; i++) {
		const ordered = orderLegs(legsByGap[i], moves[i].from.city);
		const withInferred = insertInferredLegs(ordered);
		moves[i].legs = withInferred;
		const firstDepart = withInferred.find((l) => l.depart);
		const lastArrive = [...withInferred].reverse().find((l) => l.arrive);
		if (firstDepart?.depart) moves[i].depart = firstDepart.depart;
		if (lastArrive?.arrive) moves[i].arrive = lastArrive.arrive;
	}

	const segments: Segment[] = [];
	for (let i = 0; i < moves.length; i++) {
		segments.push(moves[i]);
		if (i < stays.length) segments.push(stays[i]);
	}

	return { meta: itinerary.trip, segments };
}
