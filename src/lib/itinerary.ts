export type IataCode = string & { readonly _brand: "IataCode" };
export type IanaTimeZone = string & { readonly _brand: "IanaTimeZone" };
export type City = string & { readonly _brand: "City" };
export type ConfirmationCode = string & { readonly _brand: "ConfirmationCode" };
export type FlightDesignator = string & { readonly _brand: "FlightDesignator" };

export type BookingStatus =
	| { kind: "confirmed"; confirmation?: ConfirmationCode }
	| { kind: "to_book" };

export type ZonedDateTime = { datetime: string; timezone: IanaTimeZone };

export type TripMeta = {
	/* stub */
};
export type Flight = { status: BookingStatus /* stub */ };
export type Hotel = {
	/* stub */
};
export type Transfer = {
	/* stub */
};
export type TripEvent = {
	/* stub */
};

export type Itinerary = {
	trip: TripMeta;
	flights: Flight[];
	hotels: Hotel[];
	transfers: Transfer[];
	events: TripEvent[];
};

import type { ItineraryDoc } from "~/lib/itinerary-doc";
export function parseItinerary(_doc: ItineraryDoc): Itinerary {
	throw new Error("not implemented");
}
