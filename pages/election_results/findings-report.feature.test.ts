// @vitest-environment jsdom
//
// Feature test for the election findings report. A reporter runs
// `uv run findings.py --out out`, which writes one auditable findings.json, and
// then builds the site, where pages/election_results/page.ts selects one
// prewritten variant per selector from that file. The design is in
// .ailly/developer/2026-11-05-B-findings-report/design.md.
//
// Run: `SKIP_SITE_BUILD=1 npx vitest run pages/election_results/findings-report.feature.test.ts`.
// The real run check needs uv and a pulled and analyzed out/ folder, and it is
// skipped when data/answers/ is absent (as in CI).
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const HERE = import.meta.dirname;
const OUT = join(HERE, "out");
const DATA = join(HERE, "data");
// A path held in a variable, so typecheck passes before page.ts exists.
const PAGE_PATH = join(HERE, "page.ts");
const SCHEMA_PATH = join(HERE, "findings.schema.json");

const OFFICES = ["house", "senate", "governor"] as const;
const LEAN_DEFS = {
	presidential: ["red", "blue", "swing"],
} as const;
const PARTIES = ["DEM", "REP"] as const;

// Every selector family and its exhaustive value enum. The schema and the
// page must both carry exactly these.
const FAMILIES: Record<string, readonly string[]> = {
	completeness: [
		"certified",
		"counting_nearly_complete",
		"counting_in_progress",
		"no_2026_data",
	],
	seat_shift: [
		"toward_dem",
		"toward_rep",
		"no_clear_shift",
		"insufficient_data",
	],
	party_flips: [
		"none",
		"dem_net_gain",
		"rep_net_gain",
		"even_exchange",
		"insufficient_data",
	],
	seat_shift_by_lean: [
		"toward_dem",
		"toward_rep",
		"no_clear_shift",
		"insufficient_data",
	],
	party_flips_by_lean: [
		"none",
		"dem_net_gain",
		"rep_net_gain",
		"even_exchange",
		"insufficient_data",
	],
	incumbency_party_gap: [
		"rep_lower",
		"dem_lower",
		"no_difference",
		"insufficient_data",
	],
	significance: [
		"p_below_0_05",
		"p_below_0_10",
		"p_at_or_above_0_10",
		"not_tested",
	],
	bonus_vs_history: [
		"below_all_prior_years",
		"within_prior_range",
		"above_all_prior_years",
		"insufficient_data",
	],
	turnout_explanation: [
		"turnout_plausible_majority",
		"persuasion_needed_majority",
		"evenly_split",
		"insufficient_data",
	],
	k_direction: [
		"dem_relative_gain",
		"rep_relative_gain",
		"near_parity",
		"insufficient_data",
	],
	dummymander: [
		"redrawn_incumbents_worse",
		"redrawn_incumbents_better",
		"no_clear_difference",
		"insufficient_data",
	],
	dummymander_vs_history: [
		"largest_gap_on_record",
		"within_prior_range",
		"insufficient_data",
	],
};

// The display fields findings.py writes for each family. A variant quotes the
// fields its rule used (TRIGGERS), so a reader sees the number behind a label.
const DISPLAY: Record<string, readonly string[]> = {
	completeness: [
		"races_2026",
		"unofficial",
		"eevp_below_95",
		"eevp_min",
		"fetched_at",
	],
	seat_shift: ["n", "median_margin_change", "share_toward_dem"],
	party_flips: ["n", "dem_gains", "rep_gains"],
	seat_shift_by_lean: [
		"n",
		"excluded",
		"median_margin_change",
		"share_toward_dem",
	],
	party_flips_by_lean: ["n", "excluded", "dem_gains", "rep_gains"],
	incumbency_party_gap: [
		"dem_bonus",
		"rep_bonus",
		"wald_diff",
		"wald_p",
		"dem_seats",
		"rep_seats",
	],
	significance: ["wald_p"],
	bonus_vs_history: ["bonus_2026", "prior_min", "prior_max", "prior_years"],
	turnout_explanation: ["n", "plausible", "share_plausible"],
	k_direction: ["n", "median_k"],
	dummymander: [
		"redrawn_mean",
		"not_redrawn_mean",
		"difference",
		"redrawn_races",
		"not_redrawn_races",
	],
	dummymander_vs_history: ["difference", "prior_max_abs", "prior_max_year"],
};

