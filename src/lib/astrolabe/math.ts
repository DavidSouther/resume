import { EARTH_YEAR, MAX_SPEED } from "./bodies.ts";
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

export function speedToMul(v: number): number {
	return Math.exp(v * Math.log(MAX_SPEED));
}

export function speedLabel(sp: number): string {
	if (sp < 1.5) return "real time";
	if (sp < 3600) return `${Math.round(sp)}×`;
	if (sp < 86400) return `${(sp / 3600).toFixed(1)} hr/s`;
	return `${(sp / 86400).toFixed(1)} day/s`;
}
