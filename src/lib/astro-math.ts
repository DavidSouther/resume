// Coordinate-system implementation for the geocentric dial (PRODUCES Contract 1).
//
// The thesis encoded in math: Earth is pinned on the +x ray (3 o'clock) for every
// date, the Sun sits at center (radius 0), and the eight planets ring outward by a
// fixed log-radial map of their semi-major axis. F3 animates these positions; the
// dial component (dial.ts) renders each as a <g transform="translate(x,y)"> group.
//
// BodyName has ONE source of truth: F1's astro-tokens.ts. This module re-exports it
// and aligns every body set (PLANET_ORDER, SEMI_MAJOR_AXIS_AU) to it; it MUST NOT
// redeclare BodyName.
//
// STEP 0: signature-only stubs. Bodies are filled in Steps 1 (date-independent
// constants + transforms) and 2 (per-date geocentricPositions).
export type { BodyName } from "./astro-tokens.ts";

import type { BodyName } from "./astro-tokens.ts";

/** Heliocentric semi-major axis, in AU, keyed by body. Mercury 0.387 … Neptune 30.07.
 *
 * The Sun is the dial center (sentinel 0); the Moon rides Earth (its axis is unused
 * for ring placement, set to Earth's 1 AU). The eight planet values are the standard
 * mean orbital semi-major axes. */
export const SEMI_MAJOR_AXIS_AU: Readonly<Record<BodyName, number>> = {
	sun: 0,
	mercury: 0.387,
	venus: 0.723,
	earth: 1,
	moon: 1,
	mars: 1.524,
	jupiter: 5.203,
	saturn: 9.537,
	uranus: 19.191,
	neptune: 30.07,
};

/** The eight planets, in semi-major-axis order — the ring ordering. Excludes sun and moon. */
export const PLANET_ORDER: readonly BodyName[] = (
	[
		"mercury",
		"venus",
		"earth",
		"mars",
		"jupiter",
		"saturn",
		"uranus",
		"neptune",
	] as const
)
	.slice()
	.sort((a, b) => SEMI_MAJOR_AXIS_AU[a] - SEMI_MAJOR_AXIS_AU[b]);

/** Inner dial radius (SVG user units): the innermost orbit ring (Mercury).
 *  Inside the ±500 viewBox, off the rim so the F3 zodiac band has room. */
export const R_INNER = 140;

/** Outer dial radius (SVG user units): the outermost orbit ring (Neptune).
 *  Inside the ±500 viewBox, off the rim so the F3 zodiac band has room. */
export const R_OUTER = 440;

/** Mercury's axis (AU) anchors logRadius to R_INNER. */
const A_INNER = 0.387;

/** Neptune's axis (AU) anchors logRadius to R_OUTER. */
const A_OUTER = 30.1;

/** Constant rotation pinning angle 0 onto the +x ray (3 o'clock). The transform is
 *  already (x = r·cos θ, y = r·sin θ), so angle 0 lands on +x with no extra rotation. */
const EARTH_PIN_ROTATION = 0;

/** A rendered body position in SVG user space — the value placed in the <g> transform. */
export interface BodyPosition {
	body: BodyName;
	/** SVG x; positive toward 3 o'clock. */
	x: number;
	/** SVG y; positive downward (SVG convention). */
	y: number;
	/** Geocentric ecliptic direction (radians), date-dependent. */
	angle: number;
	/** Fixed log-radial distance; 0 for the Sun. */
	radius: number;
}

/** Fixed log-radial map: semi-major axis (AU) onto [R_INNER, R_OUTER], linear in log10(a).
 *  Anchors Mercury (0.387 AU) at R_INNER and Neptune (30.1 AU) at R_OUTER. */
export function logRadius(semiMajorAxisAu: number): number {
	const span = Math.log10(A_OUTER) - Math.log10(A_INNER);
	const t = (Math.log10(semiMajorAxisAu) - Math.log10(A_INNER)) / span;
	return R_INNER + t * (R_OUTER - R_INNER);
}

/** Ecliptic direction (radians) + radius → (x, y), pinning Earth on the +x ray.
 *  Returns (x = r·cos θ, y = r·sin θ) with the +y-down SVG convention, so angle 0
 *  lands on the +x ray (3 o'clock) and a quarter turn lands downward. */
export function geocentricTransform(
	angleRad: number,
	radius: number,
): { x: number; y: number } {
	const theta = angleRad + EARTH_PIN_ROTATION;
	return { x: radius * Math.cos(theta), y: radius * Math.sin(theta) };
}

/** Distance (SVG user units) the Moon rides off Earth's anchor. Small enough to
 *  read as a satellite of Earth, not a tenth orbit ring. */
const MOON_OFFSET = 32;

/** Degrees → radians. */
const DEG = Math.PI / 180;

/** Reduce an angle (radians) to [0, 2π). */
function normalizeAngle(radians: number): number {
	const twoPi = 2 * Math.PI;
	return ((radians % twoPi) + twoPi) % twoPi;
}

/** Julian centuries (TT, approx.) since J2000.0 for a date. The low-precision
 *  Meeus series are date-invariant for this dial's purposes, so the small ΔT and
 *  UTC/TT distinction are ignored. */
function julianCenturies(date: Date): number {
	const julianDay = date.getTime() / 86_400_000 + 2_440_587.5;
	return (julianDay - 2_451_545.0) / 36_525;
}

/** A planet's mean orbital elements (J2000) with linear rates per Julian century.
 *  L0 = mean longitude (deg), Ldot = its rate; M0 = mean anomaly (deg), Mdot =
 *  its rate; e = eccentricity. */
