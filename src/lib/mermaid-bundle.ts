import { readFileSync } from "node:fs";

// Mermaid is a devDependency purely to hold this pin — the browser loads it
// from the CDN and nothing bundles it. The installed package's own version is
// the pin, since this repo's package.json records only a range.
const MERMAID_PACKAGE = JSON.parse(
	readFileSync(new URL(import.meta.resolve("mermaid/package.json")), "utf-8"),
) as { version: string };

export const MERMAID_VERSION = MERMAID_PACKAGE.version;

// Fully resolved rather than a bare `mermaid` URL: no redirect per load, and
// the exact build the site was checked against.
export const MERMAID_ESM_URL = `https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.esm.min.mjs`;
