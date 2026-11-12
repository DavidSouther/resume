// Shared page state: parameters (P), loaded-image state (S) and view geometry.
import type { Field } from "./catalog.ts";
export const CLASSES = ["star", "near", "mid", "far"] as const;
export type Cls = (typeof CLASSES)[number];
export const CLS_NAME: Record<Cls, string> = {
	star: "Stars",
	near: "Near galaxies",
	mid: "Mid galaxies",
	far: "Far galaxies",
};
export const CLS_ONE: Record<Cls, string> = {
	star: "Foreground star",
	near: "Near galaxy",
	mid: "Mid galaxy",
	far: "Far galaxy",
};

export type Proj = "pyramid" | "frustum" | "box";
export type DepthMode = "comoving" | "lookback" | "log" | "linear";

export interface DetectOptions {
	kSigma: number;
	nearFrac: number;
	nearBluer: number;
	farArea: number;
	spikeContrast: number;
	minCont: number;
}

/** One detected source, as returned by the detector plus page-side fields. */
export interface Obj {
	id: number;
	cls: Cls;
	det: Cls;
	group: number;
	fragment: boolean;
	cx: number;
	cy: number;
	x0: number;
	y0: number;
	x1: number;
	y1: number;
	area: number;
	flux: number;
	peak: number;
	color: number;
	major: number;
	minor: number;
	theta: number;
	spike: number;
	zEst?: number;
	/** Spectroscopic redshift from the catalog match, when there is one. */
	zCat?: number;
	z: number;
	starRank?: number;
	d: number;
	k: number;
	world: [number, number, number];
	sprite: {
		mesh: number;
		slot: number;
		px: number;
		py: number;
		w: number;
		h: number;
	};
}

export interface Detection {
	objects: Omit<Obj, "det" | "z" | "d" | "k" | "world" | "sprite">[];
	labels: Int32Array;
	bg: Float32Array;
	fieldColor: number;
	spikeAngles: number[];
}

export interface Params {
	mode: DepthMode;
	stretch: number;
	gamma: number;
	proj: Proj;
	zNear: number;
	zMid: [number, number];
	zFar: [number, number];
	cue: number;
	bright: number;
	scale: number;
	sky: number;
	shells: boolean;
	markers: boolean;
	labels: boolean;
	show: Record<Cls, boolean>;
	det: DetectOptions;
}

export const P: Params = {
	mode: "comoving",
	stretch: 2.5,
	gamma: 1,
	proj: "frustum",
	// Offline checks against spectroscopic redshifts: SMACS 0723 (Noirot et al.
	// 2022, ESA/Webb weic2209a, 152 matches) and CEERS in the Extended Groth
	// Strip (DAWN JWST Archive v4.4 grade 3, ESA/Webb CEERS11, 186 matches).
	// Rank correlation is about +0.54 and +0.56, with 30% of source pairs
	// ordered wrongly. Colour wins in SMACS and size wins in CEERS, so cue 0.75
	// is a blend that held on both. The mid range [0.4, 2.0] cuts median |dz|
	// from 0.64 to 0.32 (SMACS, cluster excluded) and from 1.41 to 0.97 (CEERS).
	// Far has few matches in SMACS (5), so it keeps its upper bound.
	zNear: 0.0856,
	zMid: [0.4, 2.0],
	zFar: [2.0, 6.0],
	cue: 0.75,
	bright: 1.15,
	scale: 1,
	sky: 0.3,
	shells: true,
	markers: false,
	labels: true,
	show: { star: true, near: true, mid: true, far: true },
	det: {
		kSigma: 5,
		nearFrac: 0.0022,
		nearBluer: 0.35,
		farArea: 40,
		spikeContrast: 2.5,
		minCont: 0.005,
	},
};

export interface Override {
	cls?: Cls;
	z?: number | null;
}

export const S = {
	W: 0,
	H: 0,
	rgba: null as Uint8ClampedArray | null,
	det: null as Detection | null,
	objs: [] as Obj[],
	over: new Map<number, Override>(),
	sel: null as Obj | null,
	field: null as Field | null,
	notes: [] as { group: number; name: string }[],
};

// D_NEAR is the angular reference only: the field is W0 wide at d = D_NEAR.
// The nearest depth is d = 0, the apex.
export const D_NEAR = 1;
export const FOV0 = 45;
export const H0W = 2 * D_NEAR * Math.tan((FOV0 / 2) * (Math.PI / 180));
export const view = {
	/** Image width at the image plane. */
	W0: H0W,
	/** z of the orbit pivot the controls were last aimed at; see syncPivot. */
	pivotZ: null as number | null,
};

export const hooks = {
	/** Panel refresh after the scene updates; set by panel.ts. */
	afterUpdate: () => {},
	/** Camera reset after a new detection is built; set by camera.ts. */
	afterBuild: () => {},
};

export const $ = <T extends HTMLElement = HTMLElement>(id: string): T =>
	document.getElementById(id) as T;
export const css = (v: string): string =>
	getComputedStyle(document.documentElement).getPropertyValue(v).trim();

export const COLORS = {} as Record<Cls, string>;
export function initColors() {
	for (const c of CLASSES) COLORS[c] = css(`--df-${c}`);
}

export const fmtZ = (z: number) =>
	z < 0.1 ? z.toFixed(3) : z < 1 ? z.toFixed(2) : z.toFixed(1);
