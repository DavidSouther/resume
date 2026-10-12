// Pop-up cards for the NYC polling map, built from the numeric properties of a
// GeoJSON feature. No HTML crosses from the data to the page.

import { b, div } from "@davidsouther/jiffies/dom/html.ts";

export interface CardProps {
	name: string;
	kind: "piece" | "tract" | "site";
	geoid?: string;
	siteName?: string;
	site?: string;
	miles?: number;
	population?: number;
	povertyPct?: number;
	povertyMoe?: number;
	incomeUsd?: number;
	incomeMoe?: number;
	lowPopulation?: boolean;
	/** [lon, lat] of the shape's centroid, where its popup opens. */
	centroid?: [number, number];
}

export type Row = readonly [label: string, value: string];

const NOT_AVAILABLE = "not available";

function count(n: number | undefined): string {
	return n === undefined ? NOT_AVAILABLE : n.toLocaleString("en-US");
}

function withMargin(value: string, moe: number | undefined, unit = ""): string {
	return moe === undefined
		? value
		: `${value} (±${unit}${moe.toLocaleString("en-US")})`;
}

function pct(p: CardProps): string {
	if (p.povertyPct === undefined) return NOT_AVAILABLE;
	return withMargin(`${p.povertyPct.toFixed(1)}%`, p.povertyMoe);
}

function income(p: CardProps): string {
	if (p.incomeUsd === undefined) return NOT_AVAILABLE;
	return withMargin(
		`$${p.incomeUsd.toLocaleString("en-US")}`,
		p.incomeMoe,
		"$",
	);
}

/** Population always shows. A tract with no residents drops the rest. */
function facts(p: CardProps): Row[] {
	const rows: Row[] = [["Population", count(p.population)]];
	if (p.population !== 0) {
		rows.push(["Poverty rate", pct(p)], ["Median income", income(p)]);
	}
	return rows;
}

export function cardRows(p: CardProps): Row[] {
	switch (p.kind) {
		case "site":
			return [
				...(p.siteName ? ([["Site", p.siteName]] as Row[]) : []),
				["Tract", p.geoid ?? "not found (outside tract boundaries)"],
				...(p.geoid ? facts(p) : []),
			];
		case "piece":
			return [
				["Assigned site", p.site ?? NOT_AVAILABLE],
				[
					"Distance",
					p.miles === undefined ? NOT_AVAILABLE : `${p.miles.toFixed(2)} miles`,
				],
				...facts(p),
				...(p.lowPopulation
					? ([["Note", "low population tract, not in the analysis"]] as Row[])
					: []),
			];
		case "tract":
			return [["GEOID", p.geoid ?? NOT_AVAILABLE], ...facts(p)];
	}
}

export function card(p: CardProps): HTMLElement {
	return div(
		{ class: "card" },
		div({ class: "card-title" }, b({}, p.name)),
		...cardRows(p).map(([label, value]) => div({}, b({}, `${label}: `), value)),
	);
}