const INSUFFICIENT: Record<string, readonly string[]> = {
	completeness: ["races_2026"],
	seat_shift: ["n"],
	party_flips: ["n"],
	seat_shift_by_lean: ["n", "excluded"],
	party_flips_by_lean: ["n", "excluded"],
	incumbency_party_gap: ["dem_seats", "rep_seats"],
	significance: [],
	bonus_vs_history: ["prior_years"],
	turnout_explanation: ["n"],
	k_direction: ["n"],
	dummymander: ["redrawn_races", "not_redrawn_races"],
	dummymander_vs_history: ["prior_max_year"],
};
const SPARSE_VALUES = new Set([
	"insufficient_data",
	"not_tested",
	"no_2026_data",
]);

function triggers(family: string, value: string): readonly string[] {
	return SPARSE_VALUES.has(value) ? INSUFFICIENT[family] : DISPLAY[family];
}

function instanceKeys(): string[] {
	const keys = ["completeness"];
	for (const office of OFFICES) {
		keys.push(`seat_shift.${office}`, `party_flips.${office}`);
		for (const lean of LEAN_DEFS.presidential) {
			keys.push(
				`seat_shift_by_lean.${office}.${lean}`,
				`party_flips_by_lean.${office}.${lean}`,
			);
		}
		keys.push(`turnout_explanation.${office}`, `k_direction.${office}`);
		for (const [def, leans] of Object.entries(LEAN_DEFS)) {
			for (const lean of leans) {
				const group = `${def}.${office}.${lean}`;
				keys.push(`incumbency_party_gap.${group}`, `significance.${group}`);
				for (const party of PARTIES) {
					keys.push(`bonus_vs_history.${group}.${party}`);
				}
			}
		}
	}
	keys.push("dummymander.house", "dummymander_vs_history.house");
	return keys;
}

const familyOf = (key: string): string => key.split(".")[0];

interface Claim {
	value: string;
	rule: string;
	numbers: Record<string, number | null>;
	display: Record<string, string>;
	trigger_fields: string[];
	evidence: string[];
	cells?: Record<string, string | null>;
}

interface Code {
	file: string;
	kind: string;
	sha256: string;
	text: string;
}

interface RawTable {
	source_file: string;
	filter: string;
	columns: string[];
	rows: string[][];
	total_rows: number;
	truncated: boolean;
}

interface Findings {
	schema_version: number;
	run: {
		generated_at: string;
		inputs: { path: string; sha256: string; rows: number; bytes: number }[];
		[field: string]: unknown;
	};
	sources: Record<string, string | number | null>[];
	questions: Record<string, { sql: Code[]; raw_results: RawTable[] }>;
	thresholds: Record<string, unknown>;
	rules: Record<string, string[]>;
	selectors: Record<string, string>;
	claims: Record<string, Claim>;
}

const QUESTIONS = ["seat_change", "incumbency", "turnout", "dummymander"];
// The parts of each question section, in reading order.
const PARTS = ["methodology", "formulas", "sql", "raw-results", "summary"];

// A fixture where every instance of a family takes the given value, and every
// other family takes its first value. Display strings are unique tokens, so a
// token found in a variant can only have come from interpolation.
function fixture(overrides: Record<string, string> = {}): Findings {
	const selectors: Record<string, string> = {};
	const claims: Record<string, Claim> = {};
	for (const key of instanceKeys()) {
		const family = familyOf(key);
		const value = overrides[family] ?? FAMILIES[family][0];
		selectors[key] = value;
		claims[key] = {
			value,
			rule: `fixture rule for ${key}`,
			numbers: Object.fromEntries(DISPLAY[family].map((f) => [f, 1])),
			display: Object.fromEntries(
				DISPLAY[family].map((f) => [f, `«${key}#${f}»`]),
			),
			trigger_fields: [...triggers(family, value)],
			evidence: [`2026:TX:house:${key.length}`],
			// Table cells; share_toward_dem is null, so its column shows the null marker.
			cells: Object.fromEntries(
				DISPLAY[family].map((f) => [
					f,
					f === "share_toward_dem" ? null : `‹${key}#${f}›`,
				]),
			),
		};
	}
	return {
		schema_version: 1,
		run: {
			generated_at: "2026-11-06T05:00:00Z",
			tools: { python: "3.12.0", duckdb: "1.4.0", numpy: "2.0.0" },
			inputs: [
				{
					path: "data/answers/seat_change_2026.csv",
					sha256: "a".repeat(64),
					rows: 506,
					bytes: 1000,
				},
				{
					path: "data/races.csv",
					sha256: "b".repeat(64),
					rows: 6000,
					bytes: 2000,
				},
			],
			sources: [
				{ name: "ap progress.json", fetched_at: "2026-11-06T03:51:02Z" },
			],
			counts_2026: Object.fromEntries(
				OFFICES.map((o) => [o, { races: 1, unofficial: 1, eevp_below_95: 1 }]),
			),
		},
		sources: [
			{
				name: "Fixture source «source»",
				supplies: "Fixture rows.",
				location: "https://example.com/source",
				fetched_at: null,
				rows: null,
				notes: "Licensed fixture data.",
			},
		],
		questions: Object.fromEntries(
			QUESTIONS.map((q) => [
				q,
				{
					sql: [
						{
							file: `sql/${q}.sql`,
							kind: "sql",
							sha256: "c".repeat(64),
							text: `-- «${q} sql» with a non ASCII é\nselect 1 as x;\n`,
						},
					],
					raw_results: [
						{
							source_file: `data/answers/${q}.csv`,
							filter: "Fixture rows.",
							columns: ["year", "value"],
							column_kinds: ["text", "number"],
							column_units: ["", "points"],
							rows: [["2026", `«${q} raw»`]],
							total_rows: 9876,
							truncated: true,
						},
					],
				},
			]),
		),
		thresholds: { min_comparable_races: 5 },
		rules: Object.fromEntries(
			Object.keys(FAMILIES).map((family) => [family, [`rule for ${family}`]]),
		),
		selectors,
		claims,
	};
}

