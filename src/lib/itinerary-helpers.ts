import type { TripEnrichment } from "~/lib/trip-enrichment";
import type {
	Flight,
	GroundTransport,
	Hotel,
	Itinerary,
	TripEvent,
} from "~/lib/trip-itinerary";

export type TransferData = {
	dir: "in" | "out";
	airport: string;
	hotel: Hotel;
	city: string | null;
	flight?: Flight; // the flight this transfer feeds (out) or follows (in)
};

export type ItineraryItem =
	| { kind: "flight"; date: string; sortKey: number; data: Flight }
	| { kind: "hotel-in"; date: string; sortKey: number; data: Hotel }
	| { kind: "hotel-out"; date: string; sortKey: number; data: Hotel }
	| { kind: "ground"; date: string; sortKey: number; data: GroundTransport }
	| { kind: "event"; date: string; sortKey: number; data: TripEvent }
	| { kind: "transfer"; date: string; sortKey: number; data: TransferData };

export const IATA: Record<string, string> = {
	JFK: "New York",
	EWR: "New York",
	LGA: "New York",
	LHR: "London",
	LGW: "London",
	STN: "London",
	VIE: "Vienna",
	SPU: "Split",
	ZAG: "Zagreb",
	LAX: "Los Angeles",
	CDG: "Paris",
	ZRH: "Zurich",
};

export const TIMEZONE_ABBREVIATIONS: Record<string, [string, string]> = {
	"America/New_York": ["EST", "EDT"],
	"America/Los_Angeles": ["PST", "PDT"],
	"Europe/London": ["GMT", "BST"],
	"Europe/Vienna": ["CET", "CEST"],
	"Europe/Zagreb": ["CET", "CEST"],
	"Europe/Paris": ["CET", "CEST"],
	"Europe/Zurich": ["CET", "CEST"],
};

const DAYS_OF_WEEK = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];
const MONTHS = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

export function parseHoursMinutes(
	timeString: string | undefined | null,
): number | null {
	if (!timeString) return null;
	const match = String(timeString).match(/(\d{1,2}):(\d{2})/);
	return match ? +match[1] * 60 + +match[2] : null;
}

export function parseDateTime(
	dateTimeString: string | undefined | null,
): { date: string; hours: number; minutes: number } | null {
	if (!dateTimeString) return null;
	const value = String(dateTimeString);
	const match = value.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
	if (!match) return null;
	return {
		date: `${match[1]}-${match[2]}-${match[3]}`,
		hours: +match[4],
		minutes: +match[5],
	};
}

export function formatClock(hours: number, minutes: number): string {
	const amPm = hours < 12 ? "AM" : "PM";
	const displayHour = hours % 12 || 12;
	return `${displayHour}:${minutes < 10 ? "0" : ""}${minutes} ${amPm}`;
}

export function formatTimeString(
	timeString: string | undefined | null,
): string {
	const totalMinutes = parseHoursMinutes(timeString);
	if (totalMinutes === null) return String(timeString ?? "");
	return formatClock(Math.floor(totalMinutes / 60), totalMinutes % 60);
}

export function timezoneAbbreviation(
	dateStr: string,
	tz: string | undefined,
): string {
	if (!tz) return "";
	if (TIMEZONE_ABBREVIATIONS[tz]) {
		const month = +dateStr.split("-")[1];
		const dst = month >= 4 && month <= 10;
		return TIMEZONE_ABBREVIATIONS[tz][dst ? 1 : 0];
	}
	try {
		const formatter = new Intl.DateTimeFormat("en-US", {
			timeZone: tz,
			timeZoneName: "short",
			hour: "numeric",
		});
		const parts = formatter.formatToParts(new Date(`${dateStr}T12:00:00Z`));
		for (const part of parts) {
			if (part.type === "timeZoneName") return part.value;
		}
	} catch {
		// fall through
	}
	return "";
}

export function prettyDate(dateStr: string): string {
	const parts = String(dateStr).split("-").map(Number);
	return `${MONTHS[parts[1] - 1]} ${parts[2]}`;
}

export function dayOfWeekName(dateStr: string): string {
	return DAYS_OF_WEEK[new Date(`${dateStr}T12:00:00`).getDay()];
}

export function rangeLabel(start: string, end: string): string {
	const [, startMonth, startDay] = String(start).split("-").map(Number);
	const [endYear, endMonth, endDay] = String(end).split("-").map(Number);
	if (startMonth === endMonth)
		return `${MONTHS[startMonth - 1]} ${startDay}–${endDay}, ${endYear}`;
	return `${MONTHS[startMonth - 1]} ${startDay} – ${MONTHS[endMonth - 1]} ${endDay}, ${endYear}`;
}

