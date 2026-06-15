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

export interface Config {
	speed: number;
	sizeMode: SizeMode;
	earthFixed: boolean;
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
