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

export interface Config {
	speed: number;
	earthFixed: boolean;
	parallaxOn: boolean;
	parallax: number;
	glow: boolean;
	occ: boolean;
	twilight: boolean;
	conj: boolean;
	conjDeg: number;
	conjCurved: boolean;
	guilloche: boolean;
	guillocheN: number;
	hands: boolean;
	bgMode: "flat" | "textured" | "sparkle";
}

export interface GeoPosition {
	lat: number;
	lon: number;
}
