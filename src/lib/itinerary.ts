// Raw types are unexported — private implementation detail of parseItinerary.
// Callers pass `unknown`; the parser owns the raw shape.

type RawTripMeta = {
	title: string;
	traveler: string;
	start_date: string;
	end_date: string;
	home_timezone?: string;
	notes?: string;
};

type RawFlight = {
	status?: string;
	confirmation?: string;
	airline: string;
	airline_code: string;
	flight_number: string;
	cabin?: string;
	seat?: string;
	origin: { airport: string; terminal?: string; gate?: string };
	destination: { airport: string; terminal?: string; gate?: string };
	depart: { datetime: string; timezone: string };
	arrive: { datetime: string; timezone: string };
	notes?: string;
};

type RawHotel = {
	status?: string;
	confirmation?: string;
	name: string;
	brand?: string;
	timezone: string;
	room_type?: string;
	check_in: { date: string; after_time?: string };
	check_out: { date: string; before_time?: string };
	notes?: string;
};

type RawTransfer = {
	status?: string;
	type: string;
	provider?: string;
	confirmation?: string;
	pickup: { datetime?: string; timezone?: string; location: string };
	dropoff?: { datetime?: string; timezone?: string; location: string };
	notes?: string;
};

type RawEvent = {
	status?: string;
	title: string;
	category?: string;
	start?: { datetime: string; timezone: string };
	location?: string;
	notes?: string;
};

type RawItinerary = {
	trip: RawTripMeta;
	flights: RawFlight[];
	hotels: RawHotel[];
	transfers: RawTransfer[];
	events: RawEvent[];
};

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

function parseFlight(doc: RawFlight): Flight {
	return {
		status: parseStatus(doc.status, doc.confirmation),
		designator: `${doc.airline_code}${doc.flight_number}` as FlightDesignator,
		confirmation: doc.confirmation as ConfirmationCode | undefined,
		airline: doc.airline,
		origin: {
			code: doc.origin.airport as IataCode,
			terminal: doc.origin.terminal,
		},
		destination: {
			code: doc.destination.airport as IataCode,
			terminal: doc.destination.terminal,
		},
		depart: {
			datetime: String(doc.depart.datetime),
			timezone: doc.depart.timezone as IanaTimeZone,
		},
		arrive: {
			datetime: String(doc.arrive.datetime),
			timezone: doc.arrive.timezone as IanaTimeZone,
		},
		cabin: doc.cabin,
		seat: doc.seat,
		notes: doc.notes,
	};
}

function parseHotel(doc: RawHotel): Hotel {
	return {
		status: parseStatus(doc.status, doc.confirmation),
		name: doc.name,
		confirmation: doc.confirmation as ConfirmationCode | undefined,
		timezone: doc.timezone as IanaTimeZone,
		check_in: {
			date: String(doc.check_in.date),
			after_time: doc.check_in.after_time,
		},
		check_out: {
			date: String(doc.check_out.date),
			before_time: doc.check_out.before_time,
		},
		notes: doc.notes,
	};
}

function parseTransfer(doc: RawTransfer): Transfer {
	return {
		status: parseStatus(doc.status, doc.confirmation),
		type: doc.type,
		provider: doc.provider,
		pickup: {
			datetime: doc.pickup.datetime,
			timezone: doc.pickup.timezone as IanaTimeZone | undefined,
			location: doc.pickup.location,
		},
		dropoff: doc.dropoff
			? {
					datetime: doc.dropoff.datetime,
					timezone: doc.dropoff.timezone as IanaTimeZone | undefined,
					location: doc.dropoff.location,
				}
			: undefined,
		notes: doc.notes,
	};
}

export function parseItinerary(raw: unknown): Itinerary {
	const doc = raw as RawItinerary;
	return {
		trip: {
			title: doc.trip.title,
			traveler: doc.trip.traveler,
			start_date: String(doc.trip.start_date),
			end_date: String(doc.trip.end_date),
			home_timezone: doc.trip.home_timezone as IanaTimeZone | undefined,
		},
		flights: (doc.flights ?? []).map(parseFlight),
		hotels: (doc.hotels ?? []).map(parseHotel),
		transfers: (doc.transfers ?? []).map(parseTransfer),
		events: (doc.events ?? []).map((e) => ({
			status: parseStatus(e.status, undefined),
			title: e.title,
			category: e.category,
			start: e.start
				? {
						datetime: String(e.start.datetime),
						timezone: e.start.timezone as IanaTimeZone,
					}
				: undefined,
			location: e.location,
			notes: e.notes,
		})),
	};
}
