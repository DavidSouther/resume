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
