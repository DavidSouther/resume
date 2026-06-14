import { describe, expect, it } from "vitest";
import type { Flight } from "~/lib/trip-itinerary";
import {
	airportBufferMinutes,
	departureLeaveBy,
	icsDataUri,
	isInternationalFlight,
	subtractMinutes,
} from "./transfer-alarm.ts";

function flight(partial: Partial<Flight>): Flight {
	return {
		airline: "Austrian Airlines",
		airline_code: "OS",
		flight_number: "334",
		origin: { airport: "LHR" },
		destination: { airport: "VIE" },
		depart: { datetime: "2026-07-14T12:20:00", timezone: "Europe/London" },
		arrive: { datetime: "2026-07-14T15:35:00", timezone: "Europe/Vienna" },
		...partial,
	};
}

describe("isInternationalFlight", () => {
	it("is international when the airports are in different countries", () => {
		expect(isInternationalFlight("LHR", "VIE")).toBe(true);
	});

	it("is domestic when both airports are in the same country", () => {
		expect(isInternationalFlight("JFK", "LAX")).toBe(false);
	});

	it("defaults to international when a country is unknown", () => {
		expect(isInternationalFlight("LHR", "ZZZ")).toBe(true);
	});
});

describe("airportBufferMinutes", () => {
	it("allows 3 hours for international, 2 for domestic", () => {
		expect(airportBufferMinutes(true)).toBe(180);
		expect(airportBufferMinutes(false)).toBe(120);
	});
});

describe("subtractMinutes", () => {
	it("subtracts within the same day", () => {
		expect(subtractMinutes("2026-07-14T12:20:00", 210)).toEqual({
			date: "2026-07-14",
			hours: 8,
			minutes: 50,
		});
	});

	it("rolls back across midnight", () => {
		expect(subtractMinutes("2026-07-14T00:30:00", 60)).toEqual({
			date: "2026-07-13",
			hours: 23,
			minutes: 30,
		});
	});
});

describe("departureLeaveBy", () => {
	it("works back from departure by the airport buffer plus transfer time", () => {
		// 12:20 international departure, 30 min transfer: arrive 09:20 (−3h),
		// leave 08:50 (−3h30).
		const plan = departureLeaveBy(flight({}), 30);
		expect(plan).not.toBeNull();
		expect(plan?.international).toBe(true);
		expect(plan?.bufferMin).toBe(180);
		expect(plan?.arriveBy).toEqual({
			date: "2026-07-14",
			hours: 9,
			minutes: 20,
		});
		expect(plan?.leaveBy).toEqual({
			date: "2026-07-14",
			hours: 8,
			minutes: 50,
		});
	});
});

describe("icsDataUri", () => {
	it("builds a downloadable VEVENT with an alarm at the start time", () => {
		const uri = icsDataUri({
			uid: "leave-OS334-2026-07-14",
			title: "Leave for LHR",
			start: { date: "2026-07-14", hours: 8, minutes: 50 },
			description: "Arrive at LHR by 9:20 AM for OS334.",
			location: "Hotel Indigo London - Paddington",
		});
		expect(uri.startsWith("data:text/calendar")).toBe(true);
		const ics = decodeURIComponent(uri.split(",").slice(1).join(","));
		expect(ics).toContain("BEGIN:VEVENT");
		expect(ics).toContain("DTSTART:20260714T085000");
		expect(ics).toContain("SUMMARY:Leave for LHR");
		expect(ics).toContain("BEGIN:VALARM");
		expect(ics).toContain("END:VCALENDAR");
	});
});
