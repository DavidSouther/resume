// Match detected sources to spectroscopic catalog redshifts through the
// image's WCS.
import { arcsecPerPixel, skyToUnit, type Wcs } from "./wcs.ts";

/** A catalog source: [ra, dec, redshift]. */
export type CatalogSource = [number, number, number];

export interface Field {
	id: string;
	source: string;
	title: string;
	credit: string;
	referenceUrl: string;
	url: string;
	size: [number, number];
	wcs: Wcs;
	/** Source count per catalog name. */
	catalogs: Record<string, number>;
	sources: CatalogSource[];
}

export interface RedshiftCounts {
	catalog: number;
	estimated: number;
	/** Redshifts the user typed over the inspector. */
	manual: number;
}

/**
 * How the redshifts of non-star sources were obtained. Fragments follow their
 * group's leader, so they are not counted on their own.
 */
export function countRedshiftSources(
	objs: { id: number; cls: string; fragment: boolean; zCat?: number }[],
	over: Map<number, { z?: number | null }>,
): RedshiftCounts {
	const n: RedshiftCounts = { catalog: 0, estimated: 0, manual: 0 };
	for (const o of objs) {
		if (o.cls === "star" || o.fragment) continue;
		if (over.get(o.id)?.z != null) n.manual++;
		else if (o.zCat != null) n.catalog++;
		else n.estimated++;
	}
	return n;
}

/** A catalog position within this many arcseconds of a centroid may match. */
export const MATCH_ARCSEC = 0.3;
/** Centroid and WCS error floor, in loaded-image pixels. */
export const MATCH_MIN_PX = 2;

export interface Match {
	z: number;
	/** Separation in loaded-image pixels. */
	sep: number;
}

/**
 * Greedy one-to-one nearest matching. Candidates are sorted by separation, so
 * the closest pairs claim their partners first. Detected objects without a
 * catalog partner within tolerance are absent from the result.
 */
export function matchCatalog(
	objs: { id: number; cx: number; cy: number }[],
	field: Pick<Field, "wcs" | "sources">,
	width: number,
	height: number,
): Map<number, Match> {
	const tol = Math.max(
		MATCH_MIN_PX,
		MATCH_ARCSEC / arcsecPerPixel(field.wcs, width),
	);
	const cells = new Map<string, number[]>();
	const cell = (x: number, y: number) =>
		`${Math.floor(x / tol)},${Math.floor(y / tol)}`;
	const pts = field.sources.map(([ra, dec]) => {
		const [ux, uy] = skyToUnit(field.wcs, ra, dec);
		return [ux * width, uy * height] as const;
	});
	pts.forEach(([x, y], i) => {
		const k = cell(x, y);
		const a = cells.get(k);
		if (a) a.push(i);
		else cells.set(k, [i]);
	});
	const pairs: { oi: number; ci: number; sep: number }[] = [];
	objs.forEach((o, oi) => {
		const gx = Math.floor(o.cx / tol);
		const gy = Math.floor(o.cy / tol);
		for (let dx = -1; dx <= 1; dx++)
			for (let dy = -1; dy <= 1; dy++)
				for (const ci of cells.get(`${gx + dx},${gy + dy}`) ?? []) {
					const sep = Math.hypot(o.cx - pts[ci][0], o.cy - pts[ci][1]);
					if (sep <= tol) pairs.push({ oi, ci, sep });
				}
	});
	pairs.sort((a, b) => a.sep - b.sep);
	const usedO = new Set<number>();
	const usedC = new Set<number>();
	const out = new Map<number, Match>();
	for (const p of pairs) {
		if (usedO.has(p.oi) || usedC.has(p.ci)) continue;
		usedO.add(p.oi);
		usedC.add(p.ci);
		out.set(objs[p.oi].id, { z: field.sources[p.ci][2], sep: p.sep });
	}
	return out;
}
