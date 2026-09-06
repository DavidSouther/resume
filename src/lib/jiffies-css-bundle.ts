import { readFileSync } from "node:fs";

// Reads name/version/unpkg from the installed @davidsouther/jiffies-css
// devDependency's own package.json, rather than resume's package.json, since
// resume's only records a semver range (e.g. "^2.0.0"); the resolved
// package.json has the concrete version and unpkg filename actually on disk.
// Bumping the devDependency (package.json + npm install) is the only step
// needed to move the pin, including across a filename change like the
// jiffies-css-v2-bundle.* -> jiffies-css-bundle.* rename.
const JIFFIES_CSS_PACKAGE = JSON.parse(
	readFileSync(
		new URL(import.meta.resolve("@davidsouther/jiffies-css/package.json")),
		"utf-8",
	),
) as { name: string; version: string; unpkg: string };

// The full resolved unpkg path, not a bare `@davidsouther/jiffies-css` URL,
// to avoid a redirect per load and lock the exact bundle tested against.
export const JIFFIES_CSS_BUNDLE = `https://unpkg.com/${JIFFIES_CSS_PACKAGE.name}@${JIFFIES_CSS_PACKAGE.version}/${JIFFIES_CSS_PACKAGE.unpkg}`;

export const JIFFIES_CSS_UNPKG_FILENAME = JIFFIES_CSS_PACKAGE.unpkg;
