// The Astrolabe dial FCC component library: the render-once static FCCs
// (sheen / texture / sparkles / spokes geometry) and the dynamic per-subsystem
// FCCs (discs, ptolemaic sun disc, sun hit, zodiac, guilloche lines, date
// complication) plus the built sign-card glyph svg. Each is a Jiffies FCC or
// builder; no raw DOM mutation lives here. `view.ts` constructs these, wires
// them into the dial host groups, and fans Scene slices to them. See
// .ailly/developer/2026-06-23-A-astrolabe-fcc-refactor/design.md.
import { up } from "@davidsouther/jiffies/dom/dom.ts";
import { FCC, State } from "@davidsouther/jiffies/dom/fc.ts";
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
import { range } from "@davidsouther/jiffies/range.ts";
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
	() => [
		circle({ cx: CX, cy: CY, r: 468, fill: "url(#dialSheen)" }),
		...range(0, 120).map((i) => {
			const ang = (i / 120) * 360;
			const inner = pt(ang, 40);
			const outer = pt(ang, 468);
			return line({
				class: "tline",
				x1: inner.x,
				y1: inner.y,
				x2: outer.x,
				y2: outer.y,
				"stroke-width": 0.7,
				"stroke-opacity": (0.07).toFixed(3),
			});
		}),
	],
);

export const Sparkles = FCC(
	"astro-sparkles",
	() => g({ id: "sparkles-fc" }),
	() => {
		const palette = ["#EAF0FF", "#EAF0FF", "#EAF0FF", "#F3DFA6", "#BFD2F2"];
		return range(0, 160).map((k) => {
			const angle = (k / 160) * Math.PI * 2;
			const radius = Math.sqrt((k + 0.5) / 160) * 456;
			// CSS custom properties must go through cssText (string style); index
			// assignment on a CSSStyleDeclaration does not set `--*` properties.
			const opacityHigh = (0.6 + ((k * 3) % 40) / 100).toFixed(2);
			const opacityLow = (0.12 + ((k * 5) % 18) / 100).toFixed(2);
			const duration = `${(2.5 + ((k * 11) % 45) / 10).toFixed(2)}s`;
			const delay = `${((k * 13) % 50) / 10}s`;
			return circle({
				class: "sparkle",
				cx: (CX + radius * Math.cos(angle)).toFixed(1),
				cy: (CY + radius * Math.sin(angle)).toFixed(1),
				r: (1.4 + ((k * 7) % 28) / 10).toFixed(2),
				fill: palette[k % palette.length],
				style: `--o1:${opacityHigh};--o0:${opacityLow};--d:${duration};--dl:${delay}`,
			});
		});
	},
);

// Ptolemaic radial spokes. The boundary IS the `#spokes` clip group, so the FCC
// owns its own show/hide (visible ⇒ shown), mirroring how every controls leaf
// owns the one effect it governs. Geometry is static — built once into [State].
interface SpokesProps {
	visible: boolean;
}
type SpokesState = { lines: Element[] };
export const Spokes = FCC<SpokesProps, SpokesState>(
	"astro-spokes",
	() => g({ id: "spokes", "clip-path": "url(#dialClip)" }),
	(el, attrs) => {
		const st = el[State] as SpokesState;
		if (!st.lines) {
			st.lines = radialSpokes(120, R_SPOKE_INNER, R_MARS, MAX_SPOKE_R).map(
				(s) =>
					line({
						class: "guilloche-line",
						x1: s.x1.toFixed(1),
						y1: s.y1.toFixed(1),
						x2: s.x2.toFixed(1),
						y2: s.y2.toFixed(1),
					}),
			);
		}
		up(el, { style: attrs.visible ? "" : "display:none" });
		return st.lines;
	},
);

