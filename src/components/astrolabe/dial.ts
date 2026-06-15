// The populated SVG dial (CONSUMES Contracts 1, 3, 4).
//
// Builds one <svg viewBox="-500 -500 1000 1000"> containing, in paint order:
//   1. the guilloché finish  — a prebaked <image> (production) or a live
//      feTurbulence/feDisplacementMap relief (#debug), engine-turned spirals
//      centered from Earth (visual spec);
//   2. the midnight-lacquer overlay — a translucent <rect> reading --lacquer-depth
//      (Contract 4) so the finish sits under dark lacquer (Patek 4997/200G);
//   3. the twilight dead-zone wedge — a <path> from Earth toward the Sun marking
//      the solar-glare cone where alignments are unreadable (visual spec); and
//   4. the body groups — one <g data-body="…" transform="translate(x,y)"> per body
//      from ephemerisPositions(date), each holding a <circle> filled with the
//      body's --color-<body> token (Contract 3).
//
// Bodies are painted LAST so they stay on top and addressable: the single-<svg>
// invariant and the ten [data-body] groups the feature test relies on are
// load-bearing — the finish and the wedge are NOT [data-body] groups and never
// add a second <svg>.
//
// jiffies SVG factories type their attrs by the element's own IDL properties;
// `viewBox`, `transform`, `data-body`, `fill`, and the finish attrs are NOT IDL
// properties, so they are set with `setAttribute` after construction (the F1
// dial-container.ts idiom).
import {
	circle,
	defs,
	feDisplacementMap,
	feTurbulence,
	filter,
	g,
	image,
	path,
	rect,
	svg,
} from "@davidsouther/jiffies/dom/svg.ts";
import type { BodyPosition } from "../../lib/astro-math.ts";
import type { BodyName } from "../../lib/astro-tokens.ts";
import { bodyColorVar, MATERIAL_TOKENS } from "../../lib/astro-tokens.ts";
import { GUILLOCHE_IMAGE } from "../../lib/guilloche-image.ts";
import { ephemerisPositions } from "./ephemeris.ts";
import { ZodiacBand } from "./zodiac.ts";
import { zodiacSymbolDefs } from "./zodiac-glyphs.ts";

// Body marker radii (SVG user units). The Sun is the largest center disc; the
// Moon is the smallest; the eight planets share one mid radius. Tuned for
// legibility inside the ±500 viewBox; refined visually in a later session.
const SUN_RADIUS = 26;
const MOON_RADIUS = 10;
const PLANET_RADIUS = 16;

// The dial spans the ±500 viewBox; the finish fills it edge to edge.
const VIEWBOX = "-500 -500 1000 1000";
const VIEWBOX_MIN = -500;
const VIEWBOX_SPAN = 1000;

// The twilight dead-zone half-angle (degrees): the ~11° solar-glare cone around
// the Sun direction where alignments are lost to the Sun's light (visual spec).
const TWILIGHT_HALF_ANGLE_DEG = 11;

// The id the live #debug relief filter is referenced by. The Step-5 guilloché
// sliders drive this filter's feTurbulence/feDisplacementMap parameters; the
// guilloché section imports this id so the filter element is addressed in one
// place rather than the string being duplicated across modules.
export const GUILLOCHE_FILTER_ID = "astrolabe-guilloche-relief";

/** The marker radius for a body, by role (Sun largest, Moon smallest). */
function bodyRadius(body: BodyName): number {
	if (body === "sun") {
		return SUN_RADIUS;
	}
	if (body === "moon") {
		return MOON_RADIUS;
	}
	return PLANET_RADIUS;
}

/** A single body group: <g data-body transform="translate(x,y)"> wrapping a token-filled <circle>. */
function bodyGroup(body: BodyName, x: number, y: number): Element {
	const marker = circle({});
	marker.setAttribute("r", String(bodyRadius(body)));
	marker.setAttribute("fill", `var(${bodyColorVar(body)})`);

	const group = g({}, marker);
	group.setAttribute("data-body", body);
	// The body's ring radius (distance from the dial center) is F3's parallax depth
	// hint: parallax.ts shifts inner orbits more than outer ones from this value.
	group.setAttribute("data-radius", String(Math.hypot(x, y)));
	// Bodies at the center (the Sun, radius 0) carry no translate; the feature
	// test treats an absent translate and translate(0,0) alike.
	if (x !== 0 || y !== 0) {
		group.setAttribute("transform", `translate(${x},${y})`);
	}
	return group;
}

/**
 * The live #debug guilloché relief filter: feTurbulence generates a spiral-like
 * noise field, feDisplacementMap embosses it into engine-turned relief. The
 * Step-5 sliders drive baseFrequency/numOctaves/scale through these attrs; this
 * is the live alternative to the prebaked <image>, swapped under #debug.
 */
