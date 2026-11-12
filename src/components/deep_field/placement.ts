// Redshift estimates and world placement. Behaviour is unchanged from the
// original single-file page.
import { COS } from "./cosmology.ts";
import { type Cls, D_NEAR, H0W, type Obj, P, S, view } from "./state.ts";

export function clsOf(o: Obj): Cls {
	const ov = S.over.get(o.id);
	return (ov?.cls ?? o.det) as Cls;
}

export function zMax(): number {
	let m = Math.max(P.zFar[1], P.zMid[1], P.zNear, 0.01);
	for (const v of S.over.values()) if (v.z != null) m = Math.max(m, v.z);
	for (const o of S.objs) if (o.zCat != null) m = Math.max(m, o.zCat);
	return m;
}

function depthFn(z: number): number {
	return P.mode === "comoving"
		? COS.dc(z)
		: P.mode === "lookback"
			? COS.lb(z)
			: P.mode === "log"
				? Math.log1p(z)
				: z;
}

export function uOf(z: number): number {
	const u = depthFn(Math.max(0, z)) / depthFn(zMax());
	return Math.min(1, Math.max(0, u)) ** P.gamma;
}

// Pyramid puts the apex at the nearest depth (d = 0), so field width is
// proportional to depth. Frustum starts at the image plane, Box ignores
// perspective.
export const dNear = () => (P.proj === "pyramid" ? 0 : D_NEAR);
export const kOfD = (d: number) => (P.proj === "box" ? 1 : d / D_NEAR);
export function dOfU(u: number): number {
	return dNear() + P.stretch * view.W0 * u;
}

export function estimate() {
	// rank-order distance proxy inside each class: smaller and redder means farther
	const by: Record<Cls, Obj[]> = { star: [], near: [], mid: [], far: [] };
	for (const o of S.objs) by[clsOf(o)].push(o);
	const rank = <T>(arr: T[], key: (o: T) => number) => {
		const s = arr
			.map((o, i) => [key(o), i] as [number, number])
			.sort((a, b) => a[0] - b[0]);
		const r = new Float64Array(arr.length);
		s.forEach(([, i], k) => {
			r[i] = arr.length > 1 ? k / (arr.length - 1) : 0.5;
		});
		return r;
	};
	for (const c of ["mid", "far"] as const) {
		const a = by[c];
		if (!a.length) continue;
		const rs = rank(a, (o) => -Math.sqrt(o.area));
		const rc = rank(a, (o) => o.color);
		const p = a.map((_o, i) => (1 - P.cue) * rs[i] + P.cue * rc[i]);
		const rp = rank(
			a.map((_o, i) => ({ p: p[i] })),
			(o) => o.p,
		);
		const [lo, hi] = c === "mid" ? P.zMid : P.zFar;
		a.forEach((o, i) => {
			o.zEst = lo + (hi - lo) * rp[i];
		});
	}
	for (const o of by.near) o.zEst = P.zNear;
	const rb = rank(by.star, (o) => -o.peak);
	by.star.forEach((o, i) => {
		o.zEst = 0;
		o.starRank = rb[i];
	});
	for (const o of S.objs) {
		const ov = S.over.get(o.id);
		o.z = ov && ov.z != null ? ov.z : (o.zCat ?? (o.zEst as number));
		o.cls = clsOf(o);
	}
	// fragments follow their group's redshift
	const lead = new Map<number, Obj>();
	for (const o of S.objs)
		if (o.cls === "near" && !o.fragment) lead.set(o.id, o);
	for (const o of S.objs) {
		if (o.cls === "near" && o.fragment && S.over.get(o.id)?.z == null) {
			const l = lead.get(o.group);
			if (l) o.z = l.z;
		}
	}
}

export function place(o: Obj): { d: number; k: number } {
	const { W0 } = view;
	let d: number;
	if (o.cls === "star")
		d =
			P.proj === "pyramid"
				? 0.02 *
					W0 *
					(0.3 + 0.7 * (1 - (o.starRank ?? 0.5))) *
					Math.min(1, P.stretch + 0.2) // a thin shell inside the pyramid tip
				: D_NEAR -
					0.06 *
						W0 *
						(0.3 + 0.7 * (1 - (o.starRank ?? 0.5))) *
						Math.min(1, P.stretch + 0.2);
	else d = dOfU(uOf(o.z));
	return { d, k: kOfD(d) };
}

export const toWorld = (
	px: number,
	py: number,
	d: number,
	k: number,
): [number, number, number] => [
	(px / S.W - 0.5) * view.W0 * k,
	-(py / S.H - 0.5) * H0W * k,
	-d,
];
