import type { Flight } from "~/lib/trip-itinerary";
import { parseDateTime } from "./itinerary-helpers.ts";

// Country per IATA airport, used only to pick the airport-arrival buffer
// (international vs domestic). Extend as new airports appear in itineraries.
export const AIRPORT_COUNTRY: Record<string, string> = {
	JFK: "US",
	EWR: "US",
	LGA: "US",
	LAX: "US",
	LHR: "GB",
	LGW: "GB",
	STN: "GB",
	VIE: "AT",
	SPU: "HR",
	ZAG: "HR",
	CDG: "FR",
	ZRH: "CH",
};

// Airport buffers: how early to be at the airport before departure.
export const INTERNATIONAL_BUFFER_MIN = 180;
export const DOMESTIC_BUFFER_MIN = 120;

// International when both airports map to known, different countries. An unknown
// country defaults to international — the longer, safer buffer.
export function isInternationalFlight(origin?: string, dest?: string): boolean {
	const a = AIRPORT_COUNTRY[origin ?? ""];
	const b = AIRPORT_COUNTRY[dest ?? ""];
	if (!a || !b) return true;
	return a !== b;
}

export function airportBufferMinutes(international: boolean): number {
	return international ? INTERNATIONAL_BUFFER_MIN : DOMESTIC_BUFFER_MIN;
}

export type WallClock = { date: string; hours: number; minutes: number };

// Subtract minutes from a local wall-clock "YYYY-MM-DDTHH:MM[:SS]" string,
// rolling back across midnight. Computed in UTC purely as fixed-offset clock
// arithmetic; the result is still a local wall-clock time (no zone conversion).
export function subtractMinutes(
	datetime: string | undefined | null,
	minutes: number,
): WallClock | null {
	const parsed = parseDateTime(datetime);
	if (!parsed) return null;
	const [year, month, day] = parsed.date.split("-").map(Number);
	const base = Date.UTC(year, month - 1, day, parsed.hours, parsed.minutes);
	const shifted = new Date(base - minutes * 60_000);
	return {
		date: `${shifted.getUTCFullYear()}-${String(shifted.getUTCMonth() + 1).padStart(2, "0")}-${String(shifted.getUTCDate()).padStart(2, "0")}`,
		hours: shifted.getUTCHours(),
		minutes: shifted.getUTCMinutes(),
	};
}

export type LeaveByPlan = {
	leaveBy: WallClock; // depart − (buffer + transfer)
	arriveBy: WallClock; // depart − buffer
	bufferMin: number;
	transferMin: number;
	international: boolean;
};

// Work backward from a flight's departure: be at the airport `buffer` early
// (3h international / 2h domestic), and leave the hotel a further `transferMin`
// before that.
export function departureLeaveBy(
	flight: Flight,
	transferMin: number,
): LeaveByPlan | null {
	const international = isInternationalFlight(
		flight.origin?.airport,
		flight.destination?.airport,
	);
	const bufferMin = airportBufferMinutes(international);
	const arriveBy = subtractMinutes(flight.depart?.datetime, bufferMin);
	const leaveBy = subtractMinutes(
		flight.depart?.datetime,
		bufferMin + transferMin,
	);
	if (!arriveBy || !leaveBy) return null;
	return { leaveBy, arriveBy, bufferMin, transferMin, international };
}

const pad2 = (n: number) => String(n).padStart(2, "0");

// RFC 5545 floating local time (no Z, no TZID): calendars show it at this
// wall-clock time regardless of device zone — the right semantics for "leave at
// 8:50 local".
function icsStamp(clock: WallClock): string {
	return `${clock.date.replace(/-/g, "")}T${pad2(clock.hours)}${pad2(clock.minutes)}00`;
}

// Escape per RFC 5545 §3.3.11 (backslash, semicolon, comma, newlines).
function icsEscape(text: string): string {
	return text
		.replace(/\\/g, "\\\\")
		.replace(/;/g, "\\;")
		.replace(/,/g, "\\,")
		.replace(/\r?\n/g, "\\n");
}

export type CalendarEvent = {
	uid: string; // deterministic; keeps rebuilt output stable
	title: string;
	start: WallClock;
	end?: WallClock;
	description?: string;
	location?: string;
};

// A downloadable single-event calendar as a data: URI. Includes a DISPLAY alarm
// at the start so the event itself is the "leave now" reminder. Deterministic:
// DTSTAMP is derived from the start, never the wall clock, so rebuilds are
// byte-stable (docs/ is committed).
export function icsDataUri(event: CalendarEvent): string {
	const lines = [
		"BEGIN:VCALENDAR",
		"VERSION:2.0",
		"PRODID:-//davidsouther//resume-trips//EN",
		"BEGIN:VEVENT",
		`UID:${event.uid}`,
		`DTSTAMP:${icsStamp(event.start)}`,
		`DTSTART:${icsStamp(event.start)}`,
		`DTEND:${icsStamp(event.end ?? event.start)}`,
		`SUMMARY:${icsEscape(event.title)}`,
	];
	if (event.description)
		lines.push(`DESCRIPTION:${icsEscape(event.description)}`);
	if (event.location) lines.push(`LOCATION:${icsEscape(event.location)}`);
	lines.push(
		"BEGIN:VALARM",
		"ACTION:DISPLAY",
		`DESCRIPTION:${icsEscape(event.title)}`,
		"TRIGGER:PT0S",
		"END:VALARM",
		"END:VEVENT",
		"END:VCALENDAR",
	);
	const ics = `${lines.join("\r\n")}\r\n`;
	return `data:text/calendar;charset=utf-8,${encodeURIComponent(ics)}`;
}