export function initials(name: string | undefined | null): string {
	if (!name) return "✦";
	return name
		.trim()
		.split(/\s+/)
		.map((word) => word[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

export function dateKeyRange(start: string, end: string): string[] {
	const dates: string[] = [];
	const startDate = new Date(`${String(start).slice(0, 10)}T12:00:00`);
	const endDate = new Date(`${String(end).slice(0, 10)}T12:00:00`);
	for (
		let timestamp = startDate.getTime();
		timestamp <= endDate.getTime();
		timestamp += 864e5
	) {
		const currentDate = new Date(timestamp);
		dates.push(
			`${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, "0")}-${String(currentDate.getDate()).padStart(2, "0")}`,
		);
	}
	return dates;
}

export function buildItems(itinerary: Itinerary): ItineraryItem[] {
	const items: ItineraryItem[] = [];

	for (const flight of itinerary.flights ?? []) {
		const departure = parseDateTime(flight.depart?.datetime);
		if (!departure) continue;
		items.push({
			kind: "flight",
			date: departure.date,
			sortKey: departure.hours * 60 + departure.minutes,
			data: flight,
		});
	}

	for (const hotel of itinerary.hotels ?? []) {
		if (hotel.check_in?.date) {
			let sortKey = parseHoursMinutes(hotel.check_in.after_time) ?? 15 * 60;
			for (const ground of itinerary.ground_transportation ?? []) {
				const dropoffLoc = String(ground.dropoff?.location ?? "").toLowerCase();
				if (!dropoffLoc.includes(hotel.name.toLowerCase())) continue;
				const pickupDateTime = parseDateTime(ground.pickup?.datetime);
				const dropoffDateTime = parseDateTime(ground.dropoff?.datetime);
				const referenceDateTime = dropoffDateTime ?? pickupDateTime;
				if (
					referenceDateTime &&
					referenceDateTime.date === String(hotel.check_in.date)
				) {
					sortKey = Math.max(
						sortKey,
						referenceDateTime.hours * 60 + referenceDateTime.minutes + 1,
					);
				}
			}
			items.push({
				kind: "hotel-in",
				date: String(hotel.check_in.date),
				sortKey,
				data: hotel,
			});
		}
		if (hotel.check_out?.date) {
			let sortKey = parseHoursMinutes(hotel.check_out.before_time) ?? 11 * 60;
			for (const ground of itinerary.ground_transportation ?? []) {
				const pickupLoc = String(ground.pickup?.location ?? "").toLowerCase();
				if (!pickupLoc.includes(hotel.name.toLowerCase())) continue;
				const pickupDateTime = parseDateTime(ground.pickup?.datetime);
				const dropoffDateTime = parseDateTime(ground.dropoff?.datetime);
				const referenceDateTime = pickupDateTime ?? dropoffDateTime;
				if (
					referenceDateTime &&
					referenceDateTime.date === String(hotel.check_out.date)
				) {
					sortKey = Math.min(
						sortKey,
						referenceDateTime.hours * 60 + referenceDateTime.minutes - 1,
					);
				}
			}
			items.push({
				kind: "hotel-out",
				date: String(hotel.check_out.date),
				sortKey,
				data: hotel,
			});
		}
	}

	for (const ground of itinerary.ground_transportation ?? []) {
		const pickupDateTime = parseDateTime(ground.pickup?.datetime);
		const dropoffDateTime = parseDateTime(ground.dropoff?.datetime);
		const referenceDateTime = pickupDateTime ?? dropoffDateTime;
		if (!referenceDateTime) continue;
		items.push({
			kind: "ground",
			date: referenceDateTime.date,
			sortKey: referenceDateTime.hours * 60 + referenceDateTime.minutes,
			data: ground,
		});
	}

	for (const tripEvent of itinerary.events ?? []) {
		const startDateTime = parseDateTime(tripEvent.start?.datetime);
		if (!startDateTime) continue;
		items.push({
			kind: "event",
			date: startDateTime.date,
			sortKey: startDateTime.hours * 60 + startDateTime.minutes,
			data: tripEvent,
		});
	}

	return items;
}

export function synthesizeTransfers(
	itinerary: Itinerary,
	items: ItineraryItem[],
): ItineraryItem[] {
	const coveredAir = new Set<string>();
	for (const ground of itinerary.ground_transportation ?? []) {
		for (const key of ["pickup", "dropoff"] as const) {
			const loc = ground[key]?.location;
			if (!loc) continue;
			const airportMatch = String(loc).match(/\(([A-Z]{3})\)/);
			if (!airportMatch) continue;
			const airport = airportMatch[1];
			const pickupDateTime = parseDateTime(ground.pickup?.datetime);
			const dropoffDateTime = parseDateTime(ground.dropoff?.datetime);
			const dateTime = pickupDateTime ?? dropoffDateTime;
			if (dateTime) {
				coveredAir.add(`${airport}-${dateTime.date}`);
			} else {
				coveredAir.add(airport);
			}
		}
	}

	function hotelOn(
		field: "check_in" | "check_out",
		date: string,
	): Hotel | null {
		for (const hotel of itinerary.hotels ?? []) {
			if (String(hotel[field]?.date) === date) return hotel;
		}
		return null;
	}

	const transfers: ItineraryItem[] = [];
	for (const flight of itinerary.flights ?? []) {
		const departure = parseDateTime(flight.depart?.datetime);
		const arrival = parseDateTime(flight.arrive?.datetime);

		if (arrival) {
			const destinationAirportCode = flight.destination?.airport;
			const hotel = destinationAirportCode
				? hotelOn("check_in", arrival.date)
				: null;
			if (
				destinationAirportCode &&
				hotel &&
				!coveredAir.has(`${destinationAirportCode}-${arrival.date}`) &&
				!coveredAir.has(destinationAirportCode)
			) {
				// The transfer runs airport -> hotel, so it must sort after the
				// flight and before check-in. A hotel's after_time is only a policy
				// floor: a late flight can land past it, which would otherwise sort
				// the transfer below the check-in. Clamp it to just before check-in
				// (matching buildItems' hotel-in sortKey) so the order holds.
				const arrivalKey = arrival.hours * 60 + arrival.minutes + 5;
				const checkInKey =
					parseHoursMinutes(hotel.check_in?.after_time) ?? 15 * 60;
				transfers.push({
					kind: "transfer",
					date: arrival.date,
					sortKey: Math.min(arrivalKey, checkInKey - 1),
					data: {
						dir: "in",
						airport: destinationAirportCode,
						hotel,
						city: IATA[destinationAirportCode] ?? null,
						flight,
					},
				});
			}
		}

		if (departure) {
			const originAirportCode = flight.origin?.airport;
			const hotel = originAirportCode
				? hotelOn("check_out", departure.date)
				: null;
			if (
				originAirportCode &&
				hotel &&
				!coveredAir.has(`${originAirportCode}-${departure.date}`) &&
				!coveredAir.has(originAirportCode)
			) {
				// Mirror of the arrival case: the transfer runs hotel -> airport, so
				// it must sort after check-out and before the flight. before_time is a
				// policy ceiling, so clamp the transfer to just after check-out
				// (matching buildItems' hotel-out sortKey).
				const departKey = Math.max(
					0,
					departure.hours * 60 + departure.minutes - 5,
				);
				const checkOutKey =
					parseHoursMinutes(hotel.check_out?.before_time) ?? 11 * 60;
				transfers.push({
					kind: "transfer",
					date: departure.date,
					sortKey: Math.max(departKey, checkOutKey + 1),
					data: {
						dir: "out",
						airport: originAirportCode,
						hotel,
						city: IATA[originAirportCode] ?? null,
						flight,
					},
				});
			}
		}
	}

	return [...items, ...transfers];
}

function matchCity(
	name: string,
	enrichment?: TripEnrichment | null,
): string | null {
	if (!enrichment?.page_cards) return null;
	const lowercaseName = name.toLowerCase();
	for (const card of enrichment.page_cards) {
		if (card.city && lowercaseName.includes(card.city.toLowerCase()))
			return card.city;
	}
	return null;
}

export function overnight(
	itinerary: Itinerary,
	date: string,
): Hotel | Flight | null {
	for (const hotel of itinerary.hotels ?? []) {
		if (!hotel.check_in || !hotel.check_out) continue;
		const checkInDate = String(hotel.check_in.date);
		const checkOutDate = String(hotel.check_out.date);
		if (date >= checkInDate && date < checkOutDate) return hotel;
	}
	for (const flight of itinerary.flights ?? []) {
		const departure = parseDateTime(flight.depart?.datetime);
		const arrival = parseDateTime(flight.arrive?.datetime);
		if (departure && arrival && departure.date === date && arrival.date > date)
			return flight;
	}
	return null;
}

export function dayCity(
	itinerary: Itinerary,
	date: string,
	enrichment?: TripEnrichment | null,
): string | null {
	const on = overnight(itinerary, date);
	if (on) {
		if ("check_in" in on) {
			const city = matchCity(on.name, enrichment);
			if (city) return city;
			// fall through to IATA lookup
		} else {
			return null; // overnight flight — transit day
		}
	}

	let best: Flight | null = null;
	let bestKey = "";
	for (const flight of itinerary.flights ?? []) {
		const arrival = parseDateTime(flight.arrive?.datetime);
		if (arrival && arrival.date <= date && arrival.date >= bestKey) {
			bestKey = arrival.date;
			best = flight;
		}
	}
	if (best) return IATA[best.destination?.airport ?? ""] ?? null;

	const firstFlight = itinerary.flights?.[0];
	if (firstFlight) return IATA[firstFlight.origin?.airport ?? ""] ?? null;

	return null;
}

export function ihgSearch(
	city: string,
	checkIn?: string,
	checkOut?: string,
): string {
	const base = `https://www.ihg.com/hotels/us/en/find-hotels/select-roomrate?qDest=${encodeURIComponent(city)}&qRms=1&qAdlt=2&qChld=0`;
	function part(dateString: string | undefined, prefix: string): string {
		if (!dateString) return "";
		const dateParts = String(dateString).split("-");
		if (dateParts.length < 3) return "";
		return `&${prefix}D=${+dateParts[2]}&${prefix}My=${+dateParts[1] - 1}${dateParts[0]}`;
	}
	return base + part(checkIn, "qCi") + part(checkOut, "qCo");
}

export function mapsDir(origin: string, dest: string, mode: string): string {
	return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&travelmode=${mode}`;
}

export function braveSearch(query: string): string {
	return `https://search.brave.com/search?q=${encodeURIComponent(query)}`;
}
