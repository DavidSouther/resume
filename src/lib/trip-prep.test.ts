// @vitest-environment node
//
// Unit tests for the pure trip-prep derivations (design Metrics 3 & 6).
// Arrange-Act-Assert, table-driven across the fixed boundaries. `today` is
// always injected so the tests are deterministic (no Date.now() inside).
import { describe, expect, it } from "vitest";
import type { PrepItem } from "./trip-enrichment";
import { deadlineState, stalenessBand } from "./trip-prep.ts";

// Hvar departure used as the reference throughout.
const DEPARTURE = "2026-07-11";

describe("stalenessBand — age of checked_on tightens as departure nears (Metric 3)", () => {
	// [name, checkedOn, today, expected]
	const cases: [string, string, string, "fresh" | "stale"][] = [
		// >90 days from departure: a 90-day-old check is still fresh.
		[">90d out, 90d old → fresh", "2026-01-02", "2026-04-02", "fresh"],
		[">90d out, 91d old → stale", "2026-01-01", "2026-04-02", "stale"],
		// Within 1 month of departure (<=30d out): require age < 1 month.
		["1mo out, 29d old → fresh", "2026-05-19", "2026-06-17", "fresh"],
		["1mo out, 31d old → stale", "2026-05-17", "2026-06-17", "stale"],
		// Within 2 weeks (<=14d out): require age < 2 weeks.
		["2wk out, 13d old → fresh", "2026-06-15", "2026-06-28", "fresh"],
		["2wk out, 15d old → stale", "2026-06-13", "2026-06-28", "stale"],
		// Within 1 week (<=7d out): require age < 1 week.
		["1wk out, 6d old → fresh", "2026-07-01", "2026-07-07", "fresh"],
		["1wk out, 8d old → stale", "2026-06-29", "2026-07-07", "stale"],
		// Within 1 day (<=1d out): always stale.
		["1d out, 0d old → stale", "2026-07-10", "2026-07-10", "stale"],
	];

	for (const [name, checkedOn, today, expected] of cases) {
		it(name, () => {
			// Arrange: a checked_on date, a departure, and an injected clock.
			// Act: derive the band.
			const band = stalenessBand(checkedOn, DEPARTURE, new Date(today));
			// Assert.
			expect(band).toBe(expected);
		});
	}
});

describe("deadlineState — lead_time_days deadline + warn window (Metric 6)", () => {
	// Worked example: lead_time_days 14 → deadline 2026-06-27; warn begins
	// 21 days before departure (7 ahead of the deadline) = 2026-06-20.
	const item: PrepItem = {
		label: "UK ETA",
		status: "action_needed",
		lead_time_days: 14,
	};

	// [name, item, today, expected]
	const cases: [string, PrepItem, string, "ok" | "warn" | "overdue"][] = [
		["before warn window → ok", item, "2026-06-19", "ok"],
		["start of warn window (21d out) → warn", item, "2026-06-20", "warn"],
		["inside warn window → warn", item, "2026-06-25", "warn"],
		["on the deadline → warn", item, "2026-06-27", "warn"],
		["past the deadline → overdue", item, "2026-06-28", "overdue"],
		["done suppresses warn", { ...item, status: "done" }, "2026-06-25", "ok"],
		[
			"done suppresses overdue",
			{ ...item, status: "done" },
			"2026-06-28",
			"ok",
		],
		[
			"no lead_time_days → ok",
			{ label: "no deadline", status: "action_needed" },
			"2026-07-10",
			"ok",
		],
	];

	for (const [name, testItem, today, expected] of cases) {
		it(name, () => {
			// Arrange + Act: derive the deadline state against the injected clock.
			const state = deadlineState(testItem, DEPARTURE, new Date(today));
			// Assert.
			expect(state).toBe(expected);
		});
	}
});