// The clock hands group. Boundary IS `#hands`; it owns its own show/hide and
// drives the hour/minute hand transforms. The hand paths + hub are built once
// into [State]; each render re-points the two hands via `up()`.
interface HandsProps {
	hourTransform: string;
	minuteTransform: string;
	visible: boolean;
}
type HandsState = { hour: Element; min: Element; kids: Element[] };
export const Hands = FCC<HandsProps, HandsState>(
	"astro-hands",
	() => g({ id: "hands" }),
	(el, attrs) => {
		const st = el[State] as HandsState;
		if (!st.kids) {
			st.hour = path({
				id: "handHour",
				class: "hand-hour",
				d: "M500 252 L505 472 L502 548 L498 548 L495 472 Z",
			});
			st.min = path({
				id: "handMin",
				class: "hand-min",
				d: "M500 152 L503 470 L501 542 L499 542 L497 470 Z",
			});
			st.kids = [
				st.hour,
				st.min,
				circle({ class: "hub", cx: CX, cy: CY, r: 9 }),
				circle({ class: "hub-dot", cx: CX, cy: CY, r: 2.6 }),
			];
		}
		up(st.hour, { transform: attrs.hourTransform });
		up(st.min, { transform: attrs.minuteTransform });
		up(el, { style: attrs.visible ? "" : "display:none" });
		return st.kids;
	},
);

// The Sun glow at the dial centre (Sun-centred frames). Boundary IS `#sunCenter`;
// it owns its own show/hide. Children are static.
interface SunCenterProps {
	visible: boolean;
}
export const SunCenter = FCC<SunCenterProps>(
	"astro-sun-center",
	() => g({ id: "sunCenter" }),
	(el, attrs) => {
		up(el, { style: attrs.visible ? "" : "display:none" });
		return [
			circle({
				cx: CX,
				cy: CY,
				r: 34,
				fill: "url(#sunGlow)",
				"pointer-events": "none",
			}),
			circle({
				class: "sun-core",
				cx: CX,
				cy: CY,
				r: 15,
				"pointer-events": "none",
			}),
		];
	},
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
	visible: boolean;
}

// `transform` is applied to the boundary by applyUpdate. The disc OWNS its own
// show/hide: render maps the `visible` boolean to the boundary's display (the
// dial analog of CheckControl owning its hide-class), and scrubs the `visible`
// prop so it never lands as a junk boundary attribute. The children are static.
export const SunDisc = FCC<SunDiscProps>(
	"astro-disc-sun",
	() => g({ class: "disc disc-sun", style: "display:none" }),
	(el, attrs) => {
		up(el, { style: attrs.visible ? "" : "display:none", visible: false });
		return [
			circle({ class: "orbit-ring", cx: CX, cy: CY, r: R_SUN_DISC }),
			circle({
				class: "planet sun-disc-dot",
				cx: CX + R_SUN_DISC,
				cy: CY,
				r: 21,
				fill: "#9C6B14",
			}),
		];
	},
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
		return [
			// 12 per-sign gradients (defs)
			svgDefs(
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
			),
			// wedges
			g(
				{ id: "zwedges" },
				...z.map((s, i) =>
					path({
						class: s.active ? "zwedge active" : "zwedge !active",
						d: s.wedgeD,
						fill: `url(#zgrad${i})`,
					}),
				),
			),
			// arcs
			g(
				{ id: "zarcs" },
				...z.map((s, i) =>
					path({
						class: s.active ? "zarc active" : "zarc !active",
						d: s.arcD,
						stroke: `url(#zgrad${i})`,
					}),
				),
			),
			// dividers
			g(
				{ id: "zdivs" },
				...z.map((s) => path({ class: "zdiv", d: s.dividerD })),
			),
			// per-sign glyphs (spread — one <g> each)
			...z.map((s, k) =>
				g(
					{
						class: s.active ? "zglyph active" : "zglyph !active",
						transform: s.glyphTransform,
					},
					...GLYPHS[k].map((d) => path({ d })),
				),
			),
			// hit targets
			g(
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
			),
		];
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
