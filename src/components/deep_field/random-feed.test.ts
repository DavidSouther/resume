import { describe, expect, it } from "vitest";
import {
	type AllowEntry,
	type FeedRecord,
	looksLikeDeepField,
	selectDeepField,
	unbytes,
} from "./random-feed.ts";

const item = (rec: FeedRecord) => ({ rec });
const allow: AllowEntry[] = [
	{ id: "weic2327a", source: "ESA/Webb", title: "MACS0416" },
	{ id: "heic0406a", source: "ESA/Hubble", title: "Galaxies galore" },
];

describe("selectDeepField", () => {
	it("keeps only allow-listed ids for the feed's source", () => {
		const items = [
			item({ ID: "weic2327a" }),
			item({ ID: "other", Title: "b'A deep field'" }),
			item({ ID: "heic0406a" }),
		];
		expect(selectDeepField(items, allow, "ESA/Webb")).toEqual([items[0]]);
		expect(selectDeepField(items, allow, "ESA/Hubble")).toEqual([items[2]]);
	});

	it("falls back to deep-field-like records when no listed id is in the feed", () => {
		const items = [
			item({ ID: "a", Title: "b'The Hubble Deep Field'" }),
			item({ ID: "b", Description: "b'a nebula'", Distance: ["1600.0", null] }),
			item({ ID: "c", Distance: ["12000000.0", null] }),
			item({ ID: "d", Distance: [null, "2.156"] }),
			item({ ID: "e", Distance: ["5000000000.0", null] }),
		];
		const ids = selectDeepField(items, [], "ESA/Webb").map((x) => x.rec.ID);
		expect(ids).toEqual(["a", "d", "e"]);
	});

	it("returns nothing when neither rule matches", () => {
		expect(
			selectDeepField([item({ ID: "z", Title: "Nebula" })], allow, "ESA/Webb"),
		).toEqual([]);
	});
});

describe("looksLikeDeepField", () => {
	it("applies the 1000 MLy and redshift thresholds exactly", () => {
		expect(looksLikeDeepField({ Distance: ["1000000000", null] })).toBe(true);
		expect(looksLikeDeepField({ Distance: ["999999999", null] })).toBe(false);
		expect(looksLikeDeepField({ Distance: [null, "0.5"] })).toBe(false);
		expect(looksLikeDeepField({ Distance: [null, "0.51"] })).toBe(true);
		expect(looksLikeDeepField({ Distance: "1 Gly" })).toBe(true);
		expect(looksLikeDeepField({ Distance: "900 MLy" })).toBe(false);
	});
	it("matches headline and description text", () => {
		expect(looksLikeDeepField({ Headline: "b'Deep Field survey'" })).toBe(true);
		expect(looksLikeDeepField({ Description: "A DEEP FIELD view" })).toBe(true);
	});
});

describe("unbytes", () => {
	it("strips the bytes repr and decodes utf-8 escapes", () => {
		expect(unbytes("b'SPT-CL J0615\\xe2\\x88\\x925746'")).toBe(
			"SPT-CL J0615−5746",
		);
		expect(unbytes("b\"A 'wallpaper'\"")).toBe("A 'wallpaper'");
	});
});
