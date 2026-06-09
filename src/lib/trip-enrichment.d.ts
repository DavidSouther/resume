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

// Lifecycle of a prep concern. Surfaced (raw or humanized) by the render layer.
export type PrepStatus = "action_needed" | "in_progress" | "done" | "no_action";

// A traveler's document STATUS/METADATA only. Invariant (design §Privacy):
// never holds a passport/visa/ETA reference number, never an exact DOB;
// `valid_until` is coarse "YYYY-MM" by rule, never an exact day. `note` is
// advisory and is covered by the same secret-pattern guardrail.
export type TravelDocument = {
	type:
		| "passport"
		| "uk_eta"
		| "etias"
		| "schengen_visa"
		| "global_entry"
		| string;
	status?: PrepStatus;
	issuing_country?: string; // ISO 3166-1 alpha-2, e.g. "US"
	valid_until?: string; // coarse "YYYY-MM" only
	note?: string; // advisory only
};

// A party member. `name` matches a name in the itinerary's party;
// `passport_country` drives entry-rule reminders. Lives in `meta.travelers`
// (central status registry).
export type Traveler = {
	name: string;
	passport_country?: string; // ISO 3166-1 alpha-2
	documents?: TravelDocument[];
};

// One advisory "before you go" line. Invariant: a rule-bearing item must carry
// a gov/europa `url` and must NOT restate the rule as settled fact.
// `lead_time_days`/`warn_lead_days` feed the pure deadline derivation.
export type PrepItem = {
	label: string;
	status?: PrepStatus;
	url?: string; // authoritative government source
	detail?: string; // advisory text; never the rule-as-fact
	applies_to?: string[]; // traveler names and/or city labels
	lead_time_days?: number; // must reach `done` this many days before departure
	warn_lead_days?: number; // begin warning this many days before that deadline (default 7)
};

// The advisory layer. `checked_on` (YYYY-MM-DD) is the verification date the
// skill stamps; the render layer derives a departure-relative staleness band
// from it. Invariant: entirely optional; absence renders nothing.
export type TripPrep = {
	checked_on?: string; // YYYY-MM-DD
	summary?: string;
	checklist?: PrepItem[];
	notes?: string[];
	sources?: { title: string; url: string }[];
};

export type TripEnrichment = {
	meta?: {
		trip_ref: string;
		wikipedia_summary_api_pattern?: string;
		flightaware_pattern?: string;
		travelers?: Traveler[]; // central traveler-document registry (status/metadata only)
	};
	page_cards?: PageCard[];
	flights?: FlightEnrichment[];
	hotels?: HotelEnrichment[];
	destinations?: Destination[];
	activities?: ActivityEnrichment[];
	trip_prep?: TripPrep; // advisory "before you go" layer
};
