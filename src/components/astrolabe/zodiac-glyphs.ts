// Inlined Tabler "Zodiac" stroke-path glyphs (the trip/icons.ts raw-path idiom).
//
// Each sign maps to the inner <path> markup of its Tabler glyph; zodiacSymbolDefs
// emits one <symbol id="zodiac-<id>" viewBox="0 0 24 24"> per sign (glyph via
// el.innerHTML), ready to <use href="#zodiac-<id>"> from the band wedges. The
// defs live INSIDE the single existing <svg> in dial.ts — no second <svg>.
//
// The path data is the unmodified outline ("zodiac-<sign>") set from Tabler Icons
// (MIT). Authored on a 24×24 viewBox with currentColor strokes, so a wedge's
// <use> inherits its tint from the [data-sign] group's stroke.
import { defs, symbol } from "@davidsouther/jiffies/dom/svg.ts";
import { ZODIAC_SIGNS, type ZodiacSignId } from "../../lib/astro-zodiac.ts";

/** Raw stroke-path markup for each sign's Tabler "Zodiac" glyph (inner <path> content). */
export const ZODIAC_GLYPH: Record<ZodiacSignId, string> = {
	aries:
		'<path d="M12 5a5 5 0 1 0 -4 8"/><path d="M16 13a5 5 0 1 0 -4 -8"/><path d="M12 21l0 -16"/>',
	taurus:
		'<path d="M6 3a6 6 0 0 0 12 0"/><path d="M6 15a6 6 0 1 0 12 0a6 6 0 1 0 -12 0"/>',
	gemini:
		'<path d="M3 3a21 21 0 0 0 18 0"/><path d="M3 21a21 21 0 0 1 18 0"/><path d="M7 4.5l0 15"/><path d="M17 4.5l0 15"/>',
	cancer:
		'<path d="M3 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M15 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M3 12a10 6.5 0 0 1 14 -6.5"/><path d="M21 12a10 6.5 0 0 1 -14 6.5"/>',
	leo: '<path d="M13 17a4 4 0 1 0 8 0"/><path d="M3 16a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/><path d="M7 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0"/><path d="M7 7c0 3 2 5 2 9"/><path d="M15 7c0 4 -2 6 -2 10"/>',
	virgo:
		'<path d="M3 4a2 2 0 0 1 2 2v9"/><path d="M5 6a2 2 0 0 1 4 0v9"/><path d="M9 6a2 2 0 0 1 4 0v10a7 5 0 0 0 7 5"/><path d="M12 21a7 5 0 0 0 7 -5v-2a3 3 0 0 0 -6 0"/>',
	libra: '<path d="M5 20l14 0"/><path d="M5 17h5v-.3a7 7 0 1 1 4 0v.3h5"/>',
	scorpio:
		'<path d="M3 4a2 2 0 0 1 2 2v9"/><path d="M5 6a2 2 0 0 1 4 0v9"/><path d="M9 6a2 2 0 0 1 4 0v10a3 3 0 0 0 3 3h5l-3 -3m0 6l3 -3"/>',
	sagittarius:
		'<path d="M4 20l16 -16"/><path d="M13 4h7v7"/><path d="M6.5 12.5l5 5"/>',
	capricorn:
		'<path d="M4 4a3 3 0 0 1 3 3v9"/><path d="M7 7a3 3 0 0 1 6 0v11a3 3 0 0 1 -3 3"/><path d="M13 17a3 3 0 1 0 6 0a3 3 0 1 0 -6 0"/>',
	aquarius:
		'<path d="M3 10l3 -3l3 3l3 -3l3 3l3 -3l3 3"/><path d="M3 17l3 -3l3 3l3 -3l3 3l3 -3l3 3"/>',
	pisces:
		'<path d="M5 3a21 21 0 0 1 0 18"/><path d="M19 3a21 21 0 0 0 0 18"/><path d="M5 12l14 0"/>',
};

/** The symbol id a sign's glyph is published under (the <use href> target). */
export function zodiacSymbolId(id: ZodiacSignId): string {
	return `zodiac-${id}`;
}

/** The <defs> block of one <symbol id="zodiac-<id>"> per sign, ready to <use>. */
export function zodiacSymbolDefs(): Element {
	const symbols = ZODIAC_SIGNS.map((sign) => {
		// jiffies SVG factories type attrs by the element's IDL properties, and
		// `viewBox` is not one — set it after construction (the dial.ts idiom). The
		// glyph paths are injected as raw markup (the icons.ts el.innerHTML idiom).
		const sym = symbol({});
		sym.setAttribute("id", zodiacSymbolId(sign.id));
		sym.setAttribute("viewBox", "0 0 24 24");
		sym.innerHTML = ZODIAC_GLYPH[sign.id];
		return sym;
	});
	const block = defs({}, ...symbols);
	block.setAttribute("data-zodiac-defs", "");
	return block;
}
