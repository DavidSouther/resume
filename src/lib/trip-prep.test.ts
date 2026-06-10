// @vitest-environment node
//
// Unit tests for the pure trip-prep derivations (design §3). All absolute-date:
// the render path is clock-independent, so no `today` is injected. Arrange-Act-
// Assert, table-driven across the boundaries that matter.
import { describe, expect, it } from "vitest";
import type { PrepItem } from "./trip-enrichment";
import { anyActionNeeded, deadlineDate, formatPrepDate } from "./trip-prep.ts";

describe("formatPrepDate — YYYY-MM-DD key → absolute 'D MMMM YYYY'", () => {
	// [name, iso, expected]
	const cases: [string, string, string][] = [
		["passport validity date", "2026-10-22", "22 October 2026"],
		["single-digit day", "2026-07-04", "4 July 2026"],
		["start of year", "2026-01-01", "1 January 2026"],
		["end of year", "2026-12-31", "31 December 2026"],
		// Timezone-drift guard: at UTC midnight this date is the 1st; under a
		// behind-UTC host clock a naive local parse would slip to the prior day.
		// The fixed UTC formatter must keep it on the 1st regardless.
		["tz-drift guard (midnight UTC)", "2026-03-01", "1 March 2026"],
	];

	for (const [name, iso, expected] of cases) {
		it(name, () => {
			// Arrange + Act: format the ISO key.
			const out = formatPrepDate(iso);
			// Assert.
			expect(out).toBe(expected);
		});
	}

	it("does not drift under a non-UTC host timezone", () => {
		// Arrange: pin a behind-UTC timezone for the duration of the assertion.
		const original = process.env.TZ;
		process.env.TZ = "America/Los_Angeles";
		try {
			// Act + Assert: the UTC formatter keeps the date on its own day.
			expect(formatPrepDate("2026-03-01")).toBe("1 March 2026");
			expect(formatPrepDate("2026-10-22")).toBe("22 October 2026");
		} finally {
			process.env.TZ = original;
		}
	});
});

describe("deadlineDate — departure − leadTimeDays → absolute deadline string", () => {
	// Hvar departure used as the reference.
	const DEPARTURE = "2026-07-11";

	// [name, departure, leadTimeDays, expected]
	const cases: [string, string, number, string][] = [
		// UK ETA fixture: depart 2026-07-11, lead 7 → 2026-07-04.
		["UK ETA: depart 11 Jul − 7d", DEPARTURE, 7, "4 July 2026"],
		// Zero lead time is the departure itself.
		["zero lead is departure", DEPARTURE, 0, "11 July 2026"],
		// Month-boundary case: crossing back across the month edge.
		["month boundary (Jul → Jun)", "2026-07-03", 7, "26 June 2026"],
		// Year-boundary case.
		["year boundary (Jan → Dec)", "2026-01-05", 10, "26 December 2025"],
	];

	for (const [name, departure, leadTimeDays, expected] of cases) {
		it(name, () => {
			// Arrange + Act: derive the absolute deadline.
			const out = deadlineDate(departure, leadTimeDays);
			// Assert.
			expect(out).toBe(expected);
		});
	}
});

describe("anyActionNeeded — aggregate badge driver over the checklist", () => {
	// [name, checklist, expected]
	const cases: [string, PrepItem[], boolean][] = [
		["empty checklist → false", [], false],
		[
			"all no_action → false",
			[
				{ label: "a", status: "no_action" },
				{ label: "b", status: "no_action" },
			],
			false,
		],
		[
			"one action_needed among others → true",
			[
				{ label: "a", status: "no_action" },
				{ label: "b", status: "action_needed" },
				{ label: "c", status: "no_action" },
			],
			true,
		],
		[
			"missing status → false",
			[{ label: "a" }, { label: "b", status: "no_action" }],
			false,
		],
	];

	for (const [name, checklist, expected] of cases) {
		it(name, () => {
			// Arrange + Act: derive the aggregate.
			const out = anyActionNeeded(checklist);
			// Assert.
			expect(out).toBe(expected);
		});
	}
});
