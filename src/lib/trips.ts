import { readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cwd } from "node:process";
import { parse as parseYaml } from "yaml";
import type { TripEnrichment } from "./trip-enrichment";
import type { Itinerary } from "./trip-itinerary";

export type BookingStatus = "confirmed" | "to_book";

export type DateTimeWithTz = {
	datetime: string;
	timezone: string;
};

export type Trip = {
	id: string;
	title: string;
	date?: string;
	image?: string;
};

export function getTripPaths(): string[] {
	const tripsDir = join(cwd(), "trips");
	return readdirSync(tripsDir, { withFileTypes: true })
		.filter((entry) => entry.isDirectory())
		.map((entry) => entry.name);
}

export async function getSortedTrips(): Promise<Trip[]> {
	const trips = await Promise.all(
		getTripPaths().map(async (id) => {
			const raw = await readFile(
				join(cwd(), "trips", id, "itinerary.yaml"),
				{encoding: "utf-8"},
			);
			const itinerary = parseYaml(raw) as Itinerary;
			return {
				id,
				title: itinerary.trip.title,
				date: itinerary.trip.start_date,
				image: itinerary.trip.cover_image,
			} satisfies Trip;
		}),
	);

	trips.sort(({ date: a = "2999" }, { date: b = "2999" }) =>
		a.localeCompare(b),
	);
	trips.reverse();
	return trips;
}

export async function getTrip(id: string): Promise<Trip> {
	const [raw] = await Promise.all([
		readFile(join(cwd(), "trips", id, "itinerary.yaml"), "utf-8"),
		getTripEnrichment(id),
	]);
	const itinerary = parseYaml(raw) as Itinerary;
	return {
		id,
		title: itinerary.trip.title,
		date: itinerary.trip.start_date,
		image: itinerary.trip.cover_image,
	} satisfies Trip;
}

export async function getTripEnrichment(
	id: string,
): Promise<TripEnrichment | null> {
	try {
		const raw = readFileSync(
			join(cwd(), "trips", id, "enrichment.yaml"),
			"utf-8",
		);
		return parseYaml(raw) as TripEnrichment;
	} catch {
		return null;
	}
}
