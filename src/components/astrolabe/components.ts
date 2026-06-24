// The Astrolabe dial FCC component library: the render-once static FCCs
// (sheen / texture / sparkles / spokes geometry) and the dynamic per-subsystem
// FCCs (discs, ptolemaic sun disc, sun hit, zodiac, guilloche lines, date
// complication) plus the built sign-card glyph svg. Each is a Jiffies FCC or
// builder; no raw DOM mutation lives here. `view.ts` constructs these, wires
// them into the dial host groups, and fans Scene slices to them. See
// .ailly/developer/2026-06-23-A-astrolabe-fcc-refactor/design.md.
import { FCC } from "@davidsouther/jiffies/dom/fc.ts";
import {
	svg as buildSvg,
	circle,
	ellipse,
	g,
	line,
	linearGradient,
	path,
	radialGradient,
	stop,
	defs as svgDefs,
	text,
} from "@davidsouther/jiffies/dom/svg.ts";
import { BODIES, GLYPHS } from "../../lib/astrolabe/bodies.ts";
import { radialSpokes } from "../../lib/astrolabe/geocentric.ts";
import { pt } from "../../lib/astrolabe/math.ts";
import type { Scene } from "../../lib/astrolabe/simulate.ts";

const CX = 500;
const CY = 500;
const ZIN = 422;
const ZHIT_IN = 410;
const ZHIT_OUT = 472;
const R_SUN_DISC = 168.4;
const R_MARS = 197.5;
const MAX_SPOKE_R = 422;
const R_SPOKE_INNER = 14;

export type EventMap = Record<string, (e: Event) => void>;

// --- Render-once static FCCs ------------------------------------------------

export const SHEEN = FCC(
	"astro-sheen",
	() => svgDefs({}),
	() => [
		radialGradient(
			{
				id: "dialSheen",
				gradientUnits: "userSpaceOnUse",
				cx: CX,
				cy: 452,
				r: 470,
			},
			stop({ offset: "0%", "stop-color": "#9FB2DE", "stop-opacity": "0.17" }),
			stop({ offset: "55%", "stop-color": "#9FB2DE", "stop-opacity": "0.05" }),
			stop({ offset: "100%", "stop-color": "#9FB2DE", "stop-opacity": "0" }),
		),
	],
);

export const Texture = FCC(
	"astro-texture",
	() => g({ id: "texture-fc" }),
	() => {
		const out: Element[] = [
			circle({ cx: CX, cy: CY, r: 468, fill: "url(#dialSheen)" }),
		];
		for (let i = 0; i < 120; i++) {
			const ang = (i / 120) * 360;
			const a = pt(ang, 40);
			const b = pt(ang, 468);
			out.push(
				line({
					class: "tline",
					x1: a.x,
					y1: a.y,
					x2: b.x,
					y2: b.y,
					"stroke-width": 0.7,
					"stroke-opacity": (0.07).toFixed(3),
				}),
			);
		}
		return out;
	},
);

export const Sparkles = FCC(
	"astro-sparkles",
	() => g({ id: "sparkles-fc" }),
	() => {
		const palette = ["#EAF0FF", "#EAF0FF", "#EAF0FF", "#F3DFA6", "#BFD2F2"];
		const out: Element[] = [];
		for (let k = 0; k < 160; k++) {
			const th = (k / 160) * Math.PI * 2;
			const rr = Math.sqrt((k + 0.5) / 160) * 456;
			// CSS custom properties must go through cssText (string style); index
			// assignment on a CSSStyleDeclaration does not set `--*` properties.
			const o1 = (0.6 + ((k * 3) % 40) / 100).toFixed(2);
			const o0 = (0.12 + ((k * 5) % 18) / 100).toFixed(2);
			const d = `${(2.5 + ((k * 11) % 45) / 10).toFixed(2)}s`;
			const dl = `${((k * 13) % 50) / 10}s`;
			out.push(
				circle({
					class: "sparkle",
					cx: (CX + rr * Math.cos(th)).toFixed(1),
					cy: (CY + rr * Math.sin(th)).toFixed(1),
					r: (1.4 + ((k * 7) % 28) / 10).toFixed(2),
					fill: palette[k % palette.length],
					style: `--o1:${o1};--o0:${o0};--d:${d};--dl:${dl}`,
				}),
			);
		}
		return out;
	},
);

