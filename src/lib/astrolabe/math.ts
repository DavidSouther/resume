import { EARTH_YEAR } from "./bodies.ts";
import type { Body } from "./types.ts";

const CX = 500;
const CY = 500;

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
	{ mul: 5, label: "5×" },
	{ mul: 86_400 / 60, label: "1 day / min" },
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
