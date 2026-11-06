import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import {
	a,
	aside,
	code,
	dd,
	details,
	div,
	dl,
	dt,
	h1,
	h2,
	h3,
	h4,
	h5,
	header,
	li,
	main,
	meta,
	ol,
	p,
	pre,
	section,
	span,
	style,
	summary,
	table,
	tbody,
	td,
	th,
	thead,
	tr,
	ul,
} from "@davidsouther/jiffies/dom/html.ts";
import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
import { highlightFences } from "../../src/lib/markdown.ts";
import { pageHead } from "../../src/lib/page-head.ts";

// The 2026 election findings report. Every sentence a reader can see is
// written below, in VARIANTS and in the per question METHODS, and the page only
// chooses among them using findings.json, which `uv run findings.py --out out`
// writes. Numbers reach the page as display strings that findings.py formats,
// so nothing here formats or computes a number. The file is read inside
// default() at build time, never at import. The committed out/findings.json is
// read in CI too, so the deployed page carries the same findings. The design is in
// .ailly/developer/2026-11-05-B-findings-report/design.md.

export const OFFICES = ["house", "senate", "governor"] as const;
export type Office = (typeof OFFICES)[number];
export const LEAN_DEFS = {
	presidential: ["red", "blue", "swing"],
} as const;
export type LeanDef = keyof typeof LEAN_DEFS;
export const PARTIES = ["DEM", "REP"] as const;
export type Party = (typeof PARTIES)[number];
export const QUESTIONS = [
	"seat_change",
	"incumbency",
	"turnout",
	"dummymander",
] as const;
export type Question = (typeof QUESTIONS)[number];

export interface Claim {
	value: string;
	rule: string;
	numbers: Record<string, number | null>;
	display: Record<string, string>;
	trigger_fields: string[];
	evidence: string[];
	/** Each number at its table precision with no unit, or null, from findings.py. */
	cells?: Record<string, string | null>;
}

export interface InputFile {
	path: string;
	sha256: string;
	bytes: number;
	rows: number;
}

export interface Run {
	generated_at: string;
	tools: Record<string, unknown>;
	inputs: InputFile[];
	sources: { name: string; fetched_at: string | null }[];
	counts_2026: Record<string, Record<string, unknown>>;
}

export interface Source {
	name: string;
	supplies: string;
	location: string;
	fetched_at: string | null;
	rows: number | null;
	notes: string;
}

export interface Code {
	file: string;
	kind: "sql" | "python";
	sha256: string;
	text: string;
}

export interface RawTable {
	source_file: string;
	filter: string;
	columns: string[];
	column_kinds?: ("number" | "text")[];
	column_units?: string[];
	rows: string[][];
	total_rows: number;
	truncated: boolean;
}

export interface Findings {
	schema_version: 1;
	run: Run;
	sources: Source[];
	questions: Record<Question, { sql: Code[]; raw_results: RawTable[] }>;
	thresholds: Record<string, unknown>;
	rules: Record<string, string[]>;
	selectors: Record<string, string>;
	claims: Record<string, Claim>;
}

export interface InvalidFindings {
	problem: string;
}

/** What a variant knows about its selector key, beyond the claim itself. */
export interface VariantContext {
	office: Office;
	leanDef?: LeanDef;
	lean?: string;
	party?: Party;
	thresholds: Record<string, unknown>;
}

/** A prewritten paragraph that interpolates only `claim.display` strings and thresholds. */
export type Variant = (claim: Claim, ctx: VariantContext) => HTMLElement;

const NOT_AVAILABLE = "not available";

/** A display string of the claim, or a fixed phrase when findings.py wrote none (a null number). */
function d(claim: Claim, field: string): string {
	const shown = claim.display[field];
	if (shown !== undefined) return shown;
	return field === "prior_max_year" ? "no earlier year" : NOT_AVAILABLE;
}

/** A threshold from findings.json as written there, or one element of a pair. */
function t(ctx: VariantContext, name: string, index?: number): string {
	const raw = ctx.thresholds[name];
	const value = index === undefined || !Array.isArray(raw) ? raw : raw[index];
	return typeof value === "number" || typeof value === "string"
		? String(value)
		: NOT_AVAILABLE;
}

const OFFICE_RACES: Record<Office, string> = {
	house: "House races",
	senate: "Senate races",
	governor: "governor races",
};

const LEAN_PHRASE: Record<LeanDef, Record<string, string>> = {
	presidential: {
		red: "states that voted Republican for president by more than 5 points in the latest earlier presidential election",
		blue: "states that voted Democratic for president by more than 5 points in the latest earlier presidential election",
		swing:
			"swing states, where the latest earlier presidential margin was 5 points or less",
	},
};

const LEAN_DEF_TITLE: Record<LeanDef, string> = {
	presidential: "By presidential lean",
};

const PARTY_INCUMBENTS: Record<Party, string> = {
	DEM: "Democratic incumbents",
	REP: "Republican incumbents",
};

function races(ctx: VariantContext): string {
	return OFFICE_RACES[ctx.office];
}

function group(ctx: VariantContext): string {
	const phrase =
		ctx.leanDef && ctx.lean ? LEAN_PHRASE[ctx.leanDef][ctx.lean] : undefined;
	return `${races(ctx)} in ${phrase ?? "this group of states"}`;
}

function party(ctx: VariantContext): string {
	return ctx.party ? PARTY_INCUMBENTS[ctx.party] : "these incumbents";
}

const PARTIAL = "These figures come from unofficial and partial 2026 counts.";

function leftOut(c: Claim): string {
	return `The number of the group's races left out as not comparable is ${d(c, "excluded")}.`;
}

function variant(write: (c: Claim, ctx: VariantContext) => string): Variant {
	return (c, ctx) => p({ class: "ef-variant" }, write(c, ctx));
}

/**
 * Every value of every selector family, as a written paragraph. A full value
 * quotes every display field of its family, and a sparse value quotes only
 * its counts. Variants state what number triggered them and assert no cause.
 */
