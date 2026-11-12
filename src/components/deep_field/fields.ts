// The images the page offers: ESA images with a known orientation (AVM world
// coordinates) and spectroscopic redshifts for sources in their footprint.
// `public/deep_field/fields.json` is built by catalog/build_fields.py.
import type { Field } from "./catalog.ts";

export type { Field };

export const FIELDS_URL = "/deep_field/fields.json";
export const DEFAULT_FIELD = "potm2507a";
/** Fields bundled with the site, served locally instead of from the ESA CDN. */
const LOCAL: Record<string, string> = {
	potm2507a: "/deep_field/potm2507a.jpg",
};

export const SOURCES = {
	webb: { name: "ESA/Webb", label: "JWST" },
	hubble: { name: "ESA/Hubble", label: "Hubble" },
} as const;
export type SourceKey = keyof typeof SOURCES;

export const fieldSrc = (f: Field): string => LOCAL[f.id] ?? f.url;

/** Uniformly pick a field of one source; `random` is injectable for tests. */
export function pickField(
	fields: Field[],
	key: SourceKey,
	random: () => number = Math.random,
): Field {
	const pool = fields.filter((f) => f.source === SOURCES[key].name);
	if (!pool.length) throw new Error(`no ${SOURCES[key].label} fields`);
	return pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
}

let cache: Promise<Field[]> | null = null;
export function loadFields(): Promise<Field[]> {
	cache ??= fetch(FIELDS_URL)
		.then((r) => {
			if (!r.ok) throw new Error(`HTTP ${r.status}`);
			return r.json() as Promise<Field[]>;
		})
		.catch((e) => {
			cache = null;
			throw e;
		});
	return cache;
}
