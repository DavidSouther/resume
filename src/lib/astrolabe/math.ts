import { EARTH, EARTH_YEAR } from "./bodies.ts";
import { type Body, type EarthMode, GALILEAN, type SizeMode } from "./types.ts";

const CX = 500;
const CY = 500;

// East origin, clockwise positive. Cursor angle in degrees from a center-relative
// vector. Scale-invariant: caller passes screen deltas directly.
export function dialAngle(dx: number, dy: number): number {
	return (Math.atan2(dy, dx) * 180) / Math.PI;
}

// Fold an angle to its shortest signed representative in (-180, 180].
export function wrap180(deg: number): number {
	const r = ((deg % 360) + 360) % 360; // [0, 360)
	return r > 180 ? r - 360 : r; // (-180, 180]
}

function rateOf(body: Body): number {
	return 360 / (body.period * EARTH_YEAR);
}

// Signed displayed angular rate of an orbiting body (and Earth), deg per
// sim-second. GALILEAN subtracts Earth's rate (synodic). Returns 0 for Earth in
// GALILEAN (Earth is then a case-rotation target, routed by the harness).
// KEPLERIAN and PTOLEMAIC leave the bare sidereal rate.
export function displayedRate(body: Body, mode: EarthMode): number {
	return rateOf(body) - (mode === GALILEAN ? rateOf(EARTH) : 0);
}

// simT delta for one winding frame: dThetaDeg / ratePerSec.
export function dragTimeStep(dThetaDeg: number, ratePerSec: number): number {
	return dThetaDeg / ratePerSec;
}

// Signed simplified-year band rate: 1deg = 1 day, band direction negative.
export const ZODIAC_DRAG_RATE = -1 / 86_400;

// Clock-hand rotation in degrees for a given wall-clock instant. The hands track
// the real system time, not the simulation, so the caller passes `new Date()`.
export function handAngles(date: Date): { hour: number; minute: number } {
	const minute = date.getMinutes() + date.getSeconds() / 60;
	return {
		hour: ((date.getHours() % 12) + minute / 60) * 30,
		minute: minute * 6,
	};
}

// CSS reference px for a physical millimeter (1in = 96px = 25.4mm). The browser
// maps CSS px to device px via devicePixelRatio, so a width set in these units
// renders at the reference physical size — the practical accuracy ceiling, since
// true per-display PPI is not exposed.
export function mmToPx(mm: number): number {
	return (mm * 96) / 25.4;
}

// The pixel width/height the dial's outer SVG should render at for a given case
// size and viewport. "full" keeps today's fill-the-viewport formula (with its
// 160px floor for tiny screens). mm modes render at true physical size, clamped
// *down* to the viewport budget so a large case never overflows, but with no
// floor — flooring would inflate the 42mm/38mm cases above their real size.
export function dialSizePx(mode: SizeMode, vw: number, vh: number): number {
	const budget = Math.min(vw, vh) - 28;
	if (mode === "full") return Math.max(160, budget);
	return Math.min(mmToPx(Number(mode)), budget);
}

// Whether the watch hands are hidden. Driven by the user's "Watch hands" toggle
// alone; simulation speed is not an input (fast sim no longer hides them).
export function handsHidden(handsOn: boolean): boolean {
	return !handsOn;
}

// The simT that makes the displayed instant `new Date(bootMs + simT * 1000)`
// equal the real wall clock. Assigned to simT to reset the simulation to "now".
export function simTimeForNow(bootMs: number, nowMs: number): number {
	return (nowMs - bootMs) / 1000;
}

// Rotation applied to the whole dial, degrees. GALILEAN adds `360 - aE` so Earth
// holds a fixed screen angle; KEPLERIAN and PTOLEMAIC leave the term at 0 (the
// zodiac is fixed). caseOffset is the user's case re-aim.
export function dialRotation(
	mode: EarthMode,
	aE: number,
	caseOffset: number,
): number {
	return (
		((((mode === GALILEAN ? 360 - aE : 0) + caseOffset) % 360) + 360) % 360
	);
}

// caseOffset for the mode being switched to (`nowMode`) that leaves dialRotation
// unchanged, so Earth keeps its current angle across a frame toggle. The
// GALILEAN term `360 - aE` is the only per-mode contribution; caseOffset absorbs
// the difference between the old and new mode's contributions.
export function caseOffsetPreservingRot(
	prevMode: EarthMode,
	nowMode: EarthMode,
	aE: number,
	caseOffset: number,
): number {
	const contribOld = prevMode === GALILEAN ? 360 - aE : 0;
	const contribNew = nowMode === GALILEAN ? 360 - aE : 0;
	return caseOffset + contribOld - contribNew;
}

export function helioA(b: Body, t: number): number {
	return (((b.start + (360 / (b.period * EARTH_YEAR)) * t) % 360) + 360) % 360;
}

export function pt(c: number, R: number): { x: number; y: number } {
	const th = (-90 + c) * (Math.PI / 180);
	return { x: CX + R * Math.cos(th), y: CY + R * Math.sin(th) };
}

export function dirToSign(
	fx: number,
	fy: number,
	tx: number,
	ty: number,
	rot: number,
): { si: number; deg: number } {
	const ang = (Math.atan2(ty - fy, tx - fx) * 180) / Math.PI;
	const clock = (((ang + 90 - (rot || 0)) % 360) + 360) % 360;
	return { si: Math.floor(clock / 30), deg: Math.floor(clock % 30) };
}

// Discrete animation speeds. `mul` is simulated seconds per real second; the
// slider is an integer index into this table.
export const SPEED_STEPS: readonly { mul: number; label: string }[] = [
	{ mul: 1, label: "real time" },
	{ mul: (30 * 86_400) / 60, label: "30 days / min" },
	{ mul: (120 * 86_400) / 60, label: "120 days / min" },
	{ mul: EARTH_YEAR / 60, label: "1 year / min" },
];

function clampStep(step: number): number {
	const i = Math.round(step);
	return i < 0 ? 0 : i >= SPEED_STEPS.length ? SPEED_STEPS.length - 1 : i;
}

export function speedToMul(step: number): number {
	return SPEED_STEPS[clampStep(step)].mul;
}

export function speedLabel(step: number): string {
	return SPEED_STEPS[clampStep(step)].label;
}