export const VARIANTS = {
	completeness: {
		certified: variant(
			(c, x) =>
				`No 2026 race is marked unofficial, so the counts below are certified results. Of the ${d(c, "races_2026")} races for 2026, ${d(c, "unofficial")} are unofficial and ${d(c, "eevp_below_95")} report less than ${t(x, "nearly_complete_eevp")} percent of their expected vote, and the lowest expected vote figure in any AP race is ${d(c, "eevp_min")}. AP's results were fetched at ${d(c, "fetched_at")}.`,
		),
		counting_nearly_complete: variant(
			(c, x) =>
				`Counting is nearly complete but not final. Every AP race has counted at least ${t(x, "nearly_complete_eevp")} percent of its expected vote, and the lowest figure is ${d(c, "eevp_min")}, so ${d(c, "eevp_below_95")} races are below that mark. Still, ${d(c, "unofficial")} of the ${d(c, "races_2026")} races for 2026 are unofficial. Every finding below uses AP's results as fetched at ${d(c, "fetched_at")}, and those counts can change until states certify them.`,
		),
		counting_in_progress: variant(
			(c, x) =>
				`Counting is still in progress. In AP's results as fetched at ${d(c, "fetched_at")}, ${d(c, "unofficial")} of the ${d(c, "races_2026")} races for 2026 are unofficial, ${d(c, "eevp_below_95")} races have counted less than ${t(x, "nearly_complete_eevp")} percent of their expected vote, and the least counted race stands at ${d(c, "eevp_min")} of its expected vote. Every finding below rests on these partial, unofficial counts, which will change as counting continues.`,
		),
		no_2026_data: variant(
			(c) =>
				`No 2026 race in this run comes from AP's results, so there are no 2026 AP counts to report. The run lists ${d(c, "races_2026")} races for 2026 from other sources. Read the findings below that depend on 2026 results with that gap in mind.`,
		),
	},
	seat_shift: {
		toward_dem: variant(
			(c, x) =>
				`Across ${d(c, "n")} comparable ${races(x)}, the median margin moved ${d(c, "median_margin_change")} toward Democrats against each seat's prior election, and the Democratic margin improved in ${d(c, "share_toward_dem")} of those races. ${PARTIAL}`,
		),
		toward_rep: variant(
			(c, x) =>
				`Across ${d(c, "n")} comparable ${races(x)}, the median margin change against each seat's prior election was ${d(c, "median_margin_change")}, a move toward Republicans, and the Democratic margin improved in ${d(c, "share_toward_dem")} of those races. ${PARTIAL}`,
		),
		no_clear_shift: variant(
			(c, x) =>
				`Across ${d(c, "n")} comparable ${races(x)}, the median margin change against each seat's prior election was ${d(c, "median_margin_change")}, which lies between minus ${t(x, "shift_points")} and plus ${t(x, "shift_points")}, so this rule finds no clear shift toward either party. The Democratic margin improved in ${d(c, "share_toward_dem")} of those races. ${PARTIAL}`,
		),
		insufficient_data: variant(
			(c, x) =>
				`Only ${d(c, "n")} comparable ${races(x)} have a margin change in the 2026 counts so far, fewer than the ${t(x, "min_comparable_races")} this finding requires, so no shift is reported.`,
		),
	},
	party_flips: {
		none: variant(
			(c, x) =>
				`In none of the ${d(c, "n")} comparable ${races(x)} did the party leading the two party vote change against the seat's prior election, so there are ${d(c, "dem_gains")} Democratic gains and ${d(c, "rep_gains")} Republican gains. A lead in partial, unofficial counts is not a called race, so these counts can change.`,
		),
		dem_net_gain: variant(
			(c, x) =>
				`Of ${d(c, "n")} comparable ${races(x)}, ${d(c, "dem_gains")} moved from a Republican lead in the seat's prior election to a Democratic lead in the 2026 counts, and ${d(c, "rep_gains")} moved the other way, a net gain for Democrats. A lead in partial, unofficial counts is not a called race, so these counts can change.`,
		),
		rep_net_gain: variant(
			(c, x) =>
				`Of ${d(c, "n")} comparable ${races(x)}, ${d(c, "rep_gains")} moved from a Democratic lead in the seat's prior election to a Republican lead in the 2026 counts, and ${d(c, "dem_gains")} moved the other way, a net gain for Republicans. A lead in partial, unofficial counts is not a called race, so these counts can change.`,
		),
		even_exchange: variant(
			(c, x) =>
				`Of ${d(c, "n")} comparable ${races(x)}, ${d(c, "dem_gains")} moved from a Republican lead in the seat's prior election to a Democratic lead in the 2026 counts, and ${d(c, "rep_gains")} moved from a Democratic lead to a Republican lead, an even exchange. A lead in partial, unofficial counts is not a called race, so these counts can change.`,
		),
		insufficient_data: variant(
			(c, x) =>
				`Only ${d(c, "n")} comparable ${races(x)} have both a prior margin and a 2026 margin so far, fewer than the ${t(x, "min_comparable_races")} this finding requires, so no change of leading party is reported.`,
		),
	},
	seat_shift_by_lean: {
		toward_dem: variant(
			(c, x) =>
				`Across ${d(c, "n")} comparable ${group(x)}, the median margin moved ${d(c, "median_margin_change")} toward Democrats against each seat's prior election, and the Democratic margin improved in ${d(c, "share_toward_dem")} of those races. ${leftOut(c)} ${PARTIAL}`,
		),
		toward_rep: variant(
			(c, x) =>
				`Across ${d(c, "n")} comparable ${group(x)}, the median margin change against each seat's prior election was ${d(c, "median_margin_change")}, a move toward Republicans, and the Democratic margin improved in ${d(c, "share_toward_dem")} of those races. ${leftOut(c)} ${PARTIAL}`,
		),
		no_clear_shift: variant(
			(c, x) =>
				`Across ${d(c, "n")} comparable ${group(x)}, the median margin change against each seat's prior election was ${d(c, "median_margin_change")}, which lies between minus ${t(x, "shift_points")} and plus ${t(x, "shift_points")}, so this rule finds no clear shift toward either party in the group. The Democratic margin improved in ${d(c, "share_toward_dem")} of those races. ${leftOut(c)} ${PARTIAL}`,
		),
		insufficient_data: variant(
			(c, x) =>
				`Only ${d(c, "n")} comparable ${group(x)} have a margin change in the 2026 counts so far, fewer than the ${t(x, "min_comparable_races")} this finding requires, so no shift is reported for the group. ${leftOut(c)}`,
		),
	},
	party_flips_by_lean: {
		none: variant(
			(c, x) =>
				`In none of the ${d(c, "n")} comparable ${group(x)} did the party leading the two party vote change against the seat's prior election, so the group has ${d(c, "dem_gains")} Democratic gains and ${d(c, "rep_gains")} Republican gains. ${leftOut(c)} A lead in partial, unofficial counts is not a called race, so these counts can change.`,
		),
		dem_net_gain: variant(
			(c, x) =>
				`Of ${d(c, "n")} comparable ${group(x)}, ${d(c, "dem_gains")} moved from a Republican lead in the seat's prior election to a Democratic lead in the 2026 counts, and ${d(c, "rep_gains")} moved the other way, a net gain for Democrats in the group. ${leftOut(c)} A lead in partial, unofficial counts is not a called race, so these counts can change.`,
		),
		rep_net_gain: variant(
			(c, x) =>
				`Of ${d(c, "n")} comparable ${group(x)}, ${d(c, "rep_gains")} moved from a Democratic lead in the seat's prior election to a Republican lead in the 2026 counts, and ${d(c, "dem_gains")} moved the other way, a net gain for Republicans in the group. ${leftOut(c)} A lead in partial, unofficial counts is not a called race, so these counts can change.`,
		),
		even_exchange: variant(
			(c, x) =>
				`Of ${d(c, "n")} comparable ${group(x)}, ${d(c, "dem_gains")} moved from a Republican lead in the seat's prior election to a Democratic lead in the 2026 counts, and ${d(c, "rep_gains")} moved from a Democratic lead to a Republican lead, an even exchange in the group. ${leftOut(c)} A lead in partial, unofficial counts is not a called race, so these counts can change.`,
		),
		insufficient_data: variant(
			(c, x) =>
				`Only ${d(c, "n")} comparable ${group(x)} have both a prior margin and a 2026 margin so far, fewer than the ${t(x, "min_comparable_races")} this finding requires, so no change of leading party is reported for the group. ${leftOut(c)}`,
		),
	},
	incumbency_party_gap: {
		rep_lower: variant(
			(c, x) =>
				`For 2026 ${group(x)}, the estimated incumbency bonus is ${d(c, "dem_bonus")} for ${d(c, "dem_seats")} Democratic incumbents and ${d(c, "rep_bonus")} for ${d(c, "rep_seats")} Republican incumbents. The Republican bonus is the lower one, by ${d(c, "wald_diff")} (the Democratic bonus minus the Republican bonus), and the Wald test of equal bonuses gives p ${d(c, "wald_p")}, below the ${t(x, "p_tiers", 1)} cut this finding uses. The estimate rests on partial, unofficial counts, and it measures a difference without explaining it.`,
		),
		dem_lower: variant(
			(c, x) =>
				`For 2026 ${group(x)}, the estimated incumbency bonus is ${d(c, "dem_bonus")} for ${d(c, "dem_seats")} Democratic incumbents and ${d(c, "rep_bonus")} for ${d(c, "rep_seats")} Republican incumbents. The Democratic bonus is the lower one, with a difference of ${d(c, "wald_diff")} (the Democratic bonus minus the Republican bonus), and the Wald test of equal bonuses gives p ${d(c, "wald_p")}, below the ${t(x, "p_tiers", 1)} cut this finding uses. The estimate rests on partial, unofficial counts, and it measures a difference without explaining it.`,
		),
		no_difference: variant(
			(c, x) =>
				`For 2026 ${group(x)}, the estimated incumbency bonus is ${d(c, "dem_bonus")} for ${d(c, "dem_seats")} Democratic incumbents and ${d(c, "rep_bonus")} for ${d(c, "rep_seats")} Republican incumbents, a difference of ${d(c, "wald_diff")}. The Wald test of equal bonuses gives p ${d(c, "wald_p")}, which is not below the ${t(x, "p_tiers", 1)} cut, so this finding reports no difference between the parties. That result is not evidence that the two bonuses are equal, and it uses partial, unofficial counts.`,
		),
		insufficient_data: variant(
			(c, x) =>
				`For 2026 ${group(x)}, the fit has ${d(c, "dem_seats")} Democratic and ${d(c, "rep_seats")} Republican running incumbents. Without a bonus estimate for both parties the Wald test cannot run, so no gap between the parties is reported. A party's bonus needs at least ${t(x, "min_seats")} running incumbents.`,
		),
	},
	significance: {
		p_below_0_05: variant(
			(c, x) =>
				`For 2026 ${group(x)}, the Wald test of equal incumbency bonuses for the two parties gives p ${d(c, "wald_p")}, below ${t(x, "p_tiers", 0)}. A gap this large would be unusual if the bonuses were equal, but the test does not show why the bonuses differ, and it uses partial, unofficial counts.`,
		),
		p_below_0_10: variant(
			(c, x) =>
				`For 2026 ${group(x)}, the Wald test of equal incumbency bonuses for the two parties gives p ${d(c, "wald_p")}, below ${t(x, "p_tiers", 1)} but not below ${t(x, "p_tiers", 0)}. That is weak evidence against equal bonuses, and it uses partial, unofficial counts.`,
		),
		p_at_or_above_0_10: variant(
			(c, x) =>
				`For 2026 ${group(x)}, the Wald test of equal incumbency bonuses for the two parties gives p ${d(c, "wald_p")}, at or above ${t(x, "p_tiers", 1)}, so the test cannot distinguish the two parties' bonuses in this group. The test uses partial, unofficial counts.`,
		),
		not_tested: variant(
			(_c, x) =>
				`For 2026 ${group(x)}, no Wald test was run, because the fit lacks a bonus estimate for at least one party.`,
		),
	},
	bonus_vs_history: {
		below_all_prior_years: variant(
			(c, x) =>
				`In 2026 ${group(x)}, the estimated incumbency bonus for ${party(x)} is ${d(c, "bonus_2026")}, below every one of the ${d(c, "prior_years")} earlier election years from 2014 to 2024 with an estimate, which ranged from ${d(c, "prior_min")} to ${d(c, "prior_max")}. The 2026 estimate rests on partial, unofficial counts and has no test against the earlier years.`,
		),
		within_prior_range: variant(
			(c, x) =>
				`In 2026 ${group(x)}, the estimated incumbency bonus for ${party(x)} is ${d(c, "bonus_2026")}, inside or at the edge of the range from ${d(c, "prior_min")} to ${d(c, "prior_max")} set by the ${d(c, "prior_years")} earlier election years from 2014 to 2024 with an estimate. The 2026 estimate rests on partial, unofficial counts.`,
		),
		above_all_prior_years: variant(
			(c, x) =>
				`In 2026 ${group(x)}, the estimated incumbency bonus for ${party(x)} is ${d(c, "bonus_2026")}, above every one of the ${d(c, "prior_years")} earlier election years from 2014 to 2024 with an estimate, which ranged from ${d(c, "prior_min")} to ${d(c, "prior_max")}. The 2026 estimate rests on partial, unofficial counts and has no test against the earlier years.`,
		),
		insufficient_data: variant(
			(c, x) =>
				`In 2026 ${group(x)}, the bonus for ${party(x)} is not compared with history, because either the 2026 fit has no estimate for them or fewer than ${t(x, "min_prior_years")} earlier election years from 2014 to 2024 have one. The number of earlier years with an estimate is ${d(c, "prior_years")}.`,
		),
	},
	turnout_explanation: {
		turnout_plausible_majority: variant(
			(c, x) =>
				`Of ${d(c, "n")} checked 2026 ${races(x)}, ${d(c, "plausible")} (${d(c, "share_plausible")}) need a turnout change that fits within the ballots actually added. In those races, the extra Democratic votes that turnout alone would have to supply, with no voter changing sides, are no more than the observed change in votes cast plus the slack. That is more than half of the checked races. A turnout change that fits does not show that turnout was the cause, and partial counts understate 2026 vote totals.`,
		),
		persuasion_needed_majority: variant(
			(c, x) =>
				`Of ${d(c, "n")} checked 2026 ${races(x)}, ${d(c, "plausible")} (${d(c, "share_plausible")}) need a turnout change that fits within the ballots actually added, which is fewer than half of the checked races. In the rest, explaining the result through turnout alone would take more extra Democratic votes than the observed change in votes cast plus the slack provides, so under this check's assumptions those races also need vote switching or other changes in the electorate. Partial counts understate 2026 vote totals, which affects this check.`,
		),
		evenly_split: variant(
			(c, x) =>
				`Of ${d(c, "n")} checked 2026 ${races(x)}, ${d(c, "plausible")} (${d(c, "share_plausible")}) need a turnout change that fits within the ballots actually added, exactly half of the checked races. In the other half, turnout alone would take more extra Democratic votes than the observed change in votes cast plus the slack provides. Partial counts understate 2026 vote totals, which affects this check.`,
		),
		insufficient_data: variant(
			(c, x) =>
				`Only ${d(c, "n")} 2026 ${races(x)} have a turnout check so far, fewer than the ${t(x, "min_comparable_races")} this finding requires, so no count of races that turnout alone could explain is reported. The check needs the ballots actually added, which a redrawn race takes from statewide turnout that may not be published yet.`,
		),
	},
	k_direction: {
		dem_relative_gain: variant(
			(c, x) =>
				`Across ${d(c, "n")} 2026 ${races(x)} with a k, the median k is ${d(c, "median_k")}, above ${t(x, "k_parity_band", 1)}. If no voter changed sides, explaining the typical race would take Democratic turnout rising by that ratio relative to Republican turnout against each seat's prior election. The ratio uses partial, unofficial counts, and it states the turnout change that would be necessary, not one that was observed.`,
		),
		rep_relative_gain: variant(
			(c, x) =>
				`Across ${d(c, "n")} 2026 ${races(x)} with a k, the median k is ${d(c, "median_k")}, below ${t(x, "k_parity_band", 0)}. If no voter changed sides, explaining the typical race would take Republican turnout rising relative to Democratic turnout against each seat's prior election, with Democratic turnout at that ratio of Republican turnout. The ratio uses partial, unofficial counts, and it states the turnout change that would be necessary, not one that was observed.`,
		),
		near_parity: variant(
			(c, x) =>
				`Across ${d(c, "n")} 2026 ${races(x)} with a k, the median k is ${d(c, "median_k")}, inside the band from ${t(x, "k_parity_band", 0)} to ${t(x, "k_parity_band", 1)}. If no voter changed sides, explaining the typical race would take nearly the same proportional change in both parties' turnout against each seat's prior election. The ratio uses partial, unofficial counts, and it states the turnout change that would be necessary, not one that was observed.`,
		),
		insufficient_data: variant(
			(c, x) =>
				`Only ${d(c, "n")} 2026 ${races(x)} have a k so far, fewer than the ${t(x, "min_comparable_races")} this finding requires, so no necessary turnout change is reported.`,
		),
	},
	dummymander: {
		redrawn_incumbents_worse: variant(
			(c, x) =>
				`In 2026, House incumbents running in states with a newly drawn mid cycle map changed their party's two party share by ${d(c, "redrawn_mean")} on average across ${d(c, "redrawn_races")} races, against ${d(c, "not_redrawn_mean")} across ${d(c, "not_redrawn_races")} races elsewhere. The difference is ${d(c, "difference")}, at or below minus ${t(x, "dummymander_points")}, so incumbents in redrawn states did worse than the rest by this measure. This is a raw difference of means with no significance test, on partial, unofficial counts, and it does not show that the new maps caused the gap.`,
		),
		redrawn_incumbents_better: variant(
			(c, x) =>
				`In 2026, House incumbents running in states with a newly drawn mid cycle map changed their party's two party share by ${d(c, "redrawn_mean")} on average across ${d(c, "redrawn_races")} races, against ${d(c, "not_redrawn_mean")} across ${d(c, "not_redrawn_races")} races elsewhere. The difference is ${d(c, "difference")}, at or above plus ${t(x, "dummymander_points")}, so incumbents in redrawn states did better than the rest by this measure. This is a raw difference of means with no significance test, on partial, unofficial counts, and it does not show that the new maps caused the gap.`,
		),
		no_clear_difference: variant(
			(c, x) =>
				`In 2026, House incumbents running in states with a newly drawn mid cycle map changed their party's two party share by ${d(c, "redrawn_mean")} on average across ${d(c, "redrawn_races")} races, against ${d(c, "not_redrawn_mean")} across ${d(c, "not_redrawn_races")} races elsewhere. The difference is ${d(c, "difference")}, between minus ${t(x, "dummymander_points")} and plus ${t(x, "dummymander_points")}, so this rule finds no clear difference. This is a raw difference of means with no significance test, on partial, unofficial counts.`,
		),
		insufficient_data: variant(
			(c, x) =>
				`The 2026 comparison has ${d(c, "redrawn_races")} incumbent races in redrawn states and ${d(c, "not_redrawn_races")} elsewhere. Each group needs at least ${t(x, "min_group_races")} races with a mean change, so no difference is reported.`,
		),
	},
	dummymander_vs_history: {
		largest_gap_on_record: variant(
			(c) =>
				`The 2026 difference of ${d(c, "difference")} is larger in size than the difference in any earlier year with a mid cycle map, where the largest was ${d(c, "prior_max_abs")} in ${d(c, "prior_max_year")}. Both are raw differences of means with no significance test, and the 2026 figure uses partial, unofficial counts.`,
		),
		within_prior_range: variant(
			(c) =>
				`The 2026 difference of ${d(c, "difference")} is no larger in size than the largest earlier difference, ${d(c, "prior_max_abs")} in ${d(c, "prior_max_year")}. Both are raw differences of means with no significance test, and the 2026 figure uses partial, unofficial counts.`,
		),
		insufficient_data: variant(
			(c) =>
				`The 2026 difference is not compared with history, because the 2026 comparison has insufficient data or no earlier year has a difference. The earlier year with the largest difference is listed as ${d(c, "prior_max_year")}.`,
		),
	},
	dummymander_party: {
		redrawn_toward_dem: variant(
			(c, x) =>
				`In 2026, all House races in states with a newly drawn mid cycle map, open seats included, changed the Democratic two party share by ${d(c, "redrawn_mean")} on average across ${d(c, "redrawn_races")} races, against ${d(c, "not_redrawn_mean")} across ${d(c, "not_redrawn_races")} races elsewhere. The difference is ${d(c, "difference")}, at or above plus ${t(x, "dummymander_points")}, so the Democratic share moved further toward the Democrats in redrawn states than elsewhere, which is the Republican share moving the other way. This is a raw difference of means with no significance test, on partial, unofficial counts, and it does not show that the new maps caused the gap.`,
		),
		redrawn_toward_rep: variant(
			(c, x) =>
				`In 2026, all House races in states with a newly drawn mid cycle map, open seats included, changed the Democratic two party share by ${d(c, "redrawn_mean")} on average across ${d(c, "redrawn_races")} races, against ${d(c, "not_redrawn_mean")} across ${d(c, "not_redrawn_races")} races elsewhere. The difference is ${d(c, "difference")}, at or below minus ${t(x, "dummymander_points")}, so the Democratic share moved further toward the Republicans in redrawn states than elsewhere. This is a raw difference of means with no significance test, on partial, unofficial counts, and it does not show that the new maps caused the gap.`,
		),
		no_clear_difference: variant(
			(c, x) =>
				`In 2026, all House races in states with a newly drawn mid cycle map, open seats included, changed the Democratic two party share by ${d(c, "redrawn_mean")} on average across ${d(c, "redrawn_races")} races, against ${d(c, "not_redrawn_mean")} across ${d(c, "not_redrawn_races")} races elsewhere. The difference is ${d(c, "difference")}, between minus ${t(x, "dummymander_points")} and plus ${t(x, "dummymander_points")}, so this rule finds no clear difference by party. This is a raw difference of means with no significance test, on partial, unofficial counts.`,
		),
		insufficient_data: variant(
			(c, x) =>
				`The 2026 comparison has ${d(c, "redrawn_races")} House races in redrawn states and ${d(c, "not_redrawn_races")} elsewhere. Each group needs at least ${t(x, "min_group_races")} races with a mean change, so no party difference is reported.`,
		),
	},
	dummymander_test: {
		consistent_with_wash: variant(
			(c, x) =>
				`In this comparison, the 2026 gap between redrawn and other House races is ${d(c, "difference_2026")}, against a year adjusted gap of ${d(c, "difference")} across the earlier years from 2014 to 2024 (redrawn mean ${d(c, "redrawn_mean")} across ${d(c, "redrawn_races")} races, other mean ${d(c, "not_redrawn_mean")} across ${d(c, "not_redrawn_races")} races). The null is that redistricting is a wash, because both parties redraw, so the expected gap is zero. The p value for a zero gap is ${d(c, "p_2026")} in 2026 and ${d(c, "p_hist")} for the earlier years, and the p value that 2026 differs from the earlier gap, a difference of ${d(c, "excess")}, is ${d(c, "p_excess")}. The 2026 p value is at or above ${t(x, "p_tiers", 0)}, so the data are consistent with a wash. The test clusters standard errors by state and uses a normal approximation, 2026 uses partial, unofficial counts, and the test cannot show what caused any gap.`,
		),
		not_a_wash: variant(
			(c, x) =>
				`In this comparison, the 2026 gap between redrawn and other House races is ${d(c, "difference_2026")}, against a year adjusted gap of ${d(c, "difference")} across the earlier years from 2014 to 2024 (redrawn mean ${d(c, "redrawn_mean")} across ${d(c, "redrawn_races")} races, other mean ${d(c, "not_redrawn_mean")} across ${d(c, "not_redrawn_races")} races). The null is that redistricting is a wash, because both parties redraw, so the expected gap is zero. The p value for a zero gap is ${d(c, "p_2026")} in 2026 and ${d(c, "p_hist")} for the earlier years, and the p value that 2026 differs from the earlier gap, a difference of ${d(c, "excess")}, is ${d(c, "p_excess")}. The 2026 p value is below ${t(x, "p_tiers", 0)}, so a wash is unlikely by this measure and the gap is not explained by chance alone. The test clusters standard errors by state and uses a normal approximation, 2026 uses partial, unofficial counts, and the test cannot show what caused any gap.`,
		),
		insufficient_data: variant(
			(c, x) =>
				`The earlier years from 2014 to 2024 have ${d(c, "redrawn_races")} redrawn races and ${d(c, "not_redrawn_races")} other races, or the 2026 test could not be fit. Each group needs at least ${t(x, "min_group_races")} races, so the wash test is not reported.`,
		),
	},
} satisfies Record<string, Record<string, Variant>>;

