import type {
	FlightDoc,
	HotelDoc,
	ItineraryDoc,
	TransferDoc,
} from "~/lib/itinerary-doc";

export type IataCode = string & { readonly _brand: "IataCode" };
export type IanaTimeZone = string & { readonly _brand: "IanaTimeZone" };
export type City = string & { readonly _brand: "City" };
export type ConfirmationCode = string & { readonly _brand: "ConfirmationCode" };
export type FlightDesignator = string & { readonly _brand: "FlightDesignator" };

export type BookingStatus =
	| { kind: "confirmed"; confirmation?: ConfirmationCode }
	| { kind: "to_book" };

export type ZonedDateTime = { datetime: string; timezone: IanaTimeZone };

export type CheckIn = { date: string; after_time?: string };
export type CheckOut = { date: string; before_time?: string };

export type Airport = {
	code: IataCode;
	terminal?: string;
};

export type TripMeta = {
	title: string;
	traveler: string;
	start_date: string;
	end_date: string;
	home_timezone?: IanaTimeZone;
};

export type Flight = {
	status: BookingStatus;
	designator: FlightDesignator;
	confirmation?: ConfirmationCode;
	airline: string;
	origin: Airport;
	destination: Airport;
	depart: ZonedDateTime;
	arrive: ZonedDateTime;
	cabin?: string;
	seat?: string;
	notes?: string;
};

export type Hotel = {
	status: BookingStatus;
	name: string;
	confirmation?: ConfirmationCode;
	timezone: IanaTimeZone;
	check_in: CheckIn;
	check_out: CheckOut;
	notes?: string;
};

export type Transfer = {
	status: BookingStatus;
	type: string;
	provider?: string;
	pickup: { datetime?: string; timezone?: IanaTimeZone; location: string };
	dropoff?: { datetime?: string; timezone?: IanaTimeZone; location: string };
	notes?: string;
};

export type TripEvent = {
	status: BookingStatus;
	title: string;
	category?: string;
	start?: ZonedDateTime;
	location?: string;
	notes?: string;
};

export type Itinerary = {
	trip: TripMeta;
	flights: Flight[];
	hotels: Hotel[];
	transfers: Transfer[];
	events: TripEvent[];
};

function parseStatus(
	raw: string | undefined,
	confirmation: string | undefined,
): BookingStatus {
	if (raw === "confirmed") {
		return {
			kind: "confirmed",
			...(confirmation
				? { confirmation: confirmation as ConfirmationCode }
				: {}),
		};
	}
	return { kind: "to_book" };
}

function parseFlight(doc: FlightDoc): Flight {
	return {
		status: parseStatus(doc.status, doc.confirmation),
		designator: `${doc.airline_code}${doc.flight_number}` as FlightDesignator,
		...(doc.confirmation
			? { confirmation: doc.confirmation as ConfirmationCode }
			: {}),
		airline: doc.airline,
		origin: {
			code: doc.origin.airport as IataCode,
			...(doc.origin.terminal ? { terminal: doc.origin.terminal } : {}),
		},
		destination: {
			code: doc.destination.airport as IataCode,
			...(doc.destination.terminal
				? { terminal: doc.destination.terminal }
				: {}),
		},
		depart: {
			datetime: String(doc.depart.datetime),
			timezone: doc.depart.timezone as IanaTimeZone,
		},
		arrive: {
			datetime: String(doc.arrive.datetime),
			timezone: doc.arrive.timezone as IanaTimeZone,
		},
		...(doc.cabin ? { cabin: doc.cabin } : {}),
		...(doc.seat ? { seat: doc.seat } : {}),
		...(doc.notes ? { notes: doc.notes } : {}),
	};
}

function parseHotel(doc: HotelDoc): Hotel {
	return {
		status: parseStatus(doc.status, doc.confirmation),
		name: doc.name,
		...(doc.confirmation
			? { confirmation: doc.confirmation as ConfirmationCode }
			: {}),
		timezone: doc.timezone as IanaTimeZone,
		check_in: {
			date: String(doc.check_in.date),
			after_time: doc.check_in.after_time,
		},
		check_out: {
			date: String(doc.check_out.date),
			before_time: doc.check_out.before_time,
		},
		...(doc.notes ? { notes: doc.notes } : {}),
	};
}

function parseTransfer(doc: TransferDoc): Transfer {
	return {
		status: parseStatus(doc.status, doc.confirmation),
		type: doc.type,
		...(doc.provider ? { provider: doc.provider } : {}),
		pickup: {
			...(doc.pickup.datetime ? { datetime: String(doc.pickup.datetime) } : {}),
			...(doc.pickup.timezone
				? { timezone: doc.pickup.timezone as IanaTimeZone }
				: {}),
			location: doc.pickup.location,
		},
		...(doc.dropoff
			? {
					dropoff: {
						...(doc.dropoff.datetime
							? { datetime: String(doc.dropoff.datetime) }
							: {}),
						...(doc.dropoff.timezone
							? { timezone: doc.dropoff.timezone as IanaTimeZone }
							: {}),
						location: doc.dropoff.location,
					},
				}
			: {}),
		...(doc.notes ? { notes: doc.notes } : {}),
	};
}

export function parseItinerary(doc: ItineraryDoc): Itinerary {
	return {
		trip: {
			title: doc.trip.title,
			traveler: doc.trip.traveler,
			start_date: String(doc.trip.start_date),
			end_date: String(doc.trip.end_date),
			...(doc.trip.home_timezone
				? { home_timezone: doc.trip.home_timezone as IanaTimeZone }
				: {}),
		},
		flights: doc.flights.map(parseFlight),
		hotels: doc.hotels.map(parseHotel),
		transfers: doc.transfers.map(parseTransfer),
		events: doc.events.map((e) => ({
			status: parseStatus(e.status, undefined),
			title: e.title,
			...(e.category ? { category: e.category } : {}),
			...(e.start
				? {
						start: {
							datetime: String(e.start.datetime),
							timezone: e.start.timezone as IanaTimeZone,
						},
					}
				: {}),
			...(e.location ? { location: e.location } : {}),
			...(e.notes ? { notes: e.notes } : {}),
		})),
	};
}