type Rendered = Node | Node[];
interface PageExports {
	default: {
		default: () => Rendered | Promise<Rendered>;
		head?: () => Rendered | Promise<Rendered>;
	};
	VARIANTS: Record<string, Record<string, unknown>>;
}

async function loadPage(): Promise<PageExports> {
	return (await import(PAGE_PATH)) as PageExports;
}

const tmp = mkdtempSync(join(tmpdir(), "findings-report-"));
const savedEnv = { ...process.env };
afterEach(() => {
	process.env = { ...savedEnv };
	document.body.replaceChildren();
});

// Renders the page the way the site build does, reading findings from `path`.
async function render(path: string): Promise<HTMLElement> {
	process.env.ELECTION_FINDINGS = path;
	delete process.env.CI;
	delete process.env.GITHUB_ACTIONS;
	const page = await loadPage();
	const body = await page.default.default();
	const root = document.createElement("div");
	root.append(...(Array.isArray(body) ? body : [body]));
	document.body.append(root);
	return root;
}

function writeFixture(name: string, findings: Findings): string {
	const path = join(tmp, name);
	writeFileSync(path, JSON.stringify(findings, null, 2), "utf-8");
	return path;
}

function expectOneVariantPerSelector(root: HTMLElement, f: Findings): void {
	const shown = root.querySelectorAll("[data-selector]");
	expect(shown.length).toBe(Object.keys(f.selectors).length);
	for (const [key, value] of Object.entries(f.selectors)) {
		const matches = root.querySelectorAll(`[data-selector="${key}"]`);
		expect(matches.length, key).toBe(1);
		const variant = matches[0] as HTMLElement;
		expect(variant.dataset.value, key).toBe(value);
		for (const field of f.claims[key].trigger_fields) {
			expect(variant.textContent, `${key} quotes ${field}`).toContain(
				f.claims[key].display[field],
			);
		}
	}
}

function expectCaveat(root: HTMLElement): void {
	const caveat = root.querySelector('[data-role="ap-caveat"]');
	expect(caveat?.textContent).toMatch(/AP/);
	expect(caveat?.textContent).toMatch(/terms/);
}

