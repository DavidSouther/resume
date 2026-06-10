import { describe, expect, it } from "vitest";
// buildSitemap() must be a PURE function: it returns the sitemap XML as a
// string and writes no file. Importing it here must not write
// public/sitemap.xml. The module's real writeFileSync must be guarded to run
// only when sitemap.ts is the entry point — that guarding is the
// implementation's job, not this test's. This import is red today because
// sitemap.ts exports nothing.
import { buildSitemap } from "./sitemap.ts";

describe("XML sitemap excludes trips", () => {
	it("lists the home and blog routes but no /trips URL", () => {
		// Arrange: a real committed trip (trips/hvar) exists, so today's generator
		// emits /trips and /trips/hvar. That makes the negative assertion real.

		// Act
		const xml = buildSitemap();

		// Assert: the durable public surface is still advertised.
		expect(xml).toContain("<loc>https://davidsouther.com/</loc>");
		expect(xml).toContain("<loc>https://davidsouther.com/blog</loc>");

		// Assert: no trip URL leaks — one substring check covers the /trips index
		// and every per-trip /trips/<id> page at once.
		expect(xml).not.toContain("/trips");
	});
});