export type Family = keyof typeof VARIANTS;

/** The 72 selector keys, in the order the page renders them. */
export function selectorKeys(): string[] {
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
				const g = `${def}.${office}.${lean}`;
				keys.push(`incumbency_party_gap.${g}`, `significance.${g}`);
				for (const p of PARTIES) keys.push(`bonus_vs_history.${g}.${p}`);
			}
		}
	}
	keys.push(
		"dummymander.house",
		"dummymander_vs_history.house",
		"dummymander_party.house",
		"dummymander_test.incumbent",
		"dummymander_test.party",
	);
	return keys;
}

function isObject(value: unknown): value is Record<string, unknown> {
	return typeof value === "object" && value !== null && !Array.isArray(value);
}

/**
 * Parses findings.json text into a typed Findings, or names the first problem.
 * Checks the schema version, the members the page renders, that every
 * selector key is present with a known value, and that each claim agrees with
 * its selector.
 */
export function parseFindings(text: string): Findings | InvalidFindings {
	let data: unknown;
	try {
		data = JSON.parse(text);
	} catch (e) {
		return { problem: `the file is not JSON (${(e as Error).message})` };
	}
	if (!isObject(data)) return { problem: "the file is not a JSON object" };
	if (data.schema_version !== 1) {
		return {
			problem: `schema_version is ${JSON.stringify(data.schema_version)}, and this page reads version 1`,
		};
	}
	const run = data.run;
	if (!isObject(run) || typeof run.generated_at !== "string") {
		return { problem: "run.generated_at is missing" };
	}
	if (!Array.isArray(run.inputs) || !Array.isArray(run.sources)) {
		return { problem: "run.inputs or run.sources is missing" };
	}
	if (!isObject(run.counts_2026))
		return { problem: "run.counts_2026 is missing" };
	if (!Array.isArray(data.sources)) return { problem: "sources is missing" };
	if (!isObject(data.questions)) return { problem: "questions is missing" };
	for (const q of QUESTIONS) {
		const entry = data.questions[q];
		if (
			!isObject(entry) ||
			!Array.isArray(entry.sql) ||
			!Array.isArray(entry.raw_results)
		) {
			return { problem: `questions.${q} lacks its sql or raw_results` };
		}
	}
	for (const member of ["thresholds", "rules", "selectors", "claims"]) {
		if (!isObject(data[member])) return { problem: `${member} is missing` };
	}
	const selectors = data.selectors as Record<string, unknown>;
	const claims = data.claims as Record<string, unknown>;
	const expected = selectorKeys();
	const known = new Set(expected);
	for (const key of Object.keys(selectors)) {
		if (!known.has(key))
			return { problem: `selectors has an unknown key ${key}` };
	}
	for (const key of expected) {
		const value = selectors[key];
		if (typeof value !== "string") {
			return { problem: `selectors is missing ${key}` };
		}
		const family = key.split(".")[0] as Family;
		if (!(value in VARIANTS[family])) {
			return { problem: `selectors.${key} has an unknown value ${value}` };
		}
		const claim = claims[key];
		if (
			!isObject(claim) ||
			!isObject(claim.display) ||
			!Array.isArray(claim.trigger_fields)
		) {
			return { problem: `claims.${key} is missing or incomplete` };
		}
		if (claim.value !== value) {
			return {
				problem: `claims.${key} has value ${String(claim.value)}, which differs from its selector ${value}`,
			};
		}
	}
	return data as unknown as Findings;
}

