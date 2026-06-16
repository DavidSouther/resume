export interface Body {
	key: string;
	name: string;
	r: number;
	dot: number;
	period: number;
	start: number;
	weight: number;
	au?: number;
	ring?: boolean;
	moon?: boolean;
}

export type SizeMode = "full" | "90" | "48" | "38";

// Earth frame, named after the astronomer of each model. PTOLEMAIC is the
// geocentric (Earth-centered) frame; GALILEAN carries the old
// `earthFixed === true` (Earth held at a fixed screen angle); KEPLERIAN carries
// `earthFixed === false` (Sun-centered, dial unrotated).
export const PTOLEMAIC = 1;
export const GALILEAN = 2;
export const KEPLERIAN = 3;
export type EarthMode = typeof PTOLEMAIC | typeof GALILEAN | typeof KEPLERIAN;

export interface Config {
	speed: number;
	sizeMode: SizeMode;
	earthMode: EarthMode;
	parallaxOn: boolean;
	parallax: number;
	occ: boolean;
	twilight: boolean;
	guilloche: boolean;
	guillocheN: number;
	hands: boolean;
}

export interface GeoPosition {
	lat: number;
	lon: number;
}
