import type { Body } from "./types.ts";

export function helioA(b: Body, t: number): number {
	throw new Error("not implemented");
}

export function pt(c: number, R: number): { x: number; y: number } {
	throw new Error("not implemented");
}

export function dirToSign(
	fx: number,
	fy: number,
	tx: number,
	ty: number,
	rot: number,
): { si: number; deg: number } {
	throw new Error("not implemented");
}

export function speedToMul(v: number): number {
	throw new Error("not implemented");
}

export function speedLabel(sp: number): string {
	throw new Error("not implemented");
}
