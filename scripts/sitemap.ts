import { writeFileSync } from "node:fs";
import { getPostPaths } from "../src/lib/posts.ts";
import { getTripPaths } from "../src/lib/trips.ts";

// Generates public/sitemap.xml before the SSG runs. The SSG then copies it to
// docs/sitemap.xml as part of the public/ pass.
const BASE = "https://davidsouther.com";

const staticRoutes = ["/", "/blog", "/trips"];
const postRoutes = getPostPaths().map((id) => `/blog/${id}`);
const tripRoutes = getTripPaths().map((id) => `/trips/${id}`);

const urls = [...staticRoutes, ...postRoutes, ...tripRoutes]
	.map((loc) => `  <url><loc>${BASE}${loc}</loc></url>`)
	.join("\n");

writeFileSync(
	"public/sitemap.xml",
	`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`,
	"utf-8",
);