/** The findings file the build reads: ELECTION_FINDINGS, else the committed out/findings.json. */
export function findingsPath(env: NodeJS.ProcessEnv): string {
	return (
		env.ELECTION_FINDINGS || join(import.meta.dirname, "out", "findings.json")
	);
}

// Sets data-* attributes, which the typed jiffies attribute objects do not name.
function data<T extends Element>(node: T, attrs: Record<string, string>): T {
	for (const [k, v] of Object.entries(attrs)) node.setAttribute(`data-${k}`, v);
	return node;
}

function contextOf(
	key: string,
	thresholds: Record<string, unknown>,
): VariantContext {
	const parts = key.split(".");
	const family = parts[0];
	if (
		family === "incumbency_party_gap" ||
		family === "significance" ||
		family === "bonus_vs_history"
	) {
		return {
			leanDef: parts[1] as LeanDef,
			office: parts[2] as Office,
			lean: parts[3],
			party: parts[4] as Party | undefined,
			thresholds,
		};
	}
	if (family === "seat_shift_by_lean" || family === "party_flips_by_lean") {
		return {
			leanDef: "presidential",
			office: parts[1] as Office,
			lean: parts[2],
			thresholds,
		};
	}
	return { office: (parts[1] as Office | undefined) ?? "house", thresholds };
}

function renderSelector(f: Findings, key: string): HTMLElement {
	const family = key.split(".")[0] as Family;
	const value = f.selectors[key];
	const variants = VARIANTS[family] as Record<string, Variant>;
	const node = variants[value](f.claims[key], contextOf(key, f.thresholds));
	return data(node, { selector: key, value });
}

function show(value: unknown): string {
	if (value === null || value === undefined) return NOT_AVAILABLE;
	return typeof value === "string" ? value : JSON.stringify(value);
}

const CSS = `
.election-findings { max-width: 62rem; margin: 0 auto; padding: 1rem 16px 3rem; }
.election-findings section { margin-block: 2rem; }
.election-findings [data-role="ap-caveat"] { border-left: 4px solid var(--brand-color, #b45309); padding: 0.5rem 1rem; background: color-mix(in oklch, var(--brand-color, #b45309) 10%, transparent); }
.election-findings [data-role="completeness-banner"] { border: 1px solid color-mix(in oklch, currentColor 25%, transparent); border-radius: 0.5rem; padding: 0.75rem 1rem; }
.election-findings .ef-scroll { overflow-x: auto; max-width: 100%; }
.election-findings table { font-size: 0.85rem; }
.election-findings pre { overflow: auto; max-height: 26rem; max-width: 100%; font-size: 0.8rem; white-space: pre; }
.election-findings details.ef-listing { margin: 0.75rem 0; max-width: 100%; }
.election-findings details.ef-listing > summary { cursor: pointer; overflow-wrap: anywhere; }
.election-findings :is(pre, code, kbd, samp, .ef-mono) { font-family: var(--monospace-font-family, ui-monospace), ui-monospace, SFMono-Regular, Menlo, Consolas, "Liberation Mono", monospace; }
.election-findings .ef-sha { font-size: 0.75rem; overflow-wrap: anywhere; }
.election-findings :is(td, th).ef-num { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
.election-findings .ef-numbers th[scope="row"] { white-space: nowrap; }
.election-findings .ef-legend { font-size: 0.8rem; }
.election-findings dl.ef-formulas { display: block; max-width: 100%; }
.election-findings dl.ef-formulas dt { display: block; font-weight: 600; }
.election-findings dl.ef-formulas dd { display: block; margin: 0 0 1rem 0; min-width: 0; max-width: 100%; }
.election-findings dl.ef-formulas pre { max-height: none; }
.election-findings .ef-raw td, .election-findings .ef-raw th { white-space: nowrap; }
.election-findings .ef-source dt { font-weight: 600; }
.election-findings .ef-source dd { margin: 0 0 0.5rem 0; overflow-wrap: anywhere; }
.election-findings [data-role="audit"] code { overflow-wrap: anywhere; }
`;