interface OrbitalElements {
	L0: number;
	Ldot: number;
	M0: number;
	Mdot: number;
	e: number;
}

/** Mean orbital elements per planet (J2000). The eight planets (sun and moon are
 *  special-cased: the Sun is the centre, the Moon rides Earth). Standard
 *  low-precision values (Meeus / JPL) — sufficient for degree-level geocentric
 *  direction, which is all this dial needs. */
const ORBITAL_ELEMENTS: Readonly<
	Record<Exclude<BodyName, "sun" | "moon">, OrbitalElements>
> = {
	mercury: {
		L0: 252.25,
		Ldot: 149_472.674,
		M0: 174.79,
		Mdot: 149_472.515,
		e: 0.2056,
	},
	venus: {
		L0: 181.98,
		Ldot: 58_517.815,
		M0: 50.42,
		Mdot: 58_517.804,
		e: 0.0068,
	},
	earth: {
		L0: 100.46,
		Ldot: 35_999.373,
		M0: 357.53,
		Mdot: 35_999.05,
		e: 0.0167,
	},
	mars: {
		L0: 355.43,
		Ldot: 19_140.299,
		M0: 19.39,
		Mdot: 19_139.857,
		e: 0.0934,
	},
	jupiter: { L0: 34.35, Ldot: 3_034.906, M0: 20.02, Mdot: 3_034.69, e: 0.0484 },
	saturn: { L0: 50.08, Ldot: 1_222.114, M0: 317.02, Mdot: 1_221.51, e: 0.0542 },
	uranus: { L0: 314.06, Ldot: 428.495, M0: 141.05, Mdot: 428.38, e: 0.0472 },
	neptune: { L0: 304.35, Ldot: 218.486, M0: 256.23, Mdot: 218.46, e: 0.0086 },
};

/** The eight planet names that carry orbital elements (excludes sun and moon). */
type PlanetName = keyof typeof ORBITAL_ELEMENTS;

/** True when a body has heliocentric orbital elements (i.e. is one of the eight
 *  planets), narrowing it away from the sun/moon special cases. */
function hasOrbitalElements(body: BodyName): body is PlanetName {
	return body in ORBITAL_ELEMENTS;
}

/** Heliocentric ecliptic position (AU) of a planet, projected onto the dial plane.
 *  Uses the first-order equation of centre (true ≈ mean + 2e·sin M) and ignores
 *  orbital inclination — degree-level direction is all the dial needs. */
function heliocentric(
	body: PlanetName,
	centuries: number,
): { x: number; y: number } {
	const el = ORBITAL_ELEMENTS[body];
	const meanLongitude = (el.L0 + el.Ldot * centuries) * DEG;
	const meanAnomaly = (el.M0 + el.Mdot * centuries) * DEG;
	const trueLongitude = meanLongitude + 2 * el.e * Math.sin(meanAnomaly);
	const a = SEMI_MAJOR_AXIS_AU[body];
	return { x: a * Math.cos(trueLongitude), y: a * Math.sin(trueLongitude) };
}

/** Per-date body positions for the whole dial. Sun at radius 0; Moon offset from
 *  Earth. Each planet sits at its fixed log-radius (date-invariant) in its
 *  geocentric ecliptic direction; Earth is pinned on the +x ray for every date —
 *  the thesis encoded in data. */
export function geocentricPositions(date: Date): BodyPosition[] {
	const centuries = julianCenturies(date);
	const earthHelio = heliocentric("earth", centuries);

	const positions: BodyPosition[] = [];

	// The Sun is the dial centre: geocentric direction is opposite Earth's
	// heliocentric direction, but radius 0 places it at the origin regardless.
	const sunAngle = normalizeAngle(Math.atan2(-earthHelio.y, -earthHelio.x));
	positions.push({ body: "sun", x: 0, y: 0, angle: sunAngle, radius: 0 });

	// Earth is held on the +x ray (angle 0 → 3 o'clock) for EVERY date.
	const earthRadius = logRadius(SEMI_MAJOR_AXIS_AU.earth);
	const earthAnchor = geocentricTransform(0, earthRadius);
	positions.push({
		body: "earth",
		x: earthAnchor.x,
		y: earthAnchor.y,
		angle: 0,
		radius: earthRadius,
	});

	for (const body of PLANET_ORDER) {
		if (body === "earth" || !hasOrbitalElements(body)) {
			continue;
		}
		const helio = heliocentric(body, centuries);
		const angle = normalizeAngle(
			Math.atan2(helio.y - earthHelio.y, helio.x - earthHelio.x),
		);
		const radius = logRadius(SEMI_MAJOR_AXIS_AU[body]);
		const { x, y } = geocentricTransform(angle, radius);
		positions.push({ body, x, y, angle, radius });
	}

	// The Moon rides Earth's anchor: a small satellite offset in its own
	// date-driven direction (the lunar mean longitude), so it reads as orbiting
	// Earth — distinct from Earth's anchor and from the dial centre, and visibly
	// moving across dates.
	const moonAngle = normalizeAngle((218.32 + 481_267.881 * centuries) * DEG);
	positions.push({
		body: "moon",
		x: earthAnchor.x + MOON_OFFSET * Math.cos(moonAngle),
		y: earthAnchor.y + MOON_OFFSET * Math.sin(moonAngle),
		angle: moonAngle,
		radius: MOON_OFFSET,
	});

	return positions;
}
