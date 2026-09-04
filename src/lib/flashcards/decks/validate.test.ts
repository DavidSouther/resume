import { describe, expect, it, vi } from "vitest";
import { parseDeckNotes } from "./validate.ts";

const GOOD_NOTE = {
	noteId: "n1",
	modelName: "Basic",
	deckName: "Rust Cheat Sheet::Test",
	fields: { Front: "f", Back: "b" },
	tags: ["rust"],
};

describe("parseDeckNotes", () => {
	it("accepts a well-formed note array", () => {
		expect(parseDeckNotes([GOOD_NOTE], "test")).toEqual([GOOD_NOTE]);
	});

	it("throws if the payload isn't an array", () => {
		expect(() => parseDeckNotes({ not: "an array" }, "test")).toThrow(
			/not an array/,
		);
	});

	it("drops malformed entries and warns, rather than throwing", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const result = parseDeckNotes(
			[GOOD_NOTE, { noteId: "bad" }, null, "nope"],
			"test",
		);
		expect(result).toEqual([GOOD_NOTE]);
		expect(warn).toHaveBeenCalledTimes(3);
		warn.mockRestore();
	});

	it("rejects an unrecognized modelName", () => {
		const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
		const bad = { ...GOOD_NOTE, modelName: "NotAModel" };
		expect(parseDeckNotes([bad], "test")).toEqual([]);
		warn.mockRestore();
	});
});
