export type TripMetaDoc = {
	title: string;
	traveler: string;
	start_date: string;
	end_date: string;
	home_timezone?: string;
	notes?: string;
};

export type FlightDoc = {
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

export type HotelDoc = {
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

export type TransferDoc = {
	status?: string;
	type: string;
	provider?: string;
	confirmation?: string;
	pickup: { datetime?: string; timezone?: string; location: string };
	dropoff?: { datetime?: string; timezone?: string; location: string };
	notes?: string;
};

export type EventDoc = {
	status?: string;
	title: string;
	category?: string;
	start?: { datetime: string; timezone: string };
	location?: string;
	notes?: string;
};

export type ItineraryDoc = {
	trip: TripMetaDoc;
	flights: FlightDoc[];
	hotels: HotelDoc[];
	transfers: TransferDoc[];
	events: EventDoc[];
};
