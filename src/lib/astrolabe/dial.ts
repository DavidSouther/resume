// Importing from jiffies dom triggers the jsdom bootstrap in SSG (Node.js)
// contexts, which sets global.window. Bare `document` is not set by jiffies,
// so we read from window.document for portability.
import "@davidsouther/jiffies/dom/dom.ts";

const SVGNS = "http://www.w3.org/2000/svg";
const CX = 500;
const CY = 500;

// Hardcoded annulus path for zodiac band background (ZIN=422, ZOUT=468).
// pt(0,468)={500,32}; pt(0,422)={500,78}. Evenodd rule cuts the inner hole.
const ZBAND_BG_D =
	"M500 32 A468 468 0 1 1 499.99 32 Z M500 78 A422 422 0 1 0 499.99 78 Z";

// SSG (jsdom) sets window.document but not global.document. Browser has both.
const getDoc = (): Document =>
	typeof document !== "undefined"
		? document
		: (window as Window & typeof globalThis).document;

function svgEl<K extends keyof SVGElementTagNameMap>(
	tag: K,
	attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
	const e = getDoc().createElementNS(SVGNS, tag);
	for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
	return e;
}

function stop(offset: string, color: string, opacity?: string): SVGStopElement {
	const s = svgEl("stop", { offset });
	s.setAttribute("stop-color", color);
	if (opacity !== undefined) s.setAttribute("stop-opacity", opacity);
	return s;
}

export function buildDial(): SVGSVGElement {
	const svg = svgEl("svg", {
		id: "dial",
		viewBox: "0 0 1000 1000",
		preserveAspectRatio: "xMidYMid meet",
	});
	// clip-path is NOT on the SVG root — only on #twilightCone

	// ---- defs ----
	const defs = svgEl("defs", {});

	const dialClip = svgEl("clipPath", { id: "dialClip" });
	dialClip.appendChild(svgEl("circle", { cx: CX, cy: CY, r: 470 }));
	defs.appendChild(dialClip);

	const twilightGrad = svgEl("radialGradient", {
		id: "twilightGrad",
		gradientUnits: "userSpaceOnUse",
		cx: CX,
		cy: CY,
		r: 470,
	});
	twilightGrad.appendChild(stop("0%", "#D4A843", "0.30"));
	twilightGrad.appendChild(stop("55%", "#D4A843", "0.10"));
	twilightGrad.appendChild(stop("100%", "#D4A843", "0"));
	defs.appendChild(twilightGrad);

	const vignette = svgEl("radialGradient", {
		id: "vignette",
		cx: "50%",
		cy: "50%",
		r: "50%",
	});
	vignette.appendChild(stop("55%", "#000", "0"));
	vignette.appendChild(stop("100%", "#000", "0.55"));
	defs.appendChild(vignette);

	const sunGlow = svgEl("radialGradient", {
		id: "sunGlow",
		cx: "50%",
		cy: "50%",
		r: "50%",
	});
	const sg0 = svgEl("stop", { offset: "0%", class: "sg0" });
	const sg1 = svgEl("stop", { offset: "100%", class: "sg1" });
	sunGlow.appendChild(sg0);
	sunGlow.appendChild(sg1);
	defs.appendChild(sunGlow);

	const gold = svgEl("linearGradient", {
		id: "gold",
		gradientUnits: "userSpaceOnUse",
		x1: CX,
		y1: 14,
		x2: CX,
		y2: 986,
	});
	gold.appendChild(stop("0%", "#7C642E"));
	gold.appendChild(stop("16%", "#E7D7A2"));
	gold.appendChild(stop("38%", "#BC9C56"));
	gold.appendChild(stop("62%", "#F1E8C4"));
	gold.appendChild(stop("84%", "#A6873F"));
	gold.appendChild(stop("100%", "#5E4A23"));
	defs.appendChild(gold);

	svg.appendChild(defs);

	// ---- background layers ----
	svg.appendChild(svgEl("circle", { class: "ground", cx: CX, cy: CY, r: 470 }));

	// guilloche (populated by buildGuilloche / updateGuilloche)
	svg.appendChild(svgEl("g", { id: "guilloche" }));

	// texture and sparkles (populated by initTexture)
	svg.appendChild(svgEl("g", { id: "texture" }));
	svg.appendChild(svgEl("g", { id: "sparkles" }));

	// zodiac band fill annulus (path set by buildZodiac — empty placeholder satisfies CSS class)
	svg.appendChild(
		svgEl("path", {
			id: "zbandBg",
			class: "zband-bg",
			d: ZBAND_BG_D,
			"fill-rule": "evenodd",
		}),
	);

	// vignette overlay
	svg.appendChild(
		svgEl("circle", { cx: CX, cy: CY, r: 470, fill: "url(#vignette)" }),
	);

	// zodiac, disc, conjunction groups
	svg.appendChild(svgEl("g", { id: "zodiac" }));
	svg.appendChild(svgEl("g", { id: "discs" }));

	// twilight cone (path set each frame by animation)
	const cone = svgEl("path", {
		id: "twilightCone",
		fill: "url(#twilightGrad)",
		"clip-path": "url(#dialClip)",
		opacity: "0.25",
	});
	svg.appendChild(cone);

	svg.appendChild(svgEl("g", { id: "conj" }));

	// sun at centre
	const sunGlowEl = svgEl("circle", {
		cx: CX,
		cy: CY,
		r: 34,
		fill: "url(#sunGlow)",
	});
	sunGlowEl.setAttribute("pointer-events", "none");
	svg.appendChild(sunGlowEl);
	const sunCore = svgEl("circle", { class: "sun-core", cx: CX, cy: CY, r: 15 });
	sunCore.setAttribute("pointer-events", "none");
	svg.appendChild(sunCore);

	// gold bezel ring
	const bezelRing = svgEl("circle", {
		class: "bezel-ring",
		cx: CX,
		cy: CY,
		r: 484,
	});
	bezelRing.setAttribute("stroke", "url(#gold)");
	bezelRing.setAttribute("stroke-width", "28");
	svg.appendChild(bezelRing);
	const bezelEdge1 = svgEl("circle", {
		class: "bezel-edge",
		cx: CX,
		cy: CY,
		r: 470,
	});
	bezelEdge1.setAttribute("stroke", "rgba(255,255,255,0.16)");
	svg.appendChild(bezelEdge1);
	const bezelEdge2 = svgEl("circle", {
		class: "bezel-edge",
		cx: CX,
		cy: CY,
		r: 498,
	});
	bezelEdge2.setAttribute("stroke", "rgba(0,0,0,0.45)");
	svg.appendChild(bezelEdge2);

	// watch hands
	const hands = svgEl("g", { id: "hands" });
	hands.appendChild(
		svgEl("path", {
			id: "handHour",
			class: "hand-hour",
			d: "M500 252 L505 472 L502 548 L498 548 L495 472 Z",
		}),
	);
	hands.appendChild(
		svgEl("path", {
			id: "handMin",
			class: "hand-min",
			d: "M500 152 L503 470 L501 542 L499 542 L497 470 Z",
		}),
	);
	hands.appendChild(svgEl("circle", { class: "hub", cx: CX, cy: CY, r: 9 }));
	hands.appendChild(
		svgEl("circle", { class: "hub-dot", cx: CX, cy: CY, r: 2.6 }),
	);
	svg.appendChild(hands);

	// dial-g for any additional animation overlays
	svg.appendChild(svgEl("g", { id: "dial-g" }));

	return svg as SVGSVGElement;
}