export const Spokes = FCC(
	"astro-spokes-geom",
	() => g({ id: "spokes-fc" }),
	() =>
		radialSpokes(120, R_SPOKE_INNER, R_MARS, MAX_SPOKE_R).map((s) =>
			line({
				class: "guilloche-line",
				x1: s.x1.toFixed(1),
				y1: s.y1.toFixed(1),
				x2: s.x2.toFixed(1),
				y2: s.y2.toFixed(1),
			}),
		),
);

// --- Dynamic FCCs -----------------------------------------------------------

interface DiscProps {
	transform: string;
	// Kept off the boundary (applyUpdate would wire listeners on the <g>);
	// render forwards them to the `.hit` child's `events:` only.
	hitEvents?: EventMap;
}

// One disc per BODIES entry. Boundary <g class="disc disc-<key>"> carries the
// per-frame transform; children are static builder leaves. The frame test reads
// `.disc-<key>`'s transform directly off this boundary.
export function makeDisc(bodyKey: string) {
	const b = BODIES.find((x) => x.key === bodyKey);
	if (!b) throw new Error(`unknown body ${bodyKey}`);
	const ox = b.moon ? 0 : CX;
	const oy = b.moon ? 0 : CY;
	const dx = ox + b.r;
	return FCC<DiscProps>(
		`astro-disc-${bodyKey}`,
		() => g({ class: `disc disc-${bodyKey}` }),
		(_el, attrs) => {
			// `transform` is applied to the boundary by applyUpdate (no self-update,
			// which would recurse). Children are static builder leaves.
			const kids: Element[] = [
				circle({ class: "orbit-ring", cx: ox, cy: oy, r: b.r }),
				line({ class: "spoke", x1: ox, y1: oy, x2: dx, y2: oy }),
			];
			if (b.ring) {
				kids.push(
					ellipse({
						class: "saturn-ring",
						cx: dx,
						cy: oy,
						rx: b.dot + 6,
						ry: ((b.dot + 6) * 0.36).toFixed(2),
					}),
				);
			}
			if (b.key === "earth") {
				kids.push(
					circle({ class: "earth-ring", cx: dx, cy: oy, r: b.dot + 3 }),
				);
			}
			kids.push(
				circle({
					class: "planet",
					cx: dx,
					cy: oy,
					r: b.dot,
					fill: `var(--${b.key})`,
				}),
			);
			kids.push(
				circle({
					class: "hit",
					cx: dx,
					cy: oy,
					r: Math.max(16, b.dot + 11),
					events: attrs.hitEvents ?? {},
				}),
			);
			return kids;
		},
	);
}

interface SunDiscProps {
	transform: string;
	style: string;
}

// `transform` and `style` (display toggle) are applied to the boundary by
// applyUpdate; the children are static.
export const SunDisc = FCC<SunDiscProps>(
	"astro-disc-sun",
	() => g({ class: "disc disc-sun", style: "display:none" }),
	() => [
		circle({ class: "orbit-ring", cx: CX, cy: CY, r: R_SUN_DISC }),
		circle({
			class: "planet sun-disc-dot",
			cx: CX + R_SUN_DISC,
			cy: CY,
			r: 21,
			fill: "#9C6B14",
		}),
	],
);

interface SunHitProps {
	x: number;
	y: number;
	hitEvents?: EventMap;
}

export const SunHit = FCC<SunHitProps>(
	"astro-sun-hit",
	() => g({ id: "sun-hit-fc" }),
	(_el, attrs) => [
		circle({
			class: "hit",
			cx: attrs.x,
			cy: attrs.y,
			r: 24,
			events: attrs.hitEvents ?? {},
		}),
	],
);

interface ZodiacProps {
	zodiac: Scene["zodiac"];
	zhitsTransform: string;
	signEvents?: (i: number) => EventMap;
}

