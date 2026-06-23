export type BodyName =
	| "mercury"
	| "venus"
	| "earth"
	| "mars"
	| "jupiter"
	| "saturn"
	| "uranus"
	| "neptune"
	| "moon";

export interface Body {
	key: BodyName;
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
export type EarthMode = 1 | 2 | 3;
export const PTOLEMAIC: EarthMode = 1;
export const GALILEAN: EarthMode = 2;
export const KEPLERIAN: EarthMode = 3;

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