function caveat(): HTMLElement {
	return data(aside({}, p({}, "2026 counts are unofficial and partial.")), {
		role: "ap-caveat",
	});
}

function pageHeader(): HTMLElement {
	return header(
		{},
		h1({}, "2026 election findings"),
		p(
			{},
			"This report answers four questions about the 2026 House, Senate, and governor elections. Every sentence in it was written in advance for every possible answer, and the build chooses one sentence per finding from findings.json, the auditable file that findings.py writes.",
		),
	);
}

function shell(state: string, ...children: Node[]): HTMLElement {
	return data(main({ class: "election-findings" }, ...children), { state });
}

function noFindingsState(path: string): HTMLElement {
	return shell(
		"no-findings",
		pageHeader(),
		caveat(),
		section(
			{},
			h2({}, "No findings"),
			p({}, `No findings file was found at ${path}.`),
			p(
				{},
				"To make one, run these commands in pages/election_results, then rebuild the site:",
			),
			pre(
				{},
				code(
					{},
					"uv run pull.py --refresh 2026\nuv run analyze.py --out out\nuv run findings.py --out out",
				),
			),
			p({}, "Set ELECTION_FINDINGS to read a findings file from another path."),
		),
	);
}

function invalidFindingsState(path: string, problem: string): HTMLElement {
	return shell(
		"invalid-findings",
		pageHeader(),
		caveat(),
		section(
			{},
			h2({}, "Invalid findings"),
			p(
				{},
				`The findings file at ${path} cannot be shown, because ${problem}.`,
			),
			p(
				{},
				"Rerun the command below in pages/election_results, then rebuild the site. Run it with --check FILE to validate a file without writing one.",
			),
			pre({}, code({}, "uv run findings.py --out out")),
		),
	);
}

function sourcesOverview(f: Findings): HTMLElement {
	return data(
		section(
			{},
			h2({}, "Data sources"),
			p(
				{},
				"The pipeline joins the sources below into races.csv and candidates.csv, builds a DuckDB database from them, and writes one answer file per question. Fetch times and row counts come from candidates.csv for the sources it holds, and are not available for sources that reach the answers through another file.",
			),
			...f.sources.map((s) =>
				div(
					{ class: "ef-source" },
					h3({}, s.name),
					dl(
						{},
						dt({}, "Supplies"),
						dd({}, s.supplies),
						dt({}, "Location"),
						dd(
							{},
							s.location.startsWith("https://")
								? a({ href: s.location }, code({}, s.location))
								: code({}, s.location),
						),
						dt({}, "Latest fetch"),
						dd({}, show(s.fetched_at)),
						dt({}, "Rows in candidates.csv"),
						dd({}, show(s.rows)),
						dt({}, "Notes"),
						dd({}, s.notes),
					),
				),
			),
		),
		{ role: "sources" },
	);
}

interface Formula {
	name: string;
	formula: string;
	meaning: string;
}

interface Method {
	title: string;
	question: string;
	methodology: string[];
	formulas: Formula[];
}

