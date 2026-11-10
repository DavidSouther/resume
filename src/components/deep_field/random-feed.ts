// Random deep-field images from the ESA/Webb and ESA/Hubble public feeds.
// The selection rule is a pure function so it can be tested without a browser.

export interface AllowEntry {
	id: string;
	source: string;
	title: string;
}

/** The subset of an ESA feed record the selection rule reads. */
export interface FeedRecord {
	ID?: string;
	Title?: unknown;
	Headline?: unknown;
	Description?: unknown;
	/** [distance in light-years, redshift], either may be null or a numeric string. */
	Distance?: unknown;
	Redshift?: unknown;
}

/** Fallback distance threshold: 1000 MLy (1 Gly) or more. */
export const MIN_DISTANCE_LY = 1e9;
/** Fallback redshift threshold: strictly above. */
export const MIN_REDSHIFT = 0.5;

/** Feed text is a Python bytes repr: b'...' with \xNN escapes for UTF-8 bytes. */
export function unbytes(s: unknown): string {
	const t = String(s ?? "")
		.replace(/^b(['"])([\s\S]*)\1$/, "$2")
		.replace(/\\'/g, "'");
	const bytes: number[] = [];
	for (let i = 0; i < t.length; i++) {
		const m = /^\\x([0-9a-fA-F]{2})/.exec(t.slice(i));
		if (m) {
			bytes.push(Number.parseInt(m[1], 16));
			i += 3;
		} else {
			const enc = new TextEncoder().encode(t[i]);
			for (const b of enc) bytes.push(b);
		}
	}
	try {
		return new TextDecoder("utf-8", { fatal: true }).decode(
			new Uint8Array(bytes),
		);
	} catch {
		return t;
	}
}

function num(v: unknown): number | null {
	if (v == null || v === "") return null;
	const n = typeof v === "number" ? v : Number.parseFloat(String(v));
	return Number.isFinite(n) ? n : null;
}

/** Distance in light-years, accepting plain numbers and "N MLy" or "N Gly" text. */
function distanceLy(v: unknown): number | null {
	if (typeof v === "string") {
		const m = /^\s*([\d.]+)\s*(MLy|Gly|ly)\s*$/i.exec(v);
		if (m) {
			const scale = { mly: 1e6, gly: 1e9, ly: 1 }[m[2].toLowerCase()] as number;
			return Number.parseFloat(m[1]) * scale;
		}
	}
	return num(v);
}

function distanceAndRedshift(rec: FeedRecord): {
	ly: number | null;
	z: number | null;
} {
	const d = rec.Distance;
	if (Array.isArray(d)) return { ly: distanceLy(d[0]), z: num(d[1]) };
	return { ly: distanceLy(d), z: null };
}

/** The fallback rule: text says "deep field", or redshift above 0.5, or distance of 1000 MLy or more. */
export function looksLikeDeepField(rec: FeedRecord): boolean {
	const text = [rec.Title, rec.Headline, rec.Description]
		.map(unbytes)
		.join(" ")
		.toLowerCase();
	if (text.includes("deep field")) return true;
	const { ly, z } = distanceAndRedshift(rec);
	const zz = num(rec.Redshift) ?? z;
	if (zz != null && zz > MIN_REDSHIFT) return true;
	return ly != null && ly >= MIN_DISTANCE_LY;
}

/**
 * Choose the images a random button may load. Records whose ID is in the
 * allow-list for this feed's source win; when none of the listed IDs are in the
 * feed (entries drop out as the feed rolls over), fall back to deep-field-like
 * records. Items keep their order.
 */
export function selectDeepField<T extends { rec: FeedRecord }>(
	items: T[],
	allow: AllowEntry[],
	source: string,
): T[] {
	const ids = new Set(
		allow.filter((a) => a.source === source).map((a) => a.id),
	);
	const listed = items.filter((x) => x.rec.ID != null && ids.has(x.rec.ID));
	if (listed.length) return listed;
	return items.filter((x) => looksLikeDeepField(x.rec));
}

// ---------------- network side

export const FEEDS = {
	webb: {
		url: "https://esawebb.org/images/json/",
		name: "ESA/Webb",
		label: "JWST",
	},
	hubble: {
		url: "https://esahubble.org/images/json/",
		name: "ESA/Hubble",
		label: "Hubble",
	},
} as const;
export type FeedKey = keyof typeof FEEDS;

interface FeedResource {
	MediaType?: string;
	URL: string;
	FileSize: number;
	Dimensions: number[];
}
export interface FeedItem {
	rec: FeedRecord & {
		Type?: string;
		Resources?: FeedResource[];
		Credit?: unknown;
		ReferenceURL?: string;
	};
	res: FeedResource;
}

// Largest still-image file small enough to download and analyse.
function pickResource(rec: FeedItem["rec"]): FeedResource | undefined {
	return (rec.Resources || [])
		.filter(
			(r) =>
				r.MediaType === "Image" &&
				/\.(jpe?g|png)$/i.test(r.URL) &&
				r.FileSize <= 12e6 &&
				Math.max(...r.Dimensions) >= 1000,
		)
		.sort((a, b) => b.FileSize - a.FileSize)[0];
}

const feedCache: Partial<Record<FeedKey, Promise<FeedItem[]>>> = {};
function feed(key: FeedKey): Promise<FeedItem[]> {
	feedCache[key] ??= fetch(FEEDS[key].url)
		.then((r) => {
			if (!r.ok) throw new Error(`HTTP ${r.status}`);
			return r.json() as Promise<FeedItem["rec"][]>;
		})
		.then((list) =>
			list
				.filter((x) => x.Type === "Observation")
				.map((rec) => ({ rec, res: pickResource(rec) }))
				.filter((x): x is FeedItem => !!x.res),
		)
		.catch((e) => {
			delete feedCache[key];
			throw e;
		});
	return feedCache[key] as Promise<FeedItem[]>;
}

let allowCache: Promise<AllowEntry[]> | null = null;
function allowList(): Promise<AllowEntry[]> {
	allowCache ??= fetch("/deep_field/allowlist.json")
		.then((r) => {
			if (!r.ok) throw new Error(`HTTP ${r.status}`);
			return r.json() as Promise<AllowEntry[]>;
		})
		.catch(() => {
			// A missing allow-list leaves the fallback rule to choose.
			allowCache = null;
			return [] as AllowEntry[];
		});
	return allowCache;
}

/** Fetch a feed and return one uniformly random deep-field item. */
export async function pickRandom(key: FeedKey): Promise<FeedItem> {
	const [items, allow] = await Promise.all([feed(key), allowList()]);
	const pool = selectDeepField(items, allow, FEEDS[key].name);
	if (!pool.length) throw new Error("no deep-field images in the feed");
	return pool[Math.floor(Math.random() * pool.length)];
}
