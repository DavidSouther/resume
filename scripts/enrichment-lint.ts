import { readFileSync } from "node:fs";
import { join } from "node:path";
import { cwd } from "node:process";
import { parse as parseYaml } from "yaml";
import { getTripPaths } from "../src/lib/trips.ts";

// Authoring-time guardrail over every committed trips/<id>/enrichment.yaml.
// Pure over a parsed YAML value + the trip's source text; no render dependency
// (it imports nothing from src/components or the page-build path). Returns
// structured findings so the test and CLI can assert on them — errors are typed
// for a tool boundary, not stringly (patterns:errors-typed-untyped).
export type LintRule = "link-required" | "secret-pattern";

export type LintFinding = {
	trip: string;
	rule: LintRule;
	path: string;
	message: string;
};

// A standalone token of 9+ characters mixing letters and digits — the shape of a
// passport / visa / ETA reference number. The 9-char floor lets 6-char booking
// PNRs (e.g. "GHBT2Y") through, matching the repo's existing sensitivity bar;
// requiring BOTH a letter and a digit lets all-letter words ("AUTHORITATIVE")
// through so only ID-like tokens trip it.
const PASSPORT_TOKEN =
	/\b(?=[A-Za-z0-9]*[A-Za-z])(?=[A-Za-z0-9]*\d)[A-Za-z0-9]{9,}\b/;

// A full calendar day, in either ISO or US form. Coarse "YYYY-MM" must not match.
const FULL_DATE = /\b\d{4}-\d{2}-\d{2}\b|\b\d{1,2}\/\d{1,2}\/\d{4}\b/;

// Keys that explicitly name a sensitive number/identifier. Any non-empty scalar
// under one of these is rejected (covers short references the 9-char free-text
// rule would miss). `passport_country` is the legitimate status-registry field
// and must NOT match, so the passport alternative requires a number-ish suffix.
const NUMBER_KEY =
	/passport.?(no|num|number)|visa.?(no|num|number|reference)?|document.?number|doc.?no|reference/i;

// Keys that name a date of birth. A full date here is an exact DOB.
const BIRTH_KEY = /\bdob\b|birth/i;

function isScalar(v: unknown): v is string | number | boolean {
	return (
		typeof v === "string" || typeof v === "number" || typeof v === "boolean"
	);
}

// Rule: secret-pattern (design Metric 4). Walk the parsed value, carrying the
// nearest enclosing object key, and flag any scalar whose key or content reveals
// a passport/visa number, an exact DOB, or a full-day date where only a coarse
// month is allowed (valid_until).
function scanSecrets(
	trip: string,
	node: unknown,
	path: string,
	key: string | undefined,
	out: LintFinding[],
): void {
	if (Array.isArray(node)) {
		node.forEach((child, i) => {
			scanSecrets(trip, child, `${path}[${i}]`, key, out);
		});
		return;
	}
	if (node && typeof node === "object") {
		for (const [childKey, child] of Object.entries(
			node as Record<string, unknown>,
		)) {
			scanSecrets(
				trip,
				child,
				path ? `${path}.${childKey}` : childKey,
				childKey,
				out,
			);
		}
		return;
	}
	if (!isScalar(node)) return;

	const text = String(node);

	if (key && NUMBER_KEY.test(key) && text.trim().length > 0) {
		out.push({
			trip,
			rule: "secret-pattern",
			path,
			message: `value under key "${key}" names a passport/visa/reference number; record raw numbers only in the gitignored documents.local.yaml sidecar`,
		});
		return;
	}

	if (key && BIRTH_KEY.test(key) && FULL_DATE.test(text)) {
		out.push({
			trip,
			rule: "secret-pattern",
			path,
			message: `exact date of birth under key "${key}"; never commit a DOB`,
		});
		return;
	}

	if (key === "valid_until" && /^\d{4}-\d{2}-\d{2}$/.test(text.trim())) {
		out.push({
			trip,
			rule: "secret-pattern",
			path,
			message: `valid_until "${text}" is a full day; the committed file allows coarse "YYYY-MM" only`,
		});
		return;
	}

	if (PASSPORT_TOKEN.test(text)) {
		out.push({
			trip,
			rule: "secret-pattern",
			path,
			message: `value looks like a passport/visa reference number; record raw numbers only in the gitignored documents.local.yaml sidecar`,
		});
	}
}

// Rule: link-required (design Metric 2). Every checklist item that asserts a rule
// — it has a `detail`, or its status is anything other than `no_action` — must
// link to its authoritative government source rather than restate the rule.
function scanLinks(
	trip: string,
	enrichment: unknown,
	out: LintFinding[],
): void {
	const prep = (enrichment as { trip_prep?: { checklist?: unknown } } | null)
		?.trip_prep;
	const checklist = prep?.checklist;
	if (!Array.isArray(checklist)) return;

	checklist.forEach((raw, i) => {
		const item = raw as {
			label?: string;
			status?: string;
			url?: string;
			detail?: string;
		};
		const assertsRule = item.detail != null || item.status !== "no_action";
		const hasUrl = typeof item.url === "string" && item.url.trim().length > 0;
		if (assertsRule && !hasUrl) {
			out.push({
				trip,
				rule: "link-required",
				path: `trip_prep.checklist[${i}]`,
				message: `checklist item "${item.label ?? ""}" asserts a rule but has no authoritative gov/europa url`,
			});
		}
	});
}

export function lintEnrichment(trip: string, raw: string): LintFinding[] {
	const findings: LintFinding[] = [];
	const parsed = parseYaml(raw) as unknown;
	scanLinks(trip, parsed, findings);
	scanSecrets(trip, parsed, "", undefined, findings);
	return findings;
}

export function lintAllEnrichments(): LintFinding[] {
	const findings: LintFinding[] = [];
	for (const trip of getTripPaths()) {
		let raw: string;
		try {
			raw = readFileSync(
				join(cwd(), "trips", trip, "enrichment.yaml"),
				"utf-8",
			);
		} catch {
			// A trip without an enrichment.yaml has nothing to guard.
			continue;
		}
		findings.push(...lintEnrichment(trip, raw));
	}
	return findings;
}

// CLI: `node scripts/enrichment-lint.ts [trip]`. With a trip id, lints that
// trip's enrichment.yaml; with no argument, lints every trip. Exits non-zero if
// any finding is reported so the trip-prep skill can assert a clean write.
if (import.meta.filename === process.argv[1]) {
	const target = process.argv[2];
	const findings = target
		? lintEnrichment(
				target,
				readFileSync(join(cwd(), "trips", target, "enrichment.yaml"), "utf-8"),
			)
		: lintAllEnrichments();
	if (findings.length === 0) {
		console.log("enrichment-lint: no findings");
		process.exit(0);
	}
	for (const f of findings) {
		console.error(`[${f.trip}] ${f.rule} at ${f.path}: ${f.message}`);
	}
	process.exit(1);
}
