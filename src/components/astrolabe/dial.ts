// Importing from jiffies dom triggers the jsdom bootstrap in SSG (Node.js)
// contexts, which sets global.window. Bare `document` is not set by jiffies,
// so we read from window.document for portability.
import "@davidsouther/jiffies/dom/dom.ts";
import {
	svg as buildSvg,
	circle,
	clipPath,
	defs,
	g,
	linearGradient,
	path,
	radialGradient,
	stop,
} from "@davidsouther/jiffies/dom/svg.ts";

const CX = 500;
const CY = 500;

// Hardcoded annulus path for zodiac band background (ZIN=422, ZOUT=468).
// pt(0,468)={500,32}; pt(0,422)={500,78}. Evenodd rule cuts the inner hole.
const ZBAND_BG_D =
	"M500 32 A468 468 0 1 1 499.99 32 Z M500 78 A422 422 0 1 0 499.99 78 Z";

export function buildDial(): SVGSVGElement {
	return buildSvg(
		{
			id: "dial",
			viewBox: "0 0 1000 1000",
			preserveAspectRatio: "xMidYMid meet",
		},

		defs(
			{},
			clipPath({ id: "dialClip" }, circle({ cx: CX, cy: CY, r: 470 })),
			// evenodd clip excludes the twilight-cone triangle from the guilloche.
			// The d attribute is updated each frame by animation.ts.
			clipPath(
				{ id: "guillocheClip" },
				path({ id: "guillocheClipPath", "fill-rule": "evenodd", d: "" }),
			),
			radialGradient(
				{
					id: "twilightGrad",
					gradientUnits: "userSpaceOnUse",
					cx: CX,
					cy: CY,
					r: 470,
				},
				stop({ offset: "0%", "stop-color": "#D4A843", "stop-opacity": "0.30" }),
				stop({
					offset: "55%",
					"stop-color": "#D4A843",
					"stop-opacity": "0.10",
				}),
				stop({ offset: "100%", "stop-color": "#D4A843", "stop-opacity": "0" }),
			),
			radialGradient(
				{ id: "vignette", cx: "50%", cy: "50%", r: "50%" },
				stop({ offset: "55%", "stop-color": "#000", "stop-opacity": "0" }),
				stop({ offset: "100%", "stop-color": "#000", "stop-opacity": "0.55" }),
			),
			radialGradient(
				{ id: "sunGlow", cx: "50%", cy: "50%", r: "50%" },
				stop({ offset: "0%", class: "sg0" }),
				stop({ offset: "100%", class: "sg1" }),
			),
			// Bezel metal: the case material (--case) tinted top-to-bottom by
			// opacity to read as a vertical sheen. Lower opacity reveals the dark
			// --page behind the ring, darkening the edges like a polished rim.
			linearGradient(
				{
					id: "caseMetal",
					gradientUnits: "userSpaceOnUse",
					x1: CX,
					y1: 14,
					x2: CX,
					y2: 986,
				},
				stop({
					offset: "0%",
					"stop-color": "var(--case)",
					"stop-opacity": "0.45",
				}),
				stop({
					offset: "16%",
					"stop-color": "var(--case)",
					"stop-opacity": "1",
				}),
				stop({
					offset: "38%",
					"stop-color": "var(--case)",
					"stop-opacity": "0.7",
				}),
				stop({
					offset: "62%",
					"stop-color": "var(--case)",
					"stop-opacity": "1",
				}),
				stop({
					offset: "84%",
					"stop-color": "var(--case)",
					"stop-opacity": "0.62",
				}),
				stop({
					offset: "100%",
					"stop-color": "var(--case)",
					"stop-opacity": "0.4",
				}),
			),
		),

		// background layers
		circle({ class: "ground", cx: CX, cy: CY, r: 470 }),

		// zbandBg before guilloche/texture so they render on top of the band colour
		path({
			id: "zbandBg",
			class: "zband-bg",
			d: ZBAND_BG_D,
			"fill-rule": "evenodd",
		}),

		// guilloche (populated by updateGuilloche); twilight shadow is clipped out
		g({ id: "guilloche", "clip-path": "url(#guillocheClip)" }),

		// texture and sparkles (populated by initTexture)
		g({ id: "texture" }),
		g({ id: "sparkles" }),

		// vignette overlay
		circle({ cx: CX, cy: CY, r: 470, fill: "url(#vignette)" }),

		// zodiac, disc, conjunction groups
		g({ id: "zodiac" }),
		g({ id: "discs" }),

		// twilight cone (path set each frame by animation)
		path({
			id: "twilightCone",
			fill: "url(#twilightGrad)",
			"clip-path": "url(#dialClip)",
			opacity: "0.25",
		}),

		g({ id: "conj" }),

		// sun at centre
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

		// case-metal bezel ring
		circle({
			class: "bezel-ring",
			cx: CX,
			cy: CY,
			r: 484,
			stroke: "url(#caseMetal)",
			"stroke-width": 28,
		}),
		circle({
			class: "bezel-edge",
			cx: CX,
			cy: CY,
			r: 470,
			stroke: "rgba(255,255,255,0.16)",
		}),
		circle({
			class: "bezel-edge",
			cx: CX,
			cy: CY,
			r: 498,
			stroke: "rgba(0,0,0,0.45)",
		}),

		// watch hands
		g(
			{ id: "hands" },
			path({
				id: "handHour",
				class: "hand-hour",
				d: "M500 252 L505 472 L502 548 L498 548 L495 472 Z",
			}),
			path({
				id: "handMin",
				class: "hand-min",
				d: "M500 152 L503 470 L501 542 L499 542 L497 470 Z",
			}),
			circle({ class: "hub", cx: CX, cy: CY, r: 9 }),
			circle({ class: "hub-dot", cx: CX, cy: CY, r: 2.6 }),
		),

		g({ id: "dial-g" }),
	) as SVGSVGElement;
}
