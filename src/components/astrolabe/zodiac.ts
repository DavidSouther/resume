// The zodiac band <g> at the outer radius (CONSUMES Contracts 1 & 3).
//
// A <g data-zodiac-band> of twelve <g data-sign="<id>"> wedges, each holding a
// <use> of its glyph symbol and lit with data-occupied per occupantsBySign. It
// renders INSIDE the existing single <svg> (dial.ts), adding no second <svg> and
// no [data-body] group (the F2 thesis invariant). The occupancy highlight tints
// the lit sign by a representative occupant's color via bodyColorVar (Contract 3;
// the design defers multi-occupant color blending). refreshOccupancy lets the
// motion engine re-light the band from a fresh positions set without rebuild.
import { g, use } from "@davidsouther/jiffies/dom/svg.ts";
import type { BodyName, BodyPosition } from "../../lib/astro-math.ts";
import { R_OUTER } from "../../lib/astro-math.ts";
import { bodyColorVar } from "../../lib/astro-tokens.ts";
import {
	occupantsBySign,
	ZODIAC_SIGNS,
	type ZodiacSignId,
} from "../../lib/astro-zodiac.ts";
import { zodiacSymbolId } from "./zodiac-glyphs.ts";

/** Half a sign's 30° arc — the offset from a sign's start to its arc center. */
const HALF_ARC = Math.PI / 12;

/** The glyph's on-dial size (SVG user units): the <use> box, centered on the arc. */
const GLYPH_SIZE = 56;

/**
 * Set or clear data-occupied on a sign group, tinting it by a representative
 * occupant's color when lit. Centralized so ZodiacBand and refreshOccupancy share
 * one lit-state rule (and the off-state fully clears the tint).
 */
function applyOccupancy(group: Element, occupants: readonly BodyName[]): void {
	if (occupants.length > 0) {
		group.setAttribute("data-occupied", "");
		// Representative-occupant color (multi-occupant blend deferred per design).
		group.setAttribute("style", `color: var(${bodyColorVar(occupants[0])})`);
	} else {
		group.removeAttribute("data-occupied");
		group.removeAttribute("style");
	}
}

/** A single sign wedge: <g data-sign> at its arc center holding a glyph <use>. */
function signWedge(id: ZodiacSignId, startAngle: number): Element {
	const mid = startAngle + HALF_ARC;
	// +x = 0 rad (3 o'clock), +y down, increasing clockwise — astro-math's system.
	const x = R_OUTER * Math.cos(mid);
	const y = R_OUTER * Math.sin(mid);

	const glyph = use({});
	// `href`, `x`, `y`, width/height are not jiffies IDL attrs — set after
	// construction (the dial.ts idiom). The glyph box is centered on (x, y).
	glyph.setAttribute("href", `#${zodiacSymbolId(id)}`);
	glyph.setAttribute("x", String(x - GLYPH_SIZE / 2));
	glyph.setAttribute("y", String(y - GLYPH_SIZE / 2));
	glyph.setAttribute("width", String(GLYPH_SIZE));
	glyph.setAttribute("height", String(GLYPH_SIZE));

	const group = g({}, glyph);
	group.setAttribute("data-sign", id);
	return group;
}

/**
 * The <g data-zodiac-band> of twelve <g data-sign="<id>"> wedges, each holding a
 * <use> of its glyph symbol, lit with data-occupied per occupantsBySign(positions).
 * Renders INSIDE the existing single <svg> (dial.ts), so it adds no second <svg>
 * and no [data-body] group.
 */
export function ZodiacBand(positions: BodyPosition[]): Element {
	const occupants = occupantsBySign(positions);
	const wedges = ZODIAC_SIGNS.map((sign) => {
		const wedge = signWedge(sign.id, sign.startAngle);
		applyOccupancy(wedge, occupants.get(sign.id) ?? []);
		return wedge;
	});
	const band = g({}, ...wedges);
	band.setAttribute("data-zodiac-band", "");
	return band;
}

/** Re-apply data-occupied to each [data-sign] from current positions (no rebuild). */
export function refreshOccupancy(
	band: Element,
	positions: BodyPosition[],
): void {
	const occupants = occupantsBySign(positions);
	for (const sign of ZODIAC_SIGNS) {
		const group = band.querySelector(`[data-sign="${sign.id}"]`);
		if (group) {
			applyOccupancy(group, occupants.get(sign.id) ?? []);
		}
	}
}
