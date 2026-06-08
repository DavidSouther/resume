import { readdirSync, readFileSync } from "node:fs";
import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { cwd } from "node:process";
import { parse as parseYaml } from "yaml";
import type { TripEnrichment } from "./trip-enrichment";
import type { Itinerary } from "./trip-itinerary";
import {
	buildWikiData,
	emptyWikiData,
	type WikiCache,
	type WikiData,
} from "./wiki-cache.ts";

export type BookingStatus = "confirmed" | "to_book";

export type DateTimeWithTz = {
	datetime?: string;
	timezone?: string;
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
			const raw = await readFile(join(cwd(), "trips", id, "itinerary.yaml"), {
				encoding: "utf-8",
			});
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

export async function getTripItinerary(id: string): Promise<{
	itinerary: Itinerary;
	enrichment: TripEnrichment | undefined;
	wiki: WikiData;
}> {
	const raw = await readFile(
		join(cwd(), "trips", id, "itinerary.yaml"),
		"utf-8",
	);
	const itinerary = parseYaml(raw) as Itinerary;
	let enrichment: TripEnrichment | undefined;
	try {
		const enrichRaw = readFileSync(
			join(cwd(), "trips", id, "enrichment.yaml"),
			"utf-8",
		);
		enrichment = parseYaml(enrichRaw) as TripEnrichment;
	} catch {
		enrichment = undefined;
	}
	// The wiki cache is best-effort, mirroring enrichment: a missing or
	// unparseable file yields an empty lookup so `wiki` is always present and
	// callers never null-check the lookup itself.
	let wiki: WikiData = emptyWikiData();
	try {
		const cacheRaw = readFileSync(
			join(cwd(), "trips", id, "wiki-cache.json"),
			"utf-8",
		);
		const cache = JSON.parse(cacheRaw) as WikiCache;
		wiki = buildWikiData(cache.entries ?? {});
	} catch {
		wiki = emptyWikiData();
	}
	return { itinerary, enrichment, wiki };
}