const METHODS: Record<Question, Method> = {
	seat_change: {
		title: "Question 1: how far did each seat move?",
		question:
			"How far did each 2026 race move against the previous election for the same seat, and how many seats changed their leading party?",
		methodology: [
			"A seat is a House district (district 0 for an at large state), a Senate class, or a governorship. The prior election for a 2026 race is the most recent earlier election for the same seat, general or special, from 2008 on. When a special and a regular election for one seat fall in the same year, the regular one is the prior.",
			"A race is comparable only when the seat has a prior election, the race is not the first House election on a new census map, and both elections have Democratic and Republican vote counts above zero. A seat whose prior election was uncontested is therefore not comparable. A mid cycle redraw leaves a race comparable, and the redrawn flag marks it.",
			"Margins are measured in points of the two party vote, so votes for other candidates do not enter them. A positive margin is a Democratic lead. The seat shift finding takes the median margin change across an office's comparable races, and the party flips finding counts comparable races whose margin changed sign.",
			"The same measures are also split by the state's presidential lean. A race takes its state's lean for the race year from the most recent presidential election strictly before that year, so a 2026 race uses the 2024 presidential result. A state whose Democratic minus Republican presidential margin is 5.0 points or less in absolute value is a swing state, and any other state is red or blue by the presidential winner. Each lean group of an office reports its comparable races, the races it leaves out as not comparable, the median margin change, the share of races moving toward Democrats, and the changes of leading party. A group with fewer comparable races than the minimum the overall findings use reports insufficient data. The lean describes the state, not the district, so a House district can lean differently from its state.",
			"The 2026 counts are AP's unofficial and partial counts, so every 2026 margin reflects only the ballots counted when AP's results were fetched.",
		],
		formulas: [
			{
				name: "Two party share",
				formula: "s = D ÷ (D + R)",
				meaning:
					"D and R are the Democratic and Republican vote counts in the race. The share is undefined when either count is missing.",
			},
			{
				name: "Margin",
				formula: "m = (2s − 1) × 100",
				meaning:
					"The Democratic minus the Republican share of the two party vote, in points.",
			},
			{
				name: "Margin change",
				formula: "Δm = m₂₀₂₆ − m_prior",
				meaning:
					"A positive change is a move toward the Democrat against the seat's prior election.",
			},
			{
				name: "Seat shift",
				formula:
					"median(Δm) over comparable races\nshare toward Democrats = count(Δm > 0) ÷ n",
				meaning:
					"The median is compared with the shift_points threshold in both directions.",
			},
			{
				name: "Presidential lean",
				formula:
					"swing   when |P_D − P_R| ≤ 5.0\nblue    when P_D − P_R > 5.0\nred     when P_D − P_R < −5.0",
				meaning:
					"P_D and P_R are the Democratic and Republican shares of all presidential votes in the state, in points, from the latest presidential election strictly before the race year.",
			},
			{
				name: "Flip",
				formula:
					"Democratic gain: m_prior < 0 < m₂₀₂₆\nRepublican gain: m_prior > 0 > m₂₀₂₆",
				meaning:
					"A flip is a change in the sign of the margin, which is a change in the party leading the two party vote.",
			},
		],
	},
	incumbency: {
		title: "Question 2: how large is the incumbency bonus for each party?",
		question:
			"How much extra two party share does a party gain when its incumbent runs, and do the two parties' bonuses differ?",
		methodology: [
			"The incumbency bonus is the extra two party share a party's candidate receives when the party's incumbent runs, compared with an open seat that the party defends. The estimate follows the Gelman and King approach: an ordinary least squares regression of the Democratic two party share on the prior Democratic two party share, an indicator for a Democratic win in the prior election, year effects, and two incumbency indicators, one for a running Democratic incumbent and one for a running Republican incumbent. Open seats are the baseline.",
			"The Democratic bonus is the coefficient on the Democratic indicator. The Republican bonus is the negative of the coefficient on the Republican indicator, so each bonus is measured in its own party's direction. A Wald test asks whether the two bonuses are equal, which in the raw coefficients is the hypothesis that their sum is zero. Its p value is two sided under a normal approximation, from the ordinary least squares covariance of the coefficients.",
			"The population is comparable races from 2014 on, without House races that pair two incumbents. A senator is the incumbent only after two continuous years in the seat. A House member is the incumbent of the district whose ballot carries their name, so a member moved by a redraw is the incumbent where they run. An independent who caucuses with a party counts as that party's incumbent, and their votes stand in for that party's votes in the race and in the prior race.",
			"States are grouped by presidential lean: a state is red or blue when the latest earlier presidential margin exceeds 5 points, and swing otherwise. Each office and group is fit separately for each election year, and once pooled across years with year effects. The 2026 findings use the 2026 fit, which covers a single year and so has no year effects. A party with fewer than five running incumbents in a fit gets no estimate, and the Wald test then does not run. The bonus history compares the 2026 estimate with the estimates for each year from 2014 to 2024.",
		],
		formulas: [
			{
				name: "Regression",
				formula:
					"sᵢ = α + β₁·s_prior,ᵢ + β₂·W_prior,ᵢ + Σₜ γₜ·Yₜ,ᵢ + β_D·I_D,ᵢ + β_R·I_R,ᵢ + εᵢ",
				meaning:
					"sᵢ is the Democratic two party share in points, W_prior is 1 when the Democrat won the prior election, Yₜ is an indicator for each year after the first, and I_D and I_R are 1 when a Democratic or a Republican incumbent runs. A column that adds no rank, for example W_prior when every prior winner in a group is a Democrat, is dropped.",
			},
			{
				name: "Bonuses",
				formula: "DEM bonus = β_D\nREP bonus = −β_R",
				meaning: "Each bonus is in points of its own party's two party share.",
			},
			{
				name: "Wald test of equal bonuses",
				formula:
					"wald_diff = β_D + β_R   (the DEM bonus minus the REP bonus)\nSE = √(Var β_D + Var β_R + 2 Cov(β_D, β_R))\nz = wald_diff ÷ SE\np = erfc(|z| ÷ √2)",
				meaning:
					"The covariance is σ̂² (XᵀX)⁻¹, with σ̂² the residual sum of squares divided by the residual degrees of freedom. The null hypothesis is β_D = −β_R, that is, equal bonuses.",
			},
		],
	},
	turnout: {
		title:
			"Question 3: What change in turnout alone would be necessary to explain each race?",
		question:
			"For each race, what relative change in Democratic versus Republican turnout would reproduce the observed shift in two party share if no voter changed sides, and do the votes that change implies fit within the ballots actually added?",
		methodology: [
			"This question asks, for each race, what change in turnout alone would be necessary to explain the result. It assumes that no voter changed sides between the seat's prior election and 2026, so each party's vote can change only through how many of its supporters turned out. Under that assumption, a is the ratio of the current to the prior Democratic vote and b is the same ratio for the Republican vote. Their ratio, k, is the relative change in Democratic versus Republican turnout that reproduces the observed shift. A k of 1 means both parties' turnout changed by the same proportion, a k above 1 means Democratic turnout would have had to rise relative to Republican turnout, and a k below 1 means the reverse.",
			"The same change can be stated in votes. Holding the Republican vote at its prior count, D_req is the Democratic vote that gives the current two party share, so required_extra_dem_votes is the number of Democratic ballots that turnout alone would have to add, or remove when it is negative. The plausibility check compares those implied extra votes with the ballots actually added: the race's own change in votes cast on unchanged lines, or, for a race on redrawn lines, the statewide change in ballots from the University of Florida Election Lab scaled by the prior race's share of statewide ballots. A slack of 2 percent of the prior two party vote allows for votes that move between the major party candidates and others. A race is plausible when the implied extra votes fit within the ballots actually added plus the slack, and the check is null when no comparison is available.",
			"For contrast, flip_share gives the opposite reading, with turnout held fixed. It is the share of the prior two party electorate that would have to switch sides to produce the same change, which equals the current minus the prior Democratic two party share.",
			"Because the 2026 counts are partial, the 2026 vote totals are lower than the final totals will be. That lowers a, b, and the ballots actually added, so both k and the plausibility check will move as counting continues.",
		],
		formulas: [
			{
				name: "Necessary relative turnout change",
				formula: "a = D₁ ÷ D₀\nb = R₁ ÷ R₀\nk = a ÷ b",
				meaning:
					"D₀ and R₀ are the prior Democratic and Republican votes, and D₁ and R₁ are the current votes. With no voter changing sides, k is the relative change in Democratic versus Republican turnout that reproduces the observed shift.",
			},
			{
				name: "Implied extra Democratic votes",
				formula:
					"s₁ = D₁ ÷ (D₁ + R₁)\nD_req = R₀ × s₁ ÷ (1 − s₁)\nrequired_extra_dem_votes = D_req − D₀\nk_effective = D_req ÷ D₀   (equal to k)",
				meaning:
					"D_req is the Democratic vote that, with Republican votes held at R₀, gives the current two party share s₁.",
			},
			{
				name: "Ballots actually added, and slack",
				formula:
					"comparison_change = T₁ − T₀   on unchanged lines\ncomparison_change = ΔB_state × (D₀ + R₀) ÷ B₀,state   on redrawn lines\nslack = 0.02 × (D₀ + R₀)",
				meaning:
					"T is the race's total votes, and B is the statewide count of ballots.",
			},
			{
				name: "Plausibility rule",
				formula:
					"if required_extra_dem_votes > 0:\n  plausible = required_extra_dem_votes ≤ max(comparison_change, 0) + slack\nelse:\n  plausible = required_extra_dem_votes ≥ min(comparison_change, 0) − slack",
				meaning:
					"The turnout check finding counts the races where the implied extra votes fit, and the k finding takes the median k.",
			},
			{
				name: "Contrast: persuasion only",
				formula: "flip_share = s₁ − s₀",
				meaning:
					"s is the Democratic two party share as a fraction. A positive value is Republican voters moving to the Democrat.",
			},
		],
	},
	dummymander: {
		title: "Question 4: did redrawn states' incumbents fare differently?",
		question:
			"Did House incumbents in states with a newly drawn mid cycle map do worse or better than incumbents elsewhere in the same year?",
		methodology: [
			"A dummymander is a map drawn to help a party that ends up hurting it. This question looks only at the outcome, without judging the intent of any map. For each year from 2014 to 2026 with at least one mid cycle map first used that year, House incumbents who ran in such a state form the redrawn group, and House incumbents who ran elsewhere form the other group.",
			"Each race's change is the incumbent party's two party share minus its share in the prior election, in points. For a redrawn district, the prior share comes from the previous election for the same district number under the old lines. Comparing the two groups within one year cancels the national tide that moves every race in that year.",
			"The difference is the redrawn mean minus the mean for the other group. It is a raw difference of means with no regression and no significance test, and it does not separate the effect of new lines from other differences between the states that redrew and those that did not. The population is the same as in question 2: comparable races without paired incumbents. The history finding compares the size of the 2026 difference with every earlier year's.",
			"The by party check drops the incumbent restriction. It takes every comparable House race, open seats included, and measures the change in the Democratic two party share, so a map that was drawn to help one party shows up as that party's share moving differently in redrawn states than elsewhere. It does not know which party drew a map, so a reader pairs the sign of the difference with the map's sponsor. A map that backfires shows as a difference against its sponsor.",
			"The Historical rows pool every year from 2014 to 2024 that had a mid cycle map. Their means are plain race weighted means. Their difference is adjusted for each year's national tide, so the means do not subtract to it exactly.",
			"The wash test starts from the null that redistricting nets out because both parties redraw, so the expected gap between redrawn and other races is zero. It fits every race's change in one least squares regression on year effects, a redrawn indicator that covers the earlier years, and a redrawn indicator for 2026 alone. The first indicator's coefficient, β, is the historical gap. The second's, γ, is how far 2026 departs from it, so β + γ is the 2026 gap.",
			"Each p value tests one of those quantities against zero. The estimate is divided by its standard error, which gives a z score, and the p value is the chance of a score at least that far from zero in either direction under a normal curve. Standard errors are clustered by state, which treats races in one state as related and states as independent of each other, and they carry the usual small sample correction. The three p values are p for the 2026 gap, β + γ, which is the wash test proper, p for the historical gap, β, and p for the excess, γ, which asks whether 2026 differs from history.",
			"A small p value for 2026 says the gap would be unlikely if redistricting were a wash. A large one says the data cannot rule a wash out, which is weaker than showing a wash. The normal curve is somewhat generous with few redrawn states in a year, so a p value near 0.05 should be read as borderline. The test cannot say which map or party produced a gap, and 2026 uses partial, unofficial counts.",
		],
		formulas: [
			{
				name: "Incumbent party change",
				formula:
					"changeᵢ = sᵢ − s_prior,ᵢ   for a Democratic incumbent\nchangeᵢ = s_prior,ᵢ − sᵢ   for a Republican incumbent",
				meaning: "s is the Democratic two party share in points.",
			},
			{
				name: "Difference of means",
				formula:
					"difference = mean(change | redrawn) − mean(change | not redrawn)",
				meaning: "Both means are over the same year's House incumbents.",
			},
			{
				name: "History",
				formula:
					"largest on record when |difference₂₀₂₆| > max over earlier years of |differenceₜ|",
				meaning: "Only years with a mid cycle map have a difference.",
			},
			{
				name: "Wash test",
				formula:
					"Δᵢ = year effects + β·redrawnᵢ + γ·redrawnᵢ·[2026] + εᵢ\nH₀: β + γ = 0 (2026 is a wash)   β = 0 (history is a wash)   γ = 0 (2026 matches history)",
				meaning:
					"β is the year adjusted historical gap, γ is the excess of 2026 over it, and β + γ is the 2026 gap. Each p value is 2 × (1 − Φ(|estimate ÷ standard error|)), with Φ the normal distribution function and standard errors clustered by state.",
			},
			{
				name: "Party change",
				formula:
					"Δᵢ = sᵢ − s_prior,ᵢ   for every House race, open seats included\ndifference = mean(Δ | redrawn) − mean(Δ | not redrawn)",
				meaning:
					"A positive difference is the Democratic share rising more in redrawn states. The Republican change is the same number with its sign reversed.",
			},
		],
	},
};

function methodology(m: Method): HTMLElement {
	return data(
		div(
			{},
			h3({}, "Methodology"),
			p({}, m.question),
			...m.methodology.map((s) => p({}, s)),
		),
		{ part: "methodology" },
	);
}

function formulas(m: Method): HTMLElement {
	return data(
		div(
			{},
			h3({}, "Formulas"),
			dl(
				{ class: "ef-formulas" },
				...m.formulas.flatMap((f) => [
					dt({}, f.name),
					dd({}, pre({}, code({}, f.formula)), p({}, f.meaning)),
				]),
			),
		),
		{ part: "formulas" },
	);
}

// The inverse of src/lib/markdown.ts unescapeHtml, so a listing round trips
// through highlightFences byte for byte.
const ESCAPES: Record<string, string> = {
	"&": "&amp;",
	"<": "&lt;",
	">": "&gt;",
	'"': "&quot;",
	"'": "&#39;",
};

