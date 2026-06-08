import { describe, expect, it } from "vitest";
import { wikiEntryFromSummary } from "./wiki-cache.ts";

// A captured Wikipedia REST summary sample (no network), trimmed to the fields
// the projection reads.
const WITH_THUMB = {
	title: "Hvar",
	extract: "Hvar is a Croatian island in the Adriatic Sea.",
	content_urls: { desktop: { page: "https://en.wikipedia.org/wiki/Hvar" } },
	thumbnail: {
		source:
			"https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/View.jpg/330px-View.jpg",
		width: 330,
		height: 220,
	},
};

describe("wikiEntryFromSummary", () => {
	it("populates thumbnail when present", () => {
		const entry = wikiEntryFromSummary(WITH_THUMB, "https://fallback");

		expect(entry.title).toBe("Hvar");
		expect(entry.extract).toBe(
			"Hvar is a Croatian island in the Adriatic Sea.",
		);
		expect(entry.pageUrl).toBe("https://en.wikipedia.org/wiki/Hvar");
		expect(entry.thumbnail).toEqual({
			source:
				"https://upload.wikimedia.org/wikipedia/commons/thumb/2/27/View.jpg/330px-View.jpg",
			width: 330,
			height: 220,
		});
	});

	it("omits the thumbnail key when the article has no image", () => {
		const { thumbnail: _drop, ...noImage } = WITH_THUMB;

		const entry = wikiEntryFromSummary(noImage, "https://fallback");

		expect(entry).not.toHaveProperty("thumbnail");
	});

	it("falls back to the enrichment url when content_urls is absent", () => {
		const { content_urls: _drop, ...noUrls } = WITH_THUMB;

		const entry = wikiEntryFromSummary(
			noUrls,
			"https://en.wikipedia.org/wiki/Hvar",
		);

		expect(entry.pageUrl).toBe("https://en.wikipedia.org/wiki/Hvar");
	});
});
