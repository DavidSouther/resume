import { assertExists } from "@davidsouther/jiffies/assert.ts";
import type { Body, BodyName } from "./types.ts";

export const EARTH_YEAR = 31_557_600; // seconds per Earth orbit

export const BODIES: Map<BodyName, Body> = new Map<BodyName, Body>([
	[
		"neptune",
		{
			key: "neptune",
			name: "NEPTUNE",
			r: 405,
			dot: 7,
			au: 30.07,
			period: 164.8,
			start: 272.36,
			weight: 0.15,
		},
	],
	[
		"uranus",
		{
			key: "uranus",
			name: "URANUS",
			r: 373.7,
			dot: 7,
			au: 19.19,
			period: 84.02,
			start: 331.77,
			weight: 0.22,
		},
	],
	[
		"saturn",
		{
			key: "saturn",
			name: "SATURN",
			r: 325,
			dot: 8,
			au: 9.54,
			period: 29.457,
			start: 277.44,
			weight: 0.3,
			ring: true,
		},
	],
	[
		"jupiter",
		{
			key: "jupiter",
			name: "JUPITER",
			r: 283,
			dot: 9,
			au: 5.2,
			period: 11.862,
			start: 32.71,
			weight: 0.4,
		},
	],
	[
		"mars",
		{
			key: "mars",
			name: "MARS",
			r: 197.5,
			dot: 5,
			au: 1.52,
			period: 1.8808,
			start: 295.74,
			weight: 0.55,
		},
	],
	[
		"earth",
		{
			key: "earth",
			name: "EARTH",
			r: 168.4,
			dot: 18,
			au: 1.0,
			period: 1.0,
			start: 172.51,
			weight: 0.68,
		},
	],
	[
		"venus",
		{
			key: "venus",
			name: "VENUS",
			r: 145.5,
			dot: 6,
			au: 0.72,
			period: 0.6152,
			start: 89.53,
			weight: 0.8,
		},
	],
	[
		"mercury",
		{
			key: "mercury",
			name: "MERCURY",
			r: 102.9,
			dot: 5,
			au: 0.39,
			period: 0.2408,
			start: 115.34,
			weight: 0.92,
		},
	],
	[
		"moon",
		{
			key: "moon",
			name: "MOON",
			r: 30,
			dot: 4,
			period: 0.0748,
			start: 329.31,
			weight: 1.0,
			moon: true,
		},
	],
]);

export const EARTH = assertExists(
	BODIES.get("earth"),
	"earth missing from BODIES",
);
export const SATURN = assertExists(
	BODIES.get("saturn"),
	"saturn missing from BODIES",
);

// 1 Saturn orbit in 10 minutes
export const MAX_SPEED = (SATURN.period * EARTH_YEAR) / 600;

export const SIGNS = [
	"ARI",
	"TAU",
	"GEM",
	"CAN",
	"LEO",
	"VIR",
	"LIB",
	"SCO",
	"SAG",
	"CAP",
	"AQR",
	"PIS",
];
export const SIGN_FULL = [
	"Aries",
	"Taurus",
	"Gemini",
	"Cancer",
	"Leo",
	"Virgo",
	"Libra",
	"Scorpio",
	"Sagittarius",
	"Capricorn",
	"Aquarius",
	"Pisces",
];

export const ABBR: Record<string, string> = {
	sun: "SUN",
	mercury: "MER",
	venus: "VEN",
	earth: "EAR",
	mars: "MAR",
	jupiter: "JUP",
	saturn: "SAT",
	uranus: "URA",
	neptune: "NEP",
	moon: "MOO",
};

export const FULLNAME: Record<string, string> = {
	sun: "Sun",
	mercury: "Mercury",
	venus: "Venus",
	earth: "Earth",
	mars: "Mars",
	jupiter: "Jupiter",
	saturn: "Saturn",
	uranus: "Uranus",
	neptune: "Neptune",
	moon: "Moon",
};

// Zodiac glyphs (Tabler Icons, MIT) — 24x24 stroke paths, Aries..Pisces
export const GLYPHS: string[][] = [
	["M12 5a5 5 0 1 0 -4 8", "M16 13a5 5 0 1 0 -4 -8", "M12 21l0 -16"],
	["M6 3a6 6 0 0 0 12 0", "M6 15a6 6 0 1 0 12 0a6 6 0 1 0 -12 0"],
	[
		"M3 3a21 21 0 0 0 18 0",
		"M3 21a21 21 0 0 1 18 0",
		"M7 4.5l0 15",
		"M17 4.5l0 15",
	],
	[
		"M3 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0",
		"M15 12a3 3 0 1 0 6 0a3 3 0 1 0 -6 0",
		"M3 12a10 6.5 0 0 1 14 -6.5",
		"M21 12a10 6.5 0 0 1 -14 6.5",
	],
	[
		"M13 17a4 4 0 1 0 8 0",
		"M3 16a3 3 0 1 0 6 0a3 3 0 1 0 -6 0",
		"M7 7a4 4 0 1 0 8 0a4 4 0 1 0 -8 0",
		"M7 7c0 3 2 5 2 9",
		"M15 7c0 4 -2 6 -2 10",
	],
	[
		"M3 4a2 2 0 0 1 2 2v9",
		"M5 6a2 2 0 0 1 4 0v9",
		"M9 6a2 2 0 0 1 4 0v10a7 5 0 0 0 7 5",
		"M12 21a7 5 0 0 0 7 -5v-2a3 3 0 0 0 -6 0",
	],
	["M5 20l14 0", "M5 17h5v-.3a7 7 0 1 1 4 0v.3h5"],
	[
		"M3 4a2 2 0 0 1 2 2v9",
		"M5 6a2 2 0 0 1 4 0v9",
		"M9 6a2 2 0 0 1 4 0v10a3 3 0 0 0 3 3h5l-3 -3m0 6l3 -3",
	],
	["M4 20l16 -16", "M13 4h7v7", "M6.5 12.5l5 5"],
	[
		"M4 4a3 3 0 0 1 3 3v9",
		"M7 7a3 3 0 0 1 6 0v11a3 3 0 0 1 -3 3",
		"M13 17a3 3 0 1 0 6 0a3 3 0 1 0 -6 0",
	],
	["M3 10l3 -3l3 3l3 -3l3 3l3 -3l3 3", "M3 17l3 -3l3 3l3 -3l3 3l3 -3l3 3"],
	["M5 3a21 21 0 0 1 0 18", "M19 3a21 21 0 0 0 0 18", "M5 12l14 0"],
];
