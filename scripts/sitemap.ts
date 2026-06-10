import { writeFileSync } from "node:fs";
import { getPostPaths } from "../src/lib/posts.ts";

// Generates public/sitemap.xml before the SSG runs. The SSG then copies it to
// docs/sitemap.xml as part of the public/ pass.
const BASE = "https://davidsouther.com";

// buildSitemap assembles the sitemap XML and returns it as a string.
// PURE: it reads route sources (getPostPaths) and formats XML;
// it writes no file, so importing this module has no filesystem side effect.
// Invariant: the returned XML must contain a <loc> for every advertised route
// and nothing else, so callers can assert on substrings.
export function buildSitemap(): string {
	const staticRoutes = ["/", "/blog"];
	const postRoutes = getPostPaths().map((id) => `/blog/${id}`);

	const urls = [...staticRoutes, ...postRoutes]
		.map((loc) => `  <url><loc>${BASE}${loc}</loc></url>`)
		.join("\n");

	return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
}

if (import.meta.main) {
	writeFileSync("public/sitemap.xml", buildSitemap(), "utf-8");
}
