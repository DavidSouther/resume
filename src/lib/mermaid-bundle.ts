import { readFileSync } from "node:fs";

// Reads the version from the installed `mermaid` devDependency's own
// package.json rather than from this repo's package.json, since ours records
// only a semver range. Mermaid is a devDependency purely to hold this pin: the
// browser loads it from the CDN, nothing bundles it. Bumping the devDependency
// (package.json + npm install) is the only step needed to move the pin.
const MERMAID_PACKAGE = JSON.parse(
	readFileSync(new URL(import.meta.resolve("mermaid/package.json")), "utf-8"),
) as { version: string };

export const MERMAID_VERSION = MERMAID_PACKAGE.version;

// The fully-resolved ESM bundle path, not a bare `mermaid` URL, to avoid a
// redirect per load and lock the exact build the site was checked against.
export const MERMAID_ESM_URL = `https://cdn.jsdelivr.net/npm/mermaid@${MERMAID_VERSION}/dist/mermaid.esm.min.mjs`;
