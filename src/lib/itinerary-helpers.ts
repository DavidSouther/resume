import type { TripEnrichment } from "~/lib/trip-enrichment";
import type {
	Flight,
	GroundTransport,
	Hotel,
	Itinerary,
	TripEvent,
} from "~/lib/trip-itinerary";

export type TransferData = {
	dir: "in" | "out";
	airport: string;
	hotel: Hotel;
	city: string | null;
};

export type ItineraryItem =
	| { kind: "flight"; date: string; sortKey: number; data: Flight }
	| { kind: "hotel-in"; date: string; sortKey: number; data: Hotel }
	| { kind: "hotel-out"; date: string; sortKey: number; data: Hotel }
	| { kind: "ground"; date: string; sortKey: number; data: GroundTransport }
	| { kind: "event"; date: string; sortKey: number; data: TripEvent }
	| { kind: "transfer"; date: string; sortKey: number; data: TransferData };

export const IATA: Record<string, string> = {
	JFK: "New York",
	EWR: "New York",
	LGA: "New York",
	LHR: "London",
	LGW: "London",
	STN: "London",
	VIE: "Vienna",
	SPU: "Split",
	ZAG: "Zagreb",
	LAX: "Los Angeles",
	CDG: "Paris",
	ZRH: "Zurich",
};

export const TZAB: Record<string, [string, string]> = {
	"America/New_York": ["EST", "EDT"],
	"America/Los_Angeles": ["PST", "PDT"],
	"Europe/London": ["GMT", "BST"],
	"Europe/Vienna": ["CET", "CEST"],
	"Europe/Zagreb": ["CET", "CEST"],
	"Europe/Paris": ["CET", "CEST"],
	"Europe/Zurich": ["CET", "CEST"],
};

const DOW = [
	"Sunday",
	"Monday",
	"Tuesday",
	"Wednesday",
	"Thursday",
	"Friday",
	"Saturday",
];
const MON = [
	"Jan",
	"Feb",
	"Mar",
	"Apr",
	"May",
	"Jun",
	"Jul",
	"Aug",
	"Sep",
	"Oct",
	"Nov",
	"Dec",
];

export function parseHM(s: string | undefined | null): number | null {
	if (!s) return null;
	const m = String(s).match(/(\d{1,2}):(\d{2})/);
	return m ? +m[1] * 60 + +m[2] : null;
}

