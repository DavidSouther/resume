type WikipediaRef = {
	title: string;
	url: string;
	summary_api?: string;
};

export type PageCard = {
	city: string;
	title: string;
	subtitle: string;
	hero_image_query: string;
	wikipedia: WikipediaRef;
};

export type FlightEnrichment = {
	flight: string;
	airline_status_url?: string;
	tracker_url?: string;
};

export type HotelEnrichment = {
	hotel: string;
	status?: BookingStatus;
	website?: string;
	address?: string;
	phone?: string;
	map_url?: string;
	image_query?: string;
	blurb?: string;
};

export type Destination = {
	name: string;
	wikipedia: WikipediaRef;
	image_query?: string;
	blurb?: string;
};

export type ActivityEnrichment = {
	event: string;
	destination_ref?: string;
	official_url?: string;
	image_query?: string;
	blurb?: string;
	tips?: string;
};

export type TripEnrichment = {
	meta?: {
		trip_ref: string;
		wikipedia_summary_api_pattern?: string;
		flightaware_pattern?: string;
	};
	page_cards?: PageCard[];
	flights?: FlightEnrichment[];
	hotels?: HotelEnrichment[];
	destinations?: Destination[];
	activities?: ActivityEnrichment[];
};
