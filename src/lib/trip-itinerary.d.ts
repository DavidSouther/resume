type Airport = {
	airport: string;
	terminal?: string;
	gate?: string;
};

export type Flight = {
	status?: BookingStatus;
	confirmation?: string;
	airline: string;
	airline_code: string;
	flight_number: string;
	origin: Airport;
	destination: Airport;
	depart: DateTimeWithTz;
	arrive: DateTimeWithTz;
	seat?: string;
	cabin?: string;
	notes?: string;
};

type CheckIn = {
	date: string;
	after_time?: string;
};

type CheckOut = {
	date: string;
	before_time?: string;
};

export type Hotel = {
	status?: BookingStatus;
	confirmation?: string;
	name: string;
	brand?: string;
	address?: string;
	phone?: string;
	timezone: string;
	check_in: CheckIn;
	check_out: CheckOut;
	room_type?: string;
	notes?: string;
};

export type GroundTransportationType =
	| "rental"
	| "rideshare"
	| "taxi"
	| "transfer"
	| "train"
	| "shuttle";

type TransportStop = {
	datetime?: string;
	timezone?: string;
	location: string;
};

export type GroundTransport = {
	status?: BookingStatus;
	type: GroundTransportationType;
	provider?: string;
	confirmation?: string;
	pickup: TransportStop;
	dropoff?: TransportStop;
	notes?: string;
};

export type EventCategory =
	| "meeting"
	| "meal"
	| "activity"
	| "reminder"
	| "other";

export type TripEvent = {
	status?: BookingStatus;
	title: string;
	category?: EventCategory;
	start: DateTimeWithTz;
	end?: { datetime?: string; timezone?: string };
	location?: string;
	notes?: string;
};

type ItineraryMeta = {
	title: string;
	traveler: string;
	start_date: string;
	end_date: string;
	cover_image?: string;
	home_timezone?: string;
	notes?: string;
};

export type Itinerary = {
	trip: ItineraryMeta;
	flights: Flight[];
	hotels: Hotel[];
	ground_transportation: GroundTransport[];
	events: TripEvent[];
};