export function parseDateTime(
	s: string | undefined | null,
): { date: string; h: number; min: number } | null {
	if (!s) return null;
	const str = String(s);
	const m = str.match(/(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
	if (!m) return null;
	return { date: `${m[1]}-${m[2]}-${m[3]}`, h: +m[4], min: +m[5] };
}

export function fmtClock(h: number, min: number): string {
	const ap = h < 12 ? "AM" : "PM";
	const hh = h % 12 || 12;
	return `${hh}:${min < 10 ? "0" : ""}${min} ${ap}`;
}

export function fmtTimeStr(s: string | undefined | null): string {
	const v = parseHM(s);
	if (v === null) return String(s ?? "");
	return fmtClock(Math.floor(v / 60), v % 60);
}

export function tzAbbr(dateStr: string, tz: string | undefined): string {
	if (!tz) return "";
	if (TZAB[tz]) {
		const mo = +dateStr.split("-")[1];
		const dst = mo >= 4 && mo <= 10;
		return TZAB[tz][dst ? 1 : 0];
	}
	try {
		const f = new Intl.DateTimeFormat("en-US", {
			timeZone: tz,
			timeZoneName: "short",
			hour: "numeric",
		});
		const parts = f.formatToParts(new Date(`${dateStr}T12:00:00Z`));
		for (const p of parts) {
			if (p.type === "timeZoneName") return p.value;
		}
	} catch {
		// fall through
	}
	return "";
}

export function prettyDate(dateStr: string): string {
	const parts = String(dateStr).split("-").map(Number);
	return `${MON[parts[1] - 1]} ${parts[2]}`;
}

export function dowName(dateStr: string): string {
	return DOW[new Date(`${dateStr}T12:00:00`).getDay()];
}

export function rangeLabel(start: string, end: string): string {
	const [, am, ad] = String(start).split("-").map(Number);
	const [by, bm, bd] = String(end).split("-").map(Number);
	if (am === bm) return `${MON[am - 1]} ${ad}–${bd}, ${by}`;
	return `${MON[am - 1]} ${ad} – ${MON[bm - 1]} ${bd}, ${by}`;
}

export function initials(name: string | undefined | null): string {
	if (!name) return "✦";
	return name
		.trim()
		.split(/\s+/)
		.map((w) => w[0])
		.join("")
		.slice(0, 2)
		.toUpperCase();
}

export function dateKeyRange(start: string, end: string): string[] {
	const out: string[] = [];
	const a = new Date(`${String(start).slice(0, 10)}T12:00:00`);
	const b = new Date(`${String(end).slice(0, 10)}T12:00:00`);
	for (let t = a.getTime(); t <= b.getTime(); t += 864e5) {
		const d = new Date(t);
		out.push(
			`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`,
		);
	}
	return out;
}

export function buildItems(itinerary: Itinerary): ItineraryItem[] {
	const items: ItineraryItem[] = [];

	for (const f of itinerary.flights ?? []) {
		const dep = parseDateTime(f.depart?.datetime);
		if (!dep) continue;
		items.push({
			kind: "flight",
			date: dep.date,
			sortKey: dep.h * 60 + dep.min,
			data: f,
		});
	}

	for (const h of itinerary.hotels ?? []) {
		if (h.check_in?.date) {
			let sortKey = parseHM(h.check_in.after_time) ?? 15 * 60;
			for (const g of itinerary.ground_transportation ?? []) {
				const dropoffLoc = String(g.dropoff?.location ?? "").toLowerCase();
				if (!dropoffLoc.includes(h.name.toLowerCase())) continue;
				const pk = parseDateTime(g.pickup?.datetime);
				const dr = parseDateTime(g.dropoff?.datetime);
				const refTime = dr ?? pk;
				if (refTime && refTime.date === String(h.check_in.date)) {
					sortKey = Math.max(sortKey, refTime.h * 60 + refTime.min + 1);
				}
			}
			items.push({
				kind: "hotel-in",
				date: String(h.check_in.date),
				sortKey,
				data: h,
			});
		}
		if (h.check_out?.date) {
			let sortKey = parseHM(h.check_out.before_time) ?? 11 * 60;
			for (const g of itinerary.ground_transportation ?? []) {
				const pickupLoc = String(g.pickup?.location ?? "").toLowerCase();
				if (!pickupLoc.includes(h.name.toLowerCase())) continue;
				const pk = parseDateTime(g.pickup?.datetime);
				const dr = parseDateTime(g.dropoff?.datetime);
				const refTime = pk ?? dr;
				if (refTime && refTime.date === String(h.check_out.date)) {
					sortKey = Math.min(sortKey, refTime.h * 60 + refTime.min - 1);
				}
			}
			items.push({
				kind: "hotel-out",
				date: String(h.check_out.date),
				sortKey,
				data: h,
			});
		}
	}

	for (const g of itinerary.ground_transportation ?? []) {
		const pk = parseDateTime(g.pickup?.datetime);
		const dr = parseDateTime(g.dropoff?.datetime);
		const ref = pk ?? dr;
		if (!ref) continue;
		items.push({
			kind: "ground",
			date: ref.date,
			sortKey: ref.h * 60 + ref.min,
			data: g,
		});
	}

	for (const ev of itinerary.events ?? []) {
		const st = parseDateTime(ev.start?.datetime);
		if (!st) continue;
		items.push({
			kind: "event",
			date: st.date,
			sortKey: st.h * 60 + st.min,
			data: ev,
		});
	}

	return items;
}

export function synthesizeTransfers(
	itinerary: Itinerary,
	items: ItineraryItem[],
): ItineraryItem[] {
	const coveredAir = new Set<string>();
	for (const g of itinerary.ground_transportation ?? []) {
		for (const key of ["pickup", "dropoff"] as const) {
			const loc = g[key]?.location;
			if (!loc) continue;
			const mm = String(loc).match(/\(([A-Z]{3})\)/);
			if (!mm) continue;
			const airport = mm[1];
			const pk = parseDateTime(g.pickup?.datetime);
			const dr = parseDateTime(g.dropoff?.datetime);
			const dt = pk ?? dr;
			if (dt) {
				coveredAir.add(`${airport}-${dt.date}`);
			} else {
				coveredAir.add(airport);
			}
		}
	}

	function hotelOn(
		field: "check_in" | "check_out",
		date: string,
	): Hotel | null {
		for (const h of itinerary.hotels ?? []) {
			if (String(h[field]?.date) === date) return h;
		}
		return null;
	}

	const transfers: ItineraryItem[] = [];
	for (const f of itinerary.flights ?? []) {
		const dep = parseDateTime(f.depart?.datetime);
		const arr = parseDateTime(f.arrive?.datetime);

		if (arr) {
			const ac = f.destination?.airport;
			const hotel = ac ? hotelOn("check_in", arr.date) : null;
			if (
				ac &&
				hotel &&
				!coveredAir.has(`${ac}-${arr.date}`) &&
				!coveredAir.has(ac)
			) {
				// The transfer runs airport -> hotel, so it must sort after the
				// flight and before check-in. A hotel's after_time is only a policy
				// floor: a late flight can land past it, which would otherwise sort
				// the transfer below the check-in. Clamp it to just before check-in
				// (matching buildItems' hotel-in sortKey) so the order holds.
				const arrivalKey = arr.h * 60 + arr.min + 5;
				const checkInKey = parseHM(hotel.check_in?.after_time) ?? 15 * 60;
				transfers.push({
					kind: "transfer",
					date: arr.date,
					sortKey: Math.min(arrivalKey, checkInKey - 1),
					data: { dir: "in", airport: ac, hotel, city: IATA[ac] ?? null },
				});
			}
		}

		if (dep) {
			const dc = f.origin?.airport;
			const hotel = dc ? hotelOn("check_out", dep.date) : null;
			if (
				dc &&
				hotel &&
				!coveredAir.has(`${dc}-${dep.date}`) &&
				!coveredAir.has(dc)
			) {
				// Mirror of the arrival case: the transfer runs hotel -> airport, so
				// it must sort after check-out and before the flight. before_time is a
				// policy ceiling, so clamp the transfer to just after check-out
				// (matching buildItems' hotel-out sortKey).
				const departKey = Math.max(0, dep.h * 60 + dep.min - 5);
				const checkOutKey = parseHM(hotel.check_out?.before_time) ?? 11 * 60;
				transfers.push({
					kind: "transfer",
					date: dep.date,
					sortKey: Math.max(departKey, checkOutKey + 1),
					data: { dir: "out", airport: dc, hotel, city: IATA[dc] ?? null },
				});
			}
		}
	}

	return [...items, ...transfers];
}

function matchCity(
	name: string,
	enrichment?: TripEnrichment | null,
): string | null {
	if (!enrichment?.page_cards) return null;
	const lo = name.toLowerCase();
	for (const c of enrichment.page_cards) {
		if (c.city && lo.includes(c.city.toLowerCase())) return c.city;
	}
	return null;
}

export function overnight(
	itinerary: Itinerary,
	date: string,
): Hotel | Flight | null {
	for (const h of itinerary.hotels ?? []) {
		if (!h.check_in || !h.check_out) continue;
		const ci = String(h.check_in.date);
		const co = String(h.check_out.date);
		if (date >= ci && date < co) return h;
	}
	for (const f of itinerary.flights ?? []) {
		const dep = parseDateTime(f.depart?.datetime);
		const arr = parseDateTime(f.arrive?.datetime);
		if (dep && arr && dep.date === date && arr.date > date) return f;
	}
	return null;
}

export function dayCity(
	itinerary: Itinerary,
	date: string,
	enrichment?: TripEnrichment | null,
): string | null {
	const on = overnight(itinerary, date);
	if (on) {
		if ("check_in" in on) {
			const city = matchCity(on.name, enrichment);
			if (city) return city;
			// fall through to IATA lookup
		} else {
			return null; // overnight flight — transit day
		}
	}

	let best: Flight | null = null;
	let bestKey = "";
	for (const f of itinerary.flights ?? []) {
		const arr = parseDateTime(f.arrive?.datetime);
		if (arr && arr.date <= date && arr.date >= bestKey) {
			bestKey = arr.date;
			best = f;
		}
	}
	if (best) return IATA[best.destination?.airport ?? ""] ?? null;

	const f0 = itinerary.flights?.[0];
	if (f0) return IATA[f0.origin?.airport ?? ""] ?? null;

	return null;
}

export function ihgSearch(
	city: string,
	checkIn?: string,
	checkOut?: string,
): string {
	const base = `https://www.ihg.com/hotels/us/en/find-hotels/select-roomrate?qDest=${encodeURIComponent(city)}&qRms=1&qAdlt=2&qChld=0`;
	function part(d: string | undefined, pfx: string): string {
		if (!d) return "";
		const p = String(d).split("-");
		if (p.length < 3) return "";
		return `&${pfx}D=${+p[2]}&${pfx}My=${+p[1] - 1}${p[0]}`;
	}
	return base + part(checkIn, "qCi") + part(checkOut, "qCo");
}

export function mapsDir(origin: string, dest: string, mode: string): string {
	return `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(origin)}&destination=${encodeURIComponent(dest)}&travelmode=${mode}`;
}

export function braveSearch(query: string): string {
	return `https://search.brave.com/search?q=${encodeURIComponent(query)}`;
}
