import { assertExists } from "@davidsouther/jiffies/assert.ts";
import { g, linearGradient, path } from "@davidsouther/jiffies/dom/svg.ts";
import { GLYPHS } from "../../lib/astrolabe/bodies.ts";
import { pt } from "../../lib/astrolabe/math.ts";

const ZIN = 422;
const ZOUT = 468;
const ZHIT_IN = 410;
const ZHIT_OUT = 472;

export interface ZodiacRefs {
	wedges: Element[];
	arcs: Element[];
	glyphs: Element[];
	hits: Element[];
	grads: Element[];
	divs: SVGPathElement[];
}

export function buildZodiac(grp: SVGGElement): ZodiacRefs {
	const svg = grp.closest("svg");
	const defs = assertExists(svg?.querySelector("defs"), "#dial defs missing");

	const wedges: Element[] = [];
	const arcs: Element[] = [];
	const glyphs: Element[] = [];
	const hits: Element[] = [];
	const grads: Element[] = [];
	const divs: SVGPathElement[] = [];

	// Shaded wedges and their inner-edge highlight arcs both live in static SVG
	// space (like the dividers) so each frame their edges can be recomputed to
	// follow the earth-centred guilloche curve. A rigidly-rotated arc could not
	// stay aligned with the curved wedge edge.
	const zwedges = g({ id: "zwedges" });
	grp.appendChild(zwedges);

	const zarcs = g({ id: "zarcs" });
	grp.appendChild(zarcs);

	for (let i = 0; i < 12; i++) {
		const c0 = i * 30;
		const c1 = c0 + 30;
		const oA = pt(c0, ZOUT);
		const oB = pt(c1, ZOUT);
		const iB = pt(c1, ZIN);
		const iA = pt(c0, ZIN);

		const grad = linearGradient({
			id: `zgrad${i}`,
			gradientUnits: "userSpaceOnUse",
			x1: iA.x,
			y1: iA.y,
			x2: iB.x,
			y2: iB.y,
		});
		defs.appendChild(grad);
		grads.push(grad);

		// Initial straight-edged wedge; animation.ts recomputes the curved `d`.
		const wd =
			`M${oA.x} ${oA.y} A${ZOUT} ${ZOUT} 0 0 1 ${oB.x} ${oB.y}` +
			` L${iB.x} ${iB.y} A${ZIN} ${ZIN} 0 0 0 ${iA.x} ${iA.y} Z`;
		const w = path({ class: "zwedge", d: wd, fill: `url(#zgrad${i})` });
		zwedges.appendChild(w);
		wedges.push(w);

		const ad = `M${iA.x} ${iA.y} A${ZIN} ${ZIN} 0 0 1 ${iB.x} ${iB.y}`;
		const a = path({ class: "zarc", d: ad, stroke: `url(#zgrad${i})` });
		zarcs.appendChild(a);
		arcs.push(a);
	}

	// Dividers are recomputed each frame in static SVG space (following the
	// guilloche curve). They start as radial lines and are updated by
	// startAnimation once Earth has moved.
	const zdivGrp = g({ id: "zdivs" });
	for (let j = 0; j < 12; j++) {
		const inP = pt(j * 30, ZIN);
		const ouP = pt(j * 30, ZOUT);
		const dp = path({
			class: "zdiv",
			d: `M${inP.x} ${inP.y} L${ouP.x} ${ouP.y}`,
		});
		zdivGrp.appendChild(dp);
		divs.push(dp as SVGPathElement);
	}
	grp.appendChild(zdivGrp);

	for (let k = 0; k < 12; k++) {
		const gg = g({ class: "zglyph" });
		for (const d of GLYPHS[k]) gg.appendChild(path({ d }));
		grp.appendChild(gg);
		glyphs.push(gg);
	}

	// hit targets for sign card hover — grouped so they rotate with the wheel
	const zhits = g({ id: "zhits" });
	for (let i = 0; i < 12; i++) {
		const c0 = i * 30;
		const c1 = c0 + 30;
		const oA = pt(c0, ZHIT_OUT);
		const oB = pt(c1, ZHIT_OUT);
		const iB = pt(c1, ZHIT_IN);
		const iA = pt(c0, ZHIT_IN);
		const d =
			`M${oA.x} ${oA.y} A${ZHIT_OUT} ${ZHIT_OUT} 0 0 1 ${oB.x} ${oB.y}` +
			` L${iB.x} ${iB.y} A${ZHIT_IN} ${ZHIT_IN} 0 0 0 ${iA.x} ${iA.y} Z`;
		const h = path({ class: "zhit", d });
		zhits.appendChild(h);
		hits.push(h);
	}
	svg?.appendChild(zhits);

	return { wedges, arcs, glyphs, hits, grads, divs };
}
