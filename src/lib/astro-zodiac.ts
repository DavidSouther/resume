// Pure tropical-zodiac sign math (CONSUMES Contract 1: BodyPosition.angle, BodyName).
//
// No DOM. The twelve tropical signs each own a 30° arc of the ecliptic, anchored
// to the +x ray (angle 0 = 3 o'clock = Aries' start), increasing with angle —
// consistent with astro-math.ts's geocentricTransform convention. The zodiac band
// (zodiac.ts) and the motion engine (motion.ts) read occupancy from this module.
import type { BodyName, BodyPosition } from "./astro-math.ts";

/** A tropical zodiac sign's stable id, Aries→Pisces. */
export type ZodiacSignId =
	| "aries"
	| "taurus"
	| "gemini"
	| "cancer"
	| "leo"
	| "virgo"
	| "libra"
	| "scorpio"
	| "sagittarius"
	| "capricorn"
	| "aquarius"
	| "pisces";

/** One tropical sign: id, human label, and the start of its 30° ecliptic arc (radians, [0, 2π)). */
export interface ZodiacSign {
	id: ZodiacSignId;
	label: string;
	/** Start of the sign's 30° arc, radians from the +x ray, increasing with angle. */
	startAngle: number;
}

/** The width of one sign's arc: 30° in radians. */
const SIGN_ARC = Math.PI / 6;

/** Full turn in radians, for normalizing an angle into [0, 2π). */
const TWO_PI = 2 * Math.PI;

/** The twelve sign ids in order Aries→Pisces, the source for ZODIAC_SIGNS. */
const SIGN_IDS: readonly ZodiacSignId[] = [
	"aries",
	"taurus",
	"gemini",
	"cancer",
	"leo",
	"virgo",
	"libra",
	"scorpio",
	"sagittarius",
	"capricorn",
	"aquarius",
	"pisces",
];

/** ZodiacSignId → human label (capitalized id). */
function labelFor(id: ZodiacSignId): string {
	return id.charAt(0).toUpperCase() + id.slice(1);
}

/** The twelve signs in order Aries→Pisces, each anchored to its 30° arc start. */
export const ZODIAC_SIGNS: readonly ZodiacSign[] = SIGN_IDS.map((id, i) => ({
	id,
	label: labelFor(id),
	startAngle: i * SIGN_ARC,
}));

/** Reduce an angle (radians) to [0, 2π). */
function normalizeAngle(angleRad: number): number {
	return ((angleRad % TWO_PI) + TWO_PI) % TWO_PI;
}

/** Floating-point slack, in arc units, for snapping an angle that should sit
 *  exactly on a 30° boundary back onto it. normalizeAngle's modulo arithmetic
 *  perturbs exact multiples of SIGN_ARC by at most ~2 ULPs (~1.8e-15 arc units),
 *  so without this a boundary value (e.g. 7·π/6) would floor into the lower sign.
 *  Chosen well above that perturbation yet far below the smallest legitimate
 *  off-boundary angle (a near-2π value sits ~1.9e-12 arc units from the wrap),
 *  so a genuine just-below-2π angle is NOT snapped up. */
const BOUNDARY_SNAP_TOLERANCE = 1e-13;

/** The sign whose 30° arc contains a geocentric ecliptic direction (radians).
 *  An angle exactly on a boundary belongs to the arc it opens (the higher sign). */
export function signOf(angleRad: number): ZodiacSignId {
	const arcs = normalizeAngle(angleRad) / SIGN_ARC;
	// Snap onto an exact boundary only when within float tolerance of one, so a
	// value perturbed off an exact multiple by normalizeAngle floors correctly.
	const nearest = Math.round(arcs);
	const snapped =
		Math.abs(arcs - nearest) < BOUNDARY_SNAP_TOLERANCE ? nearest : arcs;
	// Modulo guards the 12→0 wrap when an angle snaps up to the full turn.
	const index =
		((Math.floor(snapped) % SIGN_IDS.length) + SIGN_IDS.length) %
		SIGN_IDS.length;
	return SIGN_IDS[index];
}

/**
 * Occupants per sign from a set of body positions, keyed by ZodiacSignId.
 * The Moon is NEVER an occupant (excluded). The Sun and planets are placed by
 * BodyPosition.angle. Signs with no occupant are absent (their lookup yields
 * undefined, which callers read as []).
 */
export function occupantsBySign(
	positions: BodyPosition[],
): Map<ZodiacSignId, BodyName[]> {
	const occupants = new Map<ZodiacSignId, BodyName[]>();
	for (const position of positions) {
		if (position.body === "moon") {
			continue;
		}
		const sign = signOf(position.angle);
		const list = occupants.get(sign);
		if (list) {
			list.push(position.body);
		} else {
			occupants.set(sign, [position.body]);
		}
	}
	return occupants;
}
