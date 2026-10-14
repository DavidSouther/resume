// Loader for the NYC DOT completion pipeline's config + output, read at
// SSG build time from tools/nyc-dot-completion/. The pipeline itself is a
// standalone Python tool (see its README) — this file only reads what it
// produced, it never re-derives numbers.

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";
import { parse as parseYaml } from "yaml";

const PIPELINE_DIR = join(cwd(), "tools", "nyc-dot-completion");

export interface CompletionRow {
	metric: string;
	unit: string;
	adamsTotal: string;
	mamdaniToDateTotal: string;
	mamdaniAnnualizedTotal: string;
	confidence: string;
	completionSemantics: string;
	notes: string;
}

/**
 * Minimal RFC4180 CSV parser: handles quoted fields, embedded commas, and
 * escaped quotes ("") — build_table.py's csv.DictWriter output relies on
 * quoting for `notes` values that contain commas, so a naive split(",")
 * would silently misalign columns.
 */
function parseCsv(text: string): string[][] {
	const rows: string[][] = [];
	let row: string[] = [];
	let field = "";
	let inQuotes = false;

	for (let i = 0; i < text.length; i++) {
		const c = text[i];
		if (inQuotes) {
			if (c === '"') {
				if (text[i + 1] === '"') {
					field += '"';
					i++;
				} else {
					inQuotes = false;
				}
			} else {
				field += c;
			}
			continue;
		}
		if (c === '"') {
			inQuotes = true;
		} else if (c === ",") {
			row.push(field);
			field = "";
		} else if (c === "\n") {
			row.push(field);
			rows.push(row);
			row = [];
			field = "";
		} else if (c !== "\r") {
			field += c;
		}
	}
	if (field.length > 0 || row.length > 0) {
		row.push(field);
		rows.push(row);
	}
	return rows.filter((r) => !(r.length === 1 && r[0] === ""));
}

/** Returns null if the pipeline hasn't produced output/final_table.csv yet — the page must render an honest "not run" state, not fall back to placeholder numbers. */
export function loadCompletionTable(): CompletionRow[] | null {
	const csvPath = join(PIPELINE_DIR, "output", "final_table.csv");
	if (!existsSync(csvPath)) return null;

	const [, ...body] = parseCsv(readFileSync(csvPath, "utf-8"));
	return body.map((cols) => ({
		metric: cols[0] ?? "",
		unit: cols[1] ?? "",
		adamsTotal: cols[2] ?? "",
		mamdaniToDateTotal: cols[3] ?? "",
		mamdaniAnnualizedTotal: cols[4] ?? "",
		confidence: cols[5] ?? "",
		completionSemantics: cols[6] ?? "",
		notes: cols[7] ?? "",
	}));
}

export interface AdminWindow {
	label: string;
	start: string;
	end: string | null;
}

export interface DatasetSource {
	key: string;
	datasetId: string;
	resourceUrl: string;
	metadataUrl: string;
	role: string;
}

export interface SourcesConfig {
	administrations: Record<string, AdminWindow>;
	datasets: DatasetSource[];
	transalt: { url: string; note: string };
}

export function loadSourcesConfig(): SourcesConfig {
	const raw = parseYaml(
		readFileSync(join(PIPELINE_DIR, "config", "sources.yaml"), "utf-8"),
	);
	const administrations: Record<string, AdminWindow> = {};
	for (const [key, admin] of Object.entries(
		raw.administrations as Record<
			string,
			{ label: string; start: string; end?: string }
		>,
	)) {
		administrations[key] = {
			label: admin.label,
			start: admin.start,
			end: admin.end ?? null,
		};
	}

	const datasets: DatasetSource[] = Object.entries(
		raw.datasets as Record<
			string,
			{
				dataset_id: string;
				resource_url: string;
				metadata_url: string;
				role: string;
			}
		>,
	).map(([key, d]) => ({
		key,
		datasetId: d.dataset_id,
		resourceUrl: d.resource_url,
		metadataUrl: d.metadata_url,
		role: d.role.trim(),
	}));

	return {
		administrations,
		datasets,
		transalt: {
			url: raw.secondary_sources.transalt_tracker.url,
			note: raw.secondary_sources.transalt_tracker.note.trim(),
		},
	};
}

export interface TestimonyFigure {
	metric: string;
	calendarYear: number | null;
	valueMi: number;
	note: string;
}

export interface TestimonyDoc {
	key: string;
	title: string;
	filename: string;
	url: string;
	urlVerified: boolean;
	figures: TestimonyFigure[];
}

export function loadTestimonyConfig(): TestimonyDoc[] {
	const raw = parseYaml(
		readFileSync(join(PIPELINE_DIR, "config", "testimony.yaml"), "utf-8"),
	);
	return Object.entries(
		raw.documents as Record<
			string,
			{
				title: string;
				filename: string;
				url: string;
				url_verified: boolean;
				figures: {
					metric: string;
					calendar_year: number | null;
					value_mi: number;
					note?: string;
				}[];
			}
		>,
	).map(([key, doc]) => ({
		key,
		title: doc.title,
		filename: doc.filename,
		url: doc.url,
		urlVerified: doc.url_verified,
		figures: doc.figures.map((f) => ({
			metric: f.metric,
			calendarYear: f.calendar_year,
			valueMi: f.value_mi,
			note: f.note ?? "",
		})),
	}));
}
