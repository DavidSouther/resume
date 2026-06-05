export type TripMetaDoc = {
	/* stub */
};
export type FlightDoc = {
	/* stub */
};
export type HotelDoc = {
	/* stub */
};
export type TransferDoc = {
	/* stub */
};
export type EventDoc = {
	/* stub */
};

export type ItineraryDoc = {
	trip: TripMetaDoc;
	flights: FlightDoc[];
	hotels: HotelDoc[];
	transfers: TransferDoc[];
	events: EventDoc[];
};
