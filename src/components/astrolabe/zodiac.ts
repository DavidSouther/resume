import { GLYPHS } from "../../lib/astrolabe/bodies.ts";
import { pt } from "../../lib/astrolabe/math.ts";

const SVGNS = "http://www.w3.org/2000/svg";
const ZIN = 422;
const ZOUT = 468;
const ZHIT_IN = 410;
const ZHIT_OUT = 472;

function svgEl<K extends keyof SVGElementTagNameMap>(
	tag: K,
	attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
	const e = document.createElementNS(SVGNS, tag);
	for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
	return e;
}

export interface ZodiacRefs {
	wedges: SVGElement[];
	arcs: SVGElement[];
	glyphs: SVGElement[];
	hits: SVGElement[];
	grads: SVGLinearGradientElement[];
}

export function buildZodiac(g: SVGGElement): ZodiacRefs {
	const svg = g.closest("svg");
	let defs = svg?.querySelector("defs");
	if (!defs) {
		defs = svgEl("defs", {});
		svg?.prepend(defs);
	}

	const wedges: SVGElement[] = [];
	const arcs: SVGElement[] = [];
	const glyphs: SVGElement[] = [];
	const hits: SVGElement[] = [];
	const grads: SVGLinearGradientElement[] = [];

	const zwheel = svgEl("g", { id: "zwheel" });
	g.appendChild(zwheel);

	for (let i = 0; i < 12; i++) {
		const c0 = i * 30;
		const c1 = c0 + 30;
		const oA = pt(c0, ZOUT);
		const oB = pt(c1, ZOUT);
		const iB = pt(c1, ZIN);
		const iA = pt(c0, ZIN);

		const grad = svgEl("linearGradient", {
			id: `zgrad${i}`,
			gradientUnits: "userSpaceOnUse",
			x1: iA.x,
			y1: iA.y,
			x2: iB.x,
			y2: iB.y,
		});
		defs.appendChild(grad);
		grads.push(grad);

		const wd =
			`M${oA.x} ${oA.y} A${ZOUT} ${ZOUT} 0 0 1 ${oB.x} ${oB.y}` +
			` L${iB.x} ${iB.y} A${ZIN} ${ZIN} 0 0 0 ${iA.x} ${iA.y} Z`;
		const w = svgEl("path", {
			class: "zwedge",
			d: wd,
			fill: `url(#zgrad${i})`,
		});
		zwheel.appendChild(w);
		wedges.push(w);

		const ad = `M${iA.x} ${iA.y} A${ZIN} ${ZIN} 0 0 1 ${iB.x} ${iB.y}`;
		const a = svgEl("path", {
			class: "zarc",
			d: ad,
			stroke: `url(#zgrad${i})`,
		});
		zwheel.appendChild(a);
		arcs.push(a);
	}

	for (let j = 0; j < 12; j++) {
		const inP = pt(j * 30, ZIN);
		const ouP = pt(j * 30, ZOUT);
		zwheel.appendChild(
			svgEl("line", {
				class: "zdiv",
				x1: inP.x,
				y1: inP.y,
				x2: ouP.x,
				y2: ouP.y,
			}),
		);
	}

	for (let k = 0; k < 12; k++) {
		const gg = svgEl("g", { class: "zglyph" });
		for (const d of GLYPHS[k]) gg.appendChild(svgEl("path", { d }));
		g.appendChild(gg);
		glyphs.push(gg);
	}

	// hit targets for sign card hover — grouped so they rotate with the wheel
	const zhits = svgEl("g", { id: "zhits" });
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
		const h = svgEl("path", { class: "zhit", d });
		zhits.appendChild(h);
		hits.push(h);
	}
	svg?.appendChild(zhits);

	return { wedges, arcs, glyphs, hits, grads };
}
