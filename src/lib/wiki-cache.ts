/** A cached Wikipedia REST summary, projected to only what render needs. */
export type WikiSummary = {
	title: string;
	extract: string;
	pageUrl: string;
	// Absent (not null) when the article has no image; render treats absent as
	// "no image".
	thumbnail?: { source: string; width: number; height: number };
};

/**
 * Resolve a Wikipedia title to its cached summary. Pure in-memory map read, no
 * I/O, so callers stay synchronous and deterministic. Keyed by the EXACT
 * enrichment `wikipedia.title` string (e.g. "Schönbrunn_Palace",
 * "Stari_Grad,_Croatia") — no normalization. `get(undefined)` returns undefined
 * so an optional title threads straight through.
 */
export type WikiData = {
	get(title: string | undefined): WikiSummary | undefined;
};

/**
 * The committed `trips/<id>/wiki-cache.json` shape: render-ready entries keyed
 * by Wikipedia title, plus provenance. Shared by the loader (`buildWikiData`)
 * and the fetch script (`scripts/wiki-cache.ts`).
 */
export type WikiCache = {
	version: number;
	fetchedAt: string;
	entries: Record<string, WikiSummary>;
};

/**
 * Build a `WikiData` lookup over a parsed cache record. `get` is a pure map
 * read; an undefined title (or a title absent from `entries`) yields undefined.
 */
export function buildWikiData(entries: Record<string, WikiSummary>): WikiData {
	return {
		get: (title) => (title ? entries[title] : undefined),
	};
}

/** An empty lookup that always misses — used when no cache file is present. */
export function emptyWikiData(): WikiData {
	return { get: () => undefined };
}

/**
 * Project a raw Wikipedia REST summary JSON into a cache entry. Pure: no I/O.
 * `enrichmentUrl` is the enrichment `wikipedia.url`, used as the pageUrl
 * fallback when the summary omits content_urls.desktop.page. Returns the
 * WikiSummary the cache stores. Thumbnail is omitted (not null) when absent.
 */
export function wikiEntryFromSummary(
	json: unknown,
	enrichmentUrl: string,
): WikiSummary {
	const j = json as {
		title?: string;
		extract?: string;
		content_urls?: { desktop?: { page?: string } };
		thumbnail?: { source?: string; width?: number; height?: number };
	};
	const summary: WikiSummary = {
		title: j.title ?? "",
		extract: j.extract ?? "",
		pageUrl: j.content_urls?.desktop?.page ?? enrichmentUrl,
	};
	const thumb = j.thumbnail;
	if (thumb?.source && thumb.width != null && thumb.height != null) {
		summary.thumbnail = {
			source: thumb.source,
			width: thumb.width,
			height: thumb.height,
		};
	}
	return summary;
}
