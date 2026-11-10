// Flat LCDM distances, integrated once with the trapezoid rule on a z grid.
export const H0 = 67.7;
export const OM = 0.31;
export const OL = 1 - OM;
/** Hubble distance in Gly. */
export const DH_GLY = (299792.458 / H0) * 3.26156e-3;
/** Hubble time in Gyr. */
export const TH_GYR = 977.8 / H0;

export interface Cosmology {
	/** Comoving distance in Gly. */
	dc(z: number): number;
	/** Light-travel (lookback) time in Gyr. */
	lb(z: number): number;
}

export function makeCosmology(): Cosmology {
	const dz = 0.002;
	const n = Math.round(20 / dz) + 1;
	const dc = new Float64Array(n);
	const lb = new Float64Array(n);
	const E = (z: number) => Math.sqrt(OM * (1 + z) ** 3 + OL);
	for (let i = 1; i < n; i++) {
		const z0 = (i - 1) * dz;
		const z1 = i * dz;
		dc[i] = dc[i - 1] + 0.5 * dz * (1 / E(z0) + 1 / E(z1));
		lb[i] =
			lb[i - 1] + 0.5 * dz * (1 / ((1 + z0) * E(z0)) + 1 / ((1 + z1) * E(z1)));
	}
	const at = (t: Float64Array, z: number) => {
		const f = Math.min(n - 1.001, Math.max(0, z / dz));
		const i = Math.floor(f);
		return t[i] + (t[i + 1] - t[i]) * (f - i);
	};
	return {
		dc: (z) => at(dc, z) * DH_GLY,
		lb: (z) => at(lb, z) * TH_GYR,
	};
}

export const COS = makeCosmology();
