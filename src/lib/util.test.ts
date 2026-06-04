import { describe, expect, it } from "vitest";
import { show } from "./util";

// `show` gates whether a dated entry is printed. The cutoff year is 2018:
// entries on or after it are shown, earlier ones are hidden, and an undefined
// date is always shown. Only the leading four characters are read as the year.
describe("show", () => {
	it("shows entries with no date", () => {
		expect(show(undefined)).toBe(true);
	});

	it("shows a date on or after the 2018 cutoff", () => {
		expect(show("2018-01-01")).toBe(true);
		expect(show("2020-06-30")).toBe(true);
	});

	it("hides a date before the 2018 cutoff", () => {
		expect(show("2017-12-31")).toBe(false);
		expect(show("2005")).toBe(false);
	});

	it("reads only the leading four characters as the year", () => {
		// Trailing content past the year is ignored by the substring(0, 4) read.
		expect(show("2019/this-is-not-a-date")).toBe(true);
	});
});