function guillocheReliefFilter(): Element {
	const turbulence = feTurbulence({});
	turbulence.setAttribute("type", "turbulence");
	turbulence.setAttribute("baseFrequency", "0.012 0.012");
	turbulence.setAttribute("numOctaves", "2");
	turbulence.setAttribute("seed", "7");
	turbulence.setAttribute("result", "noise");
	turbulence.setAttribute("data-param", "density");

	const displace = feDisplacementMap({});
	displace.setAttribute("in", "SourceGraphic");
	displace.setAttribute("in2", "noise");
	displace.setAttribute("scale", "18");
	displace.setAttribute("xChannelSelector", "R");
	displace.setAttribute("yChannelSelector", "G");
	displace.setAttribute("data-param", "relief");

	const reliefFilter = filter({}, turbulence, displace);
	reliefFilter.setAttribute("id", GUILLOCHE_FILTER_ID);
	reliefFilter.setAttribute("x", "-10%");
	reliefFilter.setAttribute("y", "-10%");
	reliefFilter.setAttribute("width", "120%");
	reliefFilter.setAttribute("height", "120%");
	return defs({}, reliefFilter);
}

/**
 * The guilloché finish layer: the prebaked engine-turned <image> filling the
 * viewBox, carrying the live relief filter in <defs> (driven by the #debug
 * sliders). Production renders the flat <image>; the #debug sliders activate the
 * filter live without a rebuild. Layered first so it sits behind everything.
 */
function guillocheFinish(): Element[] {
	const finish = image({});
	finish.setAttribute("href", GUILLOCHE_IMAGE);
	finish.setAttribute("x", String(VIEWBOX_MIN));
	finish.setAttribute("y", String(VIEWBOX_MIN));
	finish.setAttribute("width", String(VIEWBOX_SPAN));
	finish.setAttribute("height", String(VIEWBOX_SPAN));
	finish.setAttribute("preserveAspectRatio", "xMidYMid slice");
	// Reference the live relief filter so the prebaked image reads as engine-turned
	// metal under #debug; the Step-5 flat-finish toggle clears this ref to drop back
	// to the flat prebaked image.
	finish.setAttribute("filter", `url(#${GUILLOCHE_FILTER_ID})`);
	finish.setAttribute("data-finish", "guilloche");
	return [guillocheReliefFilter(), finish];
}

/**
 * The midnight-lacquer overlay: a translucent <rect> filling the viewBox, filled
 * with --lacquer-depth (Contract 4) so the guilloché reads as engine-turning seen
 * through dark lacquer. The #debug material section retints --lacquer-depth live.
 */
function lacquerOverlay(): Element {
	const overlay = rect({});
	overlay.setAttribute("x", String(VIEWBOX_MIN));
	overlay.setAttribute("y", String(VIEWBOX_MIN));
	overlay.setAttribute("width", String(VIEWBOX_SPAN));
	overlay.setAttribute("height", String(VIEWBOX_SPAN));
	overlay.setAttribute("fill", `var(${MATERIAL_TOKENS.lacquerDepth})`);
	overlay.setAttribute("data-finish", "lacquer");
	return overlay;
}

/**
 * The twilight dead-zone wedge: a <path> from Earth's anchor toward the Sun at
 * center, spanning the ~±11° solar-glare cone (visual spec). Alignments inside
 * this wedge are lost to the Sun's light, so it is tinted as a non-reading zone.
 * Read off the same geocentric system as the bodies: the apex is Earth's pinned
 * anchor, the two rays bracket the Sun direction (toward center).
 */
function twilightWedge(earth: BodyPosition): Element {
	const apexX = earth.x;
	const apexY = earth.y;

	// The Sun direction from Earth, then the two rays bracketing it by the cone
	// half-angle. The rays extend past the Sun (to center and a touch beyond) so
	// the wedge spans the readable field, not just to the Sun disc.
	const toSun = Math.atan2(-apexY, -apexX);
	const half = (TWILIGHT_HALF_ANGLE_DEG * Math.PI) / 180;
	// Reach beyond center so the wedge crosses the whole sightline corridor.
	const reach = Math.hypot(apexX, apexY) * 1.2;

	const leftX = apexX + reach * Math.cos(toSun - half);
	const leftY = apexY + reach * Math.sin(toSun - half);
	const rightX = apexX + reach * Math.cos(toSun + half);
	const rightY = apexY + reach * Math.sin(toSun + half);

	const wedge = path({});
	wedge.setAttribute(
		"d",
		`M ${apexX} ${apexY} L ${leftX} ${leftY} L ${rightX} ${rightY} Z`,
	);
	wedge.setAttribute("fill", `var(${bodyColorVar("sun")})`);
	wedge.setAttribute("fill-opacity", "0.12");
	wedge.setAttribute("data-finish", "twilight");
	return wedge;
}

/** The populated <svg viewBox="-500 -500 1000 1000"> dial: finish, lacquer, twilight wedge, then bodies on top. */
export function Dial(date: Date = new Date()): Element {
	const positions = ephemerisPositions(date);
	const earth =
		positions.find((position) => position.body === "earth") ??
		({ body: "earth", x: 0, y: 0, angle: 0, radius: 0 } satisfies BodyPosition);

	const groups = positions.map((position) =>
		bodyGroup(position.body, position.x, position.y),
	);

	// Paint order: guilloché finish → lacquer overlay → twilight wedge → zodiac
	// band → bodies. The zodiac glyph <symbol> defs and the band ride INSIDE this
	// single <svg> (no second <svg>); the band is NOT a [data-body] group. Bodies
	// LAST keeps them on top and addressable for F3 interaction.
	const dial = svg(
		{},
		...guillocheFinish(),
		lacquerOverlay(),
		twilightWedge(earth),
		zodiacSymbolDefs(),
		ZodiacBand(positions),
		...groups,
	);
	dial.setAttribute("viewBox", VIEWBOX);
	return dial;
}
