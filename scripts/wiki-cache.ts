import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";
import { parse as parseYaml } from "yaml";
import type { TripEnrichment } from "../src/lib/trip-enrichment";
import { getTripPaths } from "../src/lib/trips.ts";
import {
	type WikiCache,
	type WikiSummary,
	wikiEntryFromSummary,
} from "../src/lib/wiki-cache.ts";

// Manual cache refresh: fetch the Wikipedia REST summary for every referenced
// article in a trip's enrichment and write trips/<id>/wiki-cache.json. NOT wired
// into the build (offline builds; the committed cache is the source of truth).
// Invoke: `node scripts/wiki-cache.ts [id...]` (default: all trips).
//
// Per Wikimedia API etiquette: a descriptive contact User-Agent and a short
// delay between sequential requests. Per-title failures are logged and skipped
// (the prior entry is preserved) so a transient failure never poisons the file.

const USER_AGENT =
	"resume-wiki-cache/0.1 (https://davidsouther.com; david.souther@nominal.io)";
const DELAY_MS = 200;
const DEFAULT_SUMMARY_PATTERN =
	"https://en.wikipedia.org/api/rest_v1/page/summary/{TITLE}";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

function loadEnrichment(id: string): TripEnrichment | undefined {
	try {
		const raw = readFileSync(
			join(cwd(), "trips", id, "enrichment.yaml"),
			"utf-8",
		);
		return parseYaml(raw) as TripEnrichment;
	} catch {
		return undefined;
	}
}

function loadExistingCache(id: string): WikiCache {
	try {
		const raw = readFileSync(
			join(cwd(), "trips", id, "wiki-cache.json"),
			"utf-8",
		);
		return JSON.parse(raw) as WikiCache;
	} catch {
		return { version: 1, fetchedAt: "", entries: {} };
	}
}

/** Unique {title, url, summaryUrl} for every page-card + destination article. */
function collectRefs(
	enrichment: TripEnrichment,
): { title: string; url: string; summaryUrl: string }[] {
	const pattern =
		enrichment.meta?.wikipedia_summary_api_pattern ?? DEFAULT_SUMMARY_PATTERN;
	const refs = [
		...(enrichment.page_cards ?? []).map((c) => c.wikipedia),
		...(enrichment.destinations ?? []).map((d) => d.wikipedia),
	];
	const byTitle = new Map<
		string,
		{ title: string; url: string; summaryUrl: string }
	>();
	for (const ref of refs) {
		if (!ref?.title || byTitle.has(ref.title)) continue;
		// Titles in enrichment are already URL-encoded; substitute verbatim.
		const summaryUrl = ref.summary_api ?? pattern.replace("{TITLE}", ref.title);
		byTitle.set(ref.title, { title: ref.title, url: ref.url, summaryUrl });
	}
	return [...byTitle.values()];
}

async function refreshTrip(id: string): Promise<void> {
	const enrichment = loadEnrichment(id);
	if (!enrichment) {
		console.warn(`[wiki-cache] ${id}: no enrichment.yaml, skipping`);
		return;
	}

	const existing = loadExistingCache(id);
	const entries: Record<string, WikiSummary> = { ...existing.entries };
	const refs = collectRefs(enrichment);

	for (const { title, url, summaryUrl } of refs) {
		try {
			const res = await fetch(summaryUrl, {
				headers: { "User-Agent": USER_AGENT, Accept: "application/json" },
			});
			if (!res.ok) {
				console.warn(
					`[wiki-cache] ${id}: ${title} -> HTTP ${res.status}, keeping prior entry`,
				);
				continue;
			}
			const json = await res.json();
			entries[title] = wikiEntryFromSummary(json, url);
			console.log(
				`[wiki-cache] ${id}: ${title} ok${entries[title].thumbnail ? " (thumb)" : " (no thumb)"}`,
			);
		} catch (err) {
			console.warn(
				`[wiki-cache] ${id}: ${title} -> ${String(err)}, keeping prior entry`,
			);
		}
		await sleep(DELAY_MS);
	}

	// Stable key ordering for minimal, reviewable diffs.
	const ordered: Record<string, WikiSummary> = {};
	for (const key of Object.keys(entries).sort()) {
		ordered[key] = entries[key];
	}

	const cache: WikiCache = {
		version: 1,
		fetchedAt: new Date().toISOString(),
		entries: ordered,
	};

	writeFileSync(
		join(cwd(), "trips", id, "wiki-cache.json"),
		`${JSON.stringify(cache, null, 2)}\n`,
		"utf-8",
	);
	console.log(
		`[wiki-cache] ${id}: wrote ${Object.keys(ordered).length} entries`,
	);
}

const ids = process.argv.slice(2);
const targets = ids.length > 0 ? ids : getTripPaths();
for (const id of targets) {
	await refreshTrip(id);
}