// Zodiac subsystem: the 12 gradients (defs), wedges, arcs, dividers, glyphs, and
// the #zhits group. The frame test reads `#zdivs .zdiv[d]` and
// `#zwedges .zwedge.active`.
export const Zodiac = FCC<ZodiacProps>(
	"astro-zodiac",
	() => g({ id: "zodiac-fc" }),
	(_el, attrs) => {
		const z = attrs.zodiac;
		const grads = svgDefs(
			{ id: "zgrads" },
			...z.map((s, i) => {
				const iA = pt(i * 30, ZIN);
				const iB = pt(i * 30 + 30, ZIN);
				return linearGradient(
					{
						id: `zgrad${i}`,
						gradientUnits: "userSpaceOnUse",
						x1: iA.x,
						y1: iA.y,
						x2: iB.x,
						y2: iB.y,
					},
					...s.gradientStops.map((gs) =>
						stop({ offset: gs.offset, "stop-color": gs.color }),
					),
				);
			}),
		);
		const zwedges = g(
			{ id: "zwedges" },
			...z.map((s, i) =>
				path({
					class: s.active ? "zwedge active" : "zwedge !active",
					d: s.wedgeD,
					fill: `url(#zgrad${i})`,
				}),
			),
		);
		const zarcs = g(
			{ id: "zarcs" },
			...z.map((s, i) =>
				path({
					class: s.active ? "zarc active" : "zarc !active",
					d: s.arcD,
					stroke: `url(#zgrad${i})`,
				}),
			),
		);
		const zdivs = g(
			{ id: "zdivs" },
			...z.map((s) => path({ class: "zdiv", d: s.dividerD })),
		);
		const zglyphs = z.map((s, k) =>
			g(
				{
					class: s.active ? "zglyph active" : "zglyph !active",
					transform: s.glyphTransform,
				},
				...GLYPHS[k].map((d) => path({ d })),
			),
		);
		const zhits = g(
			{ id: "zhits", transform: attrs.zhitsTransform },
			...z.map((_s, i) => {
				const c0 = i * 30;
				const c1 = c0 + 30;
				const oA = pt(c0, ZHIT_OUT);
				const oB = pt(c1, ZHIT_OUT);
				const iB = pt(c1, ZHIT_IN);
				const iA = pt(c0, ZHIT_IN);
				const d =
					`M${oA.x} ${oA.y} A${ZHIT_OUT} ${ZHIT_OUT} 0 0 1 ${oB.x} ${oB.y}` +
					` L${iB.x} ${iB.y} A${ZHIT_IN} ${ZHIT_IN} 0 0 0 ${iA.x} ${iA.y} Z`;
				return path({
					class: "zhit",
					d,
					events: attrs.signEvents ? attrs.signEvents(i) : {},
				});
			}),
		);
		return [grads, zwedges, zarcs, zdivs, ...zglyphs, zhits];
	},
);

interface GuillocheProps {
	lines: { d: string; opacity?: number }[];
}

export const Guilloche = FCC<GuillocheProps>(
	"astro-guilloche-lines",
	() => g({ id: "guilloche-fc" }),
	(_el, attrs) =>
		attrs.lines.map((l) =>
			l.opacity !== undefined
				? path({
						class: "guilloche-line",
						d: l.d,
						opacity: l.opacity.toFixed(3),
					})
				: path({ class: "guilloche-line", d: l.d }),
		),
);

interface DateProps {
	x: number;
	y: number;
	month: string;
	day: string;
}

export const DateComplication = FCC<DateProps>(
	"astro-date",
	() => g({ id: "date-fc" }),
	(_el, attrs) => [
		text(
			{
				class: "date-month",
				x: attrs.x.toFixed(1),
				y: (attrs.y - 7.5).toFixed(1),
			},
			attrs.month,
		),
		text(
			{
				class: "date-day",
				x: attrs.x.toFixed(1),
				y: (attrs.y + 4.5).toFixed(1),
			},
			attrs.day,
		),
	],
);

// Sign-card glyph as a built <svg> subtree (never an HTML string).
export function glyphSvg(sign: number, size: number) {
	return buildSvg(
		{
			class: "sc-glyph",
			viewBox: "0 0 24 24",
			width: size,
			height: size,
			fill: "none",
			stroke: "currentColor",
			"stroke-width": 2,
			"stroke-linecap": "round",
			"stroke-linejoin": "round",
		},
		...GLYPHS[sign].map((d) => path({ d })),
	);
}