describe("election findings report", () => {
	it("has a written variant for every selector value, matching the schema", async () => {
		const schema = JSON.parse(readFileSync(SCHEMA_PATH, "utf-8"));
		const page = await loadPage();
		expect(Object.keys(page.VARIANTS).sort()).toEqual(
			Object.keys(FAMILIES).sort(),
		);
		for (const [family, values] of Object.entries(FAMILIES)) {
			expect(schema.$defs[family].enum, family).toEqual(values);
			expect(Object.keys(page.VARIANTS[family]).sort(), family).toEqual(
				[...values].sort(),
			);
		}
	});

	for (const [family, values] of Object.entries(FAMILIES)) {
		for (const value of values) {
			it(`shows exactly one variant per selector when ${family} is ${value}`, async () => {
				const f = fixture({ [family]: value });
				const root = await render(writeFixture(`${family}-${value}.json`, f));
				expect(
					root.querySelector("[data-state]")?.getAttribute("data-state"),
				).toBe("findings");
				for (const q of [
					"seat_change",
					"incumbency",
					"turnout",
					"dummymander",
				]) {
					expect(
						root.querySelector(`[data-question="${q}"]`),
						q,
					).not.toBeNull();
				}
				expectOneVariantPerSelector(root, f);
				expectCaveat(root);
			});
		}
	}

	it("shows the completeness banner and an audit panel holding the exact file", async () => {
		const f = fixture({ completeness: "counting_in_progress" });
		const path = writeFixture("audit.json", f);
		const root = await render(path);
		const banner = root.querySelector('[data-role="completeness-banner"]');
		expect(
			banner?.querySelector('[data-selector="completeness"]'),
		).not.toBeNull();
		expect(banner?.textContent).toContain(f.run.generated_at);
		const audit = root.querySelector('[data-role="audit"]') as HTMLElement;
		const download = audit.querySelector('a[download="findings.json"]');
		const href = download?.getAttribute("href") ?? "";
		expect(href.startsWith("data:application/json;base64,")).toBe(true);
		const embedded = Buffer.from(href.split(",")[1], "base64").toString(
			"utf-8",
		);
		expect(embedded).toBe(readFileSync(path, "utf-8"));
		const verbatim = audit.querySelector("details pre code.hljs.language-json");
		expect(verbatim?.textContent).toBe(readFileSync(path, "utf-8"));
		for (const input of f.run.inputs) {
			expect(audit.textContent).toContain(input.path);
			expect(audit.textContent).toContain(input.sha256);
		}
	});

	it("opens with a data sources overview before the questions", async () => {
		const f = fixture();
		const root = await render(writeFixture("sources.json", f));
		const sources = root.querySelector('[data-role="sources"]') as HTMLElement;
		expect(sources.textContent).toContain("Fixture source «source»");
		expect(sources.textContent).toContain("not available");
		const first = root.querySelector('[data-question="seat_change"]') as Node;
		expect(
			sources.compareDocumentPosition(first) & Node.DOCUMENT_POSITION_FOLLOWING,
		).toBeTruthy();
	});

	it("lays out each question as methodology, formulas, SQL, raw results, then the summary", async () => {
		const f = fixture();
		const root = await render(writeFixture("questions.json", f));
		const order = [...root.querySelectorAll("[data-question]")].map((q) =>
			q.getAttribute("data-question"),
		);
		expect(order).toEqual(QUESTIONS);
		const seatTable = root.querySelector(
			'[data-question="seat_change"] [data-part="summary"] table',
		) as HTMLElement;
		expect(seatTable.textContent).toContain(
			"‹seat_shift.house#median_margin_change›",
		);
		expect(seatTable.textContent).toContain("Median margin change (points)");
		expect(
			[...seatTable.querySelectorAll("td.ef-num")].some(
				(c) => c.textContent === "–",
			),
		).toBe(true);
		for (const q of QUESTIONS) {
			const section = root.querySelector(
				`[data-question="${q}"]`,
			) as HTMLElement;
			const parts = [...section.querySelectorAll("[data-part]")].map((el) =>
				el.getAttribute("data-part"),
			);
			expect(parts, q).toEqual(PARTS);
			const part = (name: string) =>
				section.querySelector(`[data-part="${name}"]`) as HTMLElement;
			expect(part("methodology").textContent?.length, q).toBeGreaterThan(200);
			expect(part("formulas").querySelector("pre"), q).not.toBeNull();
			for (const sql of f.questions[q].sql) {
				const block = part("sql").querySelector(
					`pre[data-sql-file="${sql.file}"]`,
				);
				expect(block?.textContent, q).toBe(sql.text);
				expect(part("sql").textContent).toContain(sql.sha256);
				const code = block?.querySelector("code");
				expect(code?.classList.contains("hljs"), q).toBe(true);
				expect(code?.classList.contains("language-sql"), q).toBe(true);
				expect(code?.querySelector("[class^='hljs-']"), q).not.toBeNull();
				const accordion = block?.closest("details");
				expect(accordion?.open, q).toBe(false);
				expect(accordion?.querySelector("summary")?.textContent).toContain(
					sql.file,
				);
			}
			for (const raw of f.questions[q].raw_results) {
				expect(part("raw-results").textContent).toContain(raw.source_file);
				expect(part("raw-results").textContent).toContain(
					String(raw.total_rows),
				);
				expect(part("raw-results").textContent).toContain(raw.rows[0][1]);
				const accordions = [
					...part("raw-results").querySelectorAll("details"),
				].filter((el) =>
					el.querySelector("summary")?.textContent?.includes(raw.source_file),
				);
				expect(accordions.length, q).toBe(1);
				expect(accordions[0].open, q).toBe(false);
				expect(accordions[0].querySelector("summary")?.textContent).toContain(
					`of ${String(raw.total_rows)} rows`,
				);
				expect(accordions[0].querySelector("table"), q).not.toBeNull();
			}
			const summary = part("summary");
			const variants = [...summary.querySelectorAll("[data-selector]")];
			expect(variants.length, q).toBeGreaterThan(0);
			// Numbers in tables, sentences below them as paragraphs.
			const tables = [...summary.querySelectorAll("table")];
			expect(tables.length, q).toBeGreaterThan(0);
			expect(summary.querySelector("td p, td [data-selector]"), q).toBeNull();
			for (const v of variants) {
				expect(v.tagName, q).toBe("P");
				expect(v.closest("table"), q).toBeNull();
				expect(
					tables[0].compareDocumentPosition(v) &
						Node.DOCUMENT_POSITION_FOLLOWING,
				).toBeTruthy();
			}
			const numbers = [...summary.querySelectorAll("td.ef-num")];
			expect(numbers.length, q).toBeGreaterThan(0);
			for (const cell of numbers) {
				expect(cell.textContent, q).toMatch(/^(‹.*›|–)$/);
			}
			const raw = part("raw-results").querySelector("table") as HTMLElement;
			expect(raw.querySelector("th.ef-num")?.textContent).toBe(
				"value (points)",
			);
			expect(part("raw-results").textContent).toContain("rounded for display");
		}
	});

	it("shows a no findings state when the file is missing", async () => {
		const root = await render(join(tmp, "absent.json"));
		expect(root.querySelector("[data-state]")?.getAttribute("data-state")).toBe(
			"no-findings",
		);
		expect(root.querySelectorAll("[data-selector]").length).toBe(0);
		expect(root.textContent).toContain("uv run findings.py --out out");
		expectCaveat(root);
	});

	it("shows an invalid findings state for a file of another schema version", async () => {
		const f = { ...fixture(), schema_version: 999 };
		const root = await render(writeFixture("future.json", f));
		expect(root.querySelector("[data-state]")?.getAttribute("data-state")).toBe(
			"invalid-findings",
		);
		expect(root.querySelectorAll("[data-selector]").length).toBe(0);
	});

	const uv = spawnSync("uv", ["--version"]).status === 0;
	it.skipIf(!uv || !existsSync(join(DATA, "answers")))(
		"writes a valid, auditable findings.json from a real out/ and renders it",
		async () => {
			const run = spawnSync("uv", ["run", "findings.py", "--out", "out"], {
				cwd: HERE,
				encoding: "utf-8",
			});
			expect(run.status, run.stderr).toBe(0);
			const check = spawnSync(
				"uv",
				["run", "findings.py", "--check", "out/findings.json"],
				{ cwd: HERE, encoding: "utf-8" },
			);
			expect(check.status, check.stderr).toBe(0);

			const path = join(OUT, "findings.json");
			const f = JSON.parse(readFileSync(path, "utf-8")) as Findings;
			expect(f.schema_version).toBe(1);
			expect(Object.keys(f.selectors).sort()).toEqual(instanceKeys().sort());
			for (const [key, value] of Object.entries(f.selectors)) {
				expect(FAMILIES[familyOf(key)], key).toContain(value);
				expect(f.claims[key].value, key).toBe(value);
				expect(f.claims[key].rule, key).not.toBe("");
			}
			const counts = f.run.counts_2026 as Record<string, unknown>;
			expect(Object.keys(counts).sort()).toEqual([...OFFICES].sort());
			expect(f.run.inputs.length).toBeGreaterThan(0);
			for (const input of f.run.inputs) {
				const bytes = readFileSync(join(HERE, input.path));
				const sha = createHash("sha256").update(bytes).digest("hex");
				expect(input.sha256, input.path).toBe(sha);
			}

			expect(Object.keys(f.questions).sort()).toEqual([...QUESTIONS].sort());
			for (const q of QUESTIONS) {
				for (const sql of f.questions[q].sql.filter((e) => e.kind === "sql")) {
					expect(sql.text, sql.file).toBe(
						readFileSync(join(HERE, sql.file), "utf-8"),
					);
				}
				for (const raw of f.questions[q].raw_results) {
					expect(raw.rows.length, raw.source_file).toBeLessThanOrEqual(
						raw.total_rows,
					);
				}
			}

			const root = await render(path);
			expect(
				root.querySelector("[data-state]")?.getAttribute("data-state"),
			).toBe("findings");
			expectOneVariantPerSelector(root, f);
			for (const q of QUESTIONS) {
				for (const sql of f.questions[q].sql) {
					const block = root.querySelector(`pre[data-sql-file="${sql.file}"]`);
					expect(block?.textContent, sql.file).toBe(sql.text);
				}
			}
		},
	);
});