function escapeHtml(text: string): string {
	return text.replace(/[&<>"']/g, (c) => ESCAPES[c] ?? c);
}

/**
 * A listing highlighted at build time the way the site's Markdown fences are:
 * highlightFences emits `pre > code.hljs.language-LANG` with hljs spans, and
 * src/highlight.css colors them. An unregistered language stays plain escaped
 * text. The code element's textContent equals `text` exactly.
 */
function listing(text: string, language: string): HTMLElement {
	const html = highlightFences(
		`<pre><code class="language-${language}">${escapeHtml(text)}</code></pre>`,
	);
	const holder = Object.assign(div(), { innerHTML: html });
	return holder.firstElementChild as HTMLElement;
}

function lineCount(text: string): number {
	return text.split("\n").length - (text.endsWith("\n") ? 1 : 0);
}

function sqlPart(entries: Code[]): HTMLElement {
	return data(
		div(
			{},
			h3({}, "SQL and code"),
			p(
				{},
				"Each block below is the exact text findings.py read from the repository, with the sha256 of that text. The analyze.py functions are the Python that loads the database, writes the answer files, and fits the regression.",
			),
			...entries.map((e) =>
				details(
					{ class: "ef-listing" },
					summary(
						{},
						span(
							{},
							code({}, e.file),
							`, ${e.kind === "sql" ? "SQL" : "Python"}, ${String(lineCount(e.text))} lines`,
						),
					),
					p({}, code({ class: "ef-sha" }, `sha256 ${e.sha256}`)),
					data(listing(e.text, e.kind), { "sql-file": e.file }),
				),
			),
		),
		{ part: "sql" },
	);
}

function rawPart(tables: RawTable[]): HTMLElement {
	return data(
		div(
			{},
			h3({}, "Raw results"),
			p(
				{},
				"Values are rounded for display: points to two decimals, k, a, b, and flip_share to three, vote counts to whole numbers, and p values to three significant figures. Identifiers and text are verbatim, and an empty cell is a null. The full precision file is in out/answers, listed with its sha256 in the audit panel.",
			),
			...tables.map((t) =>
				details(
					{ class: "ef-listing" },
					summary(
						{},
						span(
							{},
							code({}, t.source_file),
							`, ${String(t.rows.length)} of ${String(t.total_rows)} rows`,
						),
					),
					p(
						{},
						`${t.filter} This table shows ${String(t.rows.length)} of ${String(t.total_rows)} rows${t.truncated ? ", so the remaining rows are only in the file" : ""}. Values are rounded for display, and the full precision file is `,
						code({}, t.source_file),
						".",
					),
					div(
						{ class: "ef-scroll ef-raw" },
						table(
							{},
							thead(
								{},
								tr(
									{},
									...t.columns.map((c, i) =>
										th(
											{ scope: "col", class: numeric(t, i) ? "ef-num" : "" },
											t.column_units?.[i] ? `${c} (${t.column_units[i]})` : c,
										),
									),
								),
							),
							tbody(
								{},
								...t.rows.map((r) =>
									tr(
										{},
										...r.map((cell, i) =>
											td({ class: numeric(t, i) ? "ef-num" : "" }, cell),
										),
									),
								),
							),
						),
					),
				),
			),
		),
		{ part: "raw-results" },
	);
}

function summaryPart(...children: Node[]): HTMLElement {
	return data(div({}, h3({}, "Finding"), ...children), { part: "summary" });
}

function numeric(t: RawTable, i: number): boolean {
	return t.column_kinds?.[i] === "number";
}

/** The marker for a value that is not available in a number table. */
const NULL_MARK = "–";

/** One column of a number table: its header, unit, and how a row finds its claim and field. */
interface NumberColumn {
	label: string;
	unit?: string;
	key: (row: string) => string | null;
	field?: string;
}

function capitalized(text: string): string {
	return text.replace(/^./, (c) => c.toUpperCase());
}

/**
 * A quick read table of the numbers behind the findings: one row per office or
 * group, numbers at one precision per column from `claim.cells`, units in the
 * headers, and the selected label in a Finding column. The sentences sit below.
 */
function numberTable(
	f: Findings,
	rowHeader: string,
	rows: [string, string][],
	columns: NumberColumn[],
): HTMLElement {
	const cellOf = (col: NumberColumn, row: string): HTMLElement => {
		const key = col.key(row);
		if (key === null) return td({ class: "ef-num" }, NULL_MARK);
		const claim = f.claims[key];
		if (col.field === undefined) return td({}, code({}, claim.value));
		const value = claim.cells?.[col.field] ?? null;
		return td({ class: "ef-num" }, value ?? NULL_MARK);
	};
	return div(
		{ class: "ef-scroll ef-numbers" },
		table(
			{},
			thead(
				{},
				tr(
					{},
					th({ scope: "col" }, rowHeader),
					...columns.map((c) =>
						th(
							{ scope: "col", class: c.field === undefined ? "" : "ef-num" },
							c.unit ? `${c.label} (${c.unit})` : c.label,
						),
					),
				),
			),
			tbody(
				{},
				...rows.map(([row, label]) =>
					tr(
						{},
						th({ scope: "row" }, label),
						...columns.map((c) => cellOf(c, row)),
					),
				),
			),
		),
	);
}

function legend(): HTMLElement {
	return p(
		{ class: "ef-legend" },
		`A dash (${NULL_MARK}) marks a value that is not available. A Finding column names the selected label, and the paragraphs below the table state each finding in full.`,
	);
}

const OFFICE_ROWS: [string, string][] = OFFICES.map((o) => [
	o,
	capitalized(OFFICE_RACES[o]),
]);

function seatChangeSummary(f: Findings): Node[] {
	const shift = (o: string) => `seat_shift.${o}`;
	const flips = (o: string) => `party_flips.${o}`;
	return [
		numberTable(f, "Office", OFFICE_ROWS, [
			{ label: "Shift finding", key: shift },
			{ label: "Comparable races", key: shift, field: "n" },
			{
				label: "Median margin change",
				unit: "points",
				key: shift,
				field: "median_margin_change",
			},
			{
				label: "Races moving toward Democrats",
				unit: "percent",
				key: shift,
				field: "share_toward_dem",
			},
			{ label: "Flips finding", key: flips },
			{ label: "Races compared", key: flips, field: "n" },
			{ label: "Democratic gains", key: flips, field: "dem_gains" },
			{ label: "Republican gains", key: flips, field: "rep_gains" },
		]),
		legend(),
		...byOffice(f, ["seat_shift", "party_flips"]),
		h4({}, "By presidential lean"),
		p(
			{},
			"Each table splits one office's races by the presidential lean of their state, red, blue, or swing, and repeats the overall row for comparison. The overall findings do not count the races they leave out, so that cell is marked as not available.",
		),
		...OFFICES.flatMap((office) => leanTable(f, office)),
	];
}

function leanTable(f: Findings, office: Office): Node[] {
	const shift = (row: string) =>
		row === "all"
			? `seat_shift.${office}`
			: `seat_shift_by_lean.${office}.${row}`;
	const flips = (row: string) =>
		row === "all"
			? `party_flips.${office}`
			: `party_flips_by_lean.${office}.${row}`;
	const rows: [string, string][] = [
		...LEAN_DEFS.presidential.map((lean): [string, string] => [
			lean,
			capitalized(lean),
		]),
		["all", "All states"],
	];
	return [
		h5({}, capitalized(OFFICE_RACES[office])),
		numberTable(f, "Presidential lean", rows, [
			{ label: "Shift finding", key: shift },
			{ label: "Comparable races", key: shift, field: "n" },
			{ label: "Left out as not comparable", key: shift, field: "excluded" },
			{
				label: "Median margin change",
				unit: "points",
				key: shift,
				field: "median_margin_change",
			},
			{
				label: "Races moving toward Democrats",
				unit: "percent",
				key: shift,
				field: "share_toward_dem",
			},
			{ label: "Flips finding", key: flips },
			{ label: "Democratic gains", key: flips, field: "dem_gains" },
			{ label: "Republican gains", key: flips, field: "rep_gains" },
		]),
		legend(),
		...LEAN_DEFS.presidential.flatMap((lean) => [
			renderSelector(f, `seat_shift_by_lean.${office}.${lean}`),
			renderSelector(f, `party_flips_by_lean.${office}.${lean}`),
		]),
	];
}

function turnoutSummary(f: Findings): Node[] {
	const check = (o: string) => `turnout_explanation.${o}`;
	const k = (o: string) => `k_direction.${o}`;
	return [
		numberTable(f, "Office", OFFICE_ROWS, [
			{ label: "Turnout check finding", key: check },
			{ label: "Races checked", key: check, field: "n" },
			{
				label: "Races where turnout alone fits",
				key: check,
				field: "plausible",
			},
			{
				label: "Share where turnout alone fits",
				unit: "percent",
				key: check,
				field: "share_plausible",
			},
			{ label: "k finding", key: k },
			{ label: "Races with k", key: k, field: "n" },
			{ label: "Median k", unit: "ratio", key: k, field: "median_k" },
		]),
		legend(),
		...byOffice(f, ["turnout_explanation", "k_direction"]),
	];
}

function dummymanderSummary(f: Findings): Node[] {
	// The Historical row reads the pooled 2014 to 2024 figures from the test claims, and has no finding of its own.
	const rowKey = (house: string, hist: string) => (row: string) =>
		row === "hist" ? hist : house;
	const only2026 = (key: string) => (row: string) =>
		row === "hist" ? null : key;
	const rows: [string, string][] = [
		["house", "2026, House"],
		["hist", "Historical, 2014 to 2024"],
	];
	const incumbent = "dummymander_test.incumbent";
	const partyTest = "dummymander_test.party";
	const now = rowKey("dummymander.house", incumbent);
	const past = only2026("dummymander_vs_history.house");
	const party = rowKey("dummymander_party.house", partyTest);
	const testKey = (basis: string) => `dummymander_test.${basis}`;
	return [
		numberTable(f, "Year", rows, [
			{ label: "Finding", key: only2026("dummymander.house") },
			{ label: "Redrawn races", key: now, field: "redrawn_races" },
			{ label: "Other races", key: now, field: "not_redrawn_races" },
			{
				label: "Redrawn mean change",
				unit: "points",
				key: now,
				field: "redrawn_mean",
			},
			{
				label: "Other mean change",
				unit: "points",
				key: now,
				field: "not_redrawn_mean",
			},
			{ label: "Difference", unit: "points", key: now, field: "difference" },
			{ label: "History finding", key: past },
			{
				label: "Largest earlier difference",
				unit: "points",
				key: past,
				field: "prior_max_abs",
			},
			{ label: "Year of largest", key: past, field: "prior_max_year" },
		]),
		legend(),
		p(
			{ class: "ef-legend" },
			"The Historical row pools the years from 2014 to 2024 with a mid cycle map. Its means are plain race weighted means, and its difference is adjusted for each year's national tide, so the means do not subtract to it exactly.",
		),
		renderSelector(f, "dummymander.house"),
		renderSelector(f, "dummymander_vs_history.house"),
		h4({}, "By party, all races"),
		numberTable(f, "Year", rows, [
			{ label: "Finding", key: only2026("dummymander_party.house") },
			{ label: "Redrawn races", key: party, field: "redrawn_races" },
			{ label: "Other races", key: party, field: "not_redrawn_races" },
			{
				label: "Redrawn mean Democratic change",
				unit: "points",
				key: party,
				field: "redrawn_mean",
			},
			{
				label: "Other mean Democratic change",
				unit: "points",
				key: party,
				field: "not_redrawn_mean",
			},
			{
				label: "Difference",
				unit: "points",
				key: party,
				field: "difference",
			},
		]),
		renderSelector(f, "dummymander_party.house"),
		h4({}, "Is the gap more than a wash?"),
		numberTable(
			f,
			"Basis",
			[
				["incumbent", "Incumbents"],
				["party", "All races, by party"],
			],
			[
				{ label: "Finding", key: testKey },
				{
					label: "2026 gap",
					unit: "points",
					key: testKey,
					field: "difference_2026",
				},
				{
					label: "Historical gap",
					unit: "points",
					key: testKey,
					field: "difference",
				},
				{
					label: "p, 2026 gap is zero",
					key: testKey,
					field: "p_2026",
				},
				{
					label: "p, historical gap is zero",
					key: testKey,
					field: "p_hist",
				},
				{
					label: "p, 2026 differs from history",
					key: testKey,
					field: "p_excess",
				},
			],
		),
		renderSelector(f, "dummymander_test.incumbent"),
		renderSelector(f, "dummymander_test.party"),
	];
}

function byOffice(f: Findings, families: string[]): Node[] {
	return OFFICES.flatMap((office) => [
		h4({}, capitalized(OFFICE_RACES[office])),
		...families.map((family) => renderSelector(f, `${family}.${office}`)),
	]);
}

function incumbencySummary(f: Findings): Node[] {
	return (Object.keys(LEAN_DEFS) as LeanDef[]).flatMap((def) => {
		const rows: [string, string][] = OFFICES.flatMap((office) =>
			LEAN_DEFS[def].map((lean): [string, string] => [
				`${def}.${office}.${lean}`,
				`${capitalized(OFFICE_RACES[office])}, ${lean}`,
			]),
		);
		const gap = (g: string) => `incumbency_party_gap.${g}`;
		const sig = (g: string) => `significance.${g}`;
		const hist = (party: Party) => (g: string) =>
			`bonus_vs_history.${g}.${party}`;
		return [
			h4({}, LEAN_DEF_TITLE[def]),
			h5({}, "Party gap in 2026"),
			numberTable(f, "Office and lean", rows, [
				{ label: "Gap finding", key: gap },
				{ label: "Democratic incumbents", key: gap, field: "dem_seats" },
				{ label: "Republican incumbents", key: gap, field: "rep_seats" },
				{
					label: "Democratic bonus",
					unit: "points",
					key: gap,
					field: "dem_bonus",
				},
				{
					label: "Republican bonus",
					unit: "points",
					key: gap,
					field: "rep_bonus",
				},
				{
					label: "Democratic minus Republican",
					unit: "points",
					key: gap,
					field: "wald_diff",
				},
				{ label: "Wald test", unit: "p", key: gap, field: "wald_p" },
				{ label: "Test tier", key: sig },
			]),
			h5({}, "2026 bonus against 2014 to 2024"),
			numberTable(f, "Office and lean", rows, [
				{ label: "Democratic finding", key: hist("DEM") },
				{
					label: "Democratic 2026",
					unit: "points",
					key: hist("DEM"),
					field: "bonus_2026",
				},
				{
					label: "Democratic earlier low",
					unit: "points",
					key: hist("DEM"),
					field: "prior_min",
				},
				{
					label: "Democratic earlier high",
					unit: "points",
					key: hist("DEM"),
					field: "prior_max",
				},
				{
					label: "Democratic earlier years",
					key: hist("DEM"),
					field: "prior_years",
				},
				{ label: "Republican finding", key: hist("REP") },
				{
					label: "Republican 2026",
					unit: "points",
					key: hist("REP"),
					field: "bonus_2026",
				},
				{
					label: "Republican earlier low",
					unit: "points",
					key: hist("REP"),
					field: "prior_min",
				},
				{
					label: "Republican earlier high",
					unit: "points",
					key: hist("REP"),
					field: "prior_max",
				},
				{
					label: "Republican earlier years",
					key: hist("REP"),
					field: "prior_years",
				},
			]),
			legend(),
			...rows.flatMap(([g, label]) => [
				h5({}, label),
				renderSelector(f, gap(g)),
				renderSelector(f, sig(g)),
				renderSelector(f, hist("DEM")(g)),
				renderSelector(f, hist("REP")(g)),
			]),
		];
	});
}

function summaryOf(f: Findings, q: Question): Node[] {
	switch (q) {
		case "seat_change":
			return seatChangeSummary(f);
		case "incumbency":
			return incumbencySummary(f);
		case "turnout":
			return turnoutSummary(f);
		case "dummymander":
			return dummymanderSummary(f);
	}
}

function questionSection(f: Findings, q: Question): HTMLElement {
	const m = METHODS[q];
	const evidence = f.questions[q];
	return data(
		section(
			{},
			h2({}, m.title),
			methodology(m),
			formulas(m),
			sqlPart(evidence.sql),
			rawPart(evidence.raw_results),
			summaryPart(...summaryOf(f, q)),
		),
		{ question: q },
	);
}

function auditPanel(f: Findings, bytes: Buffer, text: string): HTMLElement {
	const href = `data:application/json;base64,${bytes.toString("base64")}`;
	return data(
		section(
			{},
			h2({}, "Audit"),
			p(
				{},
				"Everything on this page comes from the findings file below. Each claim in it holds the rule branch that fired, the raw numbers, the display strings quoted above, and the race keys or answer rows behind it, so a reader can check any label by hand.",
			),
			p(
				{},
				a(
					{ href, download: "findings.json" },
					"Download findings.json, byte for byte as read",
				),
			),
			h3({}, "Tools"),
			ul(
				{},
				...Object.entries(f.run.tools).map(([k, v]) =>
					li({}, `${k}: ${show(v)}`),
				),
			),
			h3({}, "Thresholds"),
			ul(
				{},
				...Object.entries(f.thresholds).map(([k, v]) =>
					li({}, code({}, k), `: ${show(v)}`),
				),
			),
			h3({}, "Rules, in evaluation order"),
			...Object.entries(f.rules).flatMap(([family, sentences]) => [
				h4({}, family),
				ol({}, ...sentences.map((s) => li({}, s))),
			]),
			h3({}, "Inputs"),
			div(
				{ class: "ef-scroll" },
				table(
					{},
					thead(
						{},
						tr(
							{},
							th({ scope: "col" }, "Path"),
							th({ scope: "col" }, "sha256"),
							th({ scope: "col" }, "Bytes"),
							th({ scope: "col" }, "Rows"),
						),
					),
					tbody(
						{},
						...f.run.inputs.map((i) =>
							tr(
								{},
								td({}, code({}, i.path)),
								td({}, code({ class: "ef-sha" }, i.sha256)),
								td({}, show(i.bytes)),
								td({}, show(i.rows)),
							),
						),
					),
				),
			),
			details(
				{},
				summary(
					{},
					"Claims: the rule that fired and the evidence count for each selector",
				),
				div(
					{ class: "ef-scroll" },
					table(
						{},
						thead(
							{},
							tr(
								{},
								th({ scope: "col" }, "Selector"),
								th({ scope: "col" }, "Value"),
								th({ scope: "col" }, "Rule"),
								th({ scope: "col" }, "Evidence items"),
							),
						),
						tbody(
							{},
							...Object.entries(f.claims).map(([key, c]) =>
								tr(
									{},
									td({}, code({}, key)),
									td({}, code({}, c.value)),
									td({}, c.rule),
									td({}, show(c.evidence.length)),
								),
							),
						),
					),
				),
			),
			details(
				{},
				summary({}, "findings.json, verbatim"),
				listing(text, "json"),
			),
		),
		{ role: "audit" },
	);
}

function findingsState(f: Findings, bytes: Buffer, text: string): HTMLElement {
	return shell(
		"findings",
		pageHeader(),
		caveat(),
		...QUESTIONS.map((q) => questionSection(f, q)),
		sourcesOverview(f),
		auditPanel(f, bytes, text),
	);
}

/** Reads and renders the findings file the environment names. Called at build time only. */
export function renderReport(
	env: NodeJS.ProcessEnv = process.env,
): HTMLElement {
	const path = findingsPath(env);
	if (!existsSync(path)) return noFindingsState(path);
	const bytes = readFileSync(path);
	const text = bytes.toString("utf-8");
	const parsed = parseFindings(text);
	if ("problem" in parsed) return invalidFindingsState(path, parsed.problem);
	return findingsState(parsed, bytes, text);
}

export default {
	head: () => [
		...pageHead("2026 Election Findings | David Souther"),
		meta({ name: "robots", content: "noindex" }),
		style({}, CSS),
	],
	default: async () => renderReport(),
} satisfies PageModule;
