import { readFileSync } from "node:fs";

// Plotly is a devDependency purely to hold this pin: the browser loads it from
// the CDN and nothing bundles it. The installed package's own version is the
// pin, since this repo's package.json records only a range.
const PLOTLY_PACKAGE = JSON.parse(
	readFileSync(
		new URL(import.meta.resolve("plotly.js-dist-min/package.json")),
		"utf-8",
	),
) as { version: string };

export const PLOTLY_VERSION = PLOTLY_PACKAGE.version;

export const PLOTLY_URL = `https://cdn.jsdelivr.net/npm/plotly.js-dist-min@${PLOTLY_VERSION}/plotly.min.js`;
