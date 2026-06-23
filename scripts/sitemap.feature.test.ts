import { describe, expect, it } from "vitest";
// buildSitemap() must be a PURE function: it returns the sitemap XML as a
// string and writes no file. Importing it here must not write
// public/sitemap.xml. The module's real writeFileSync must be guarded to run
// only when sitemap.ts is the entry point — that guarding is the
// implementation's job, not this test's. This import is red today because
// sitemap.ts exports nothing.
import { buildSitemap } from "./sitemap.ts";

describe("XML sitemap lists the public routes", () => {
	it("advertises the home and blog routes", () => {
		// Act
		const xml = buildSitemap();

		// Assert: the durable public surface is advertised.
		expect(xml).toContain("<loc>https://davidsouther.com/</loc>");
		expect(xml).toContain("<loc>https://davidsouther.com/blog</loc>");
	});
});
