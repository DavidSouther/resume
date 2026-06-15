// Astrolabe token surface — the TS side of the shared color & material contracts.
//
// F1 OWNS the declaration of these names (project-plan Contracts 3 & 4). F2's
// astro-math.ts aligns its body set to `BodyName` here rather than redeclaring it.
//
// The matching CSS custom properties (--color-<body>, the five --case/--strap/
// --dial/--lacquer tokens) are declared once in src/global.css @layer theme.

/** The bodies rendered on the dial. F1 declares the name set; F2's astro-math.ts aligns to it. */
export type BodyName =
	| "sun"
	| "mercury"
	| "venus"
	| "earth"
	| "moon"
	| "mars"
	| "jupiter"
	| "saturn"
	| "uranus"
	| "neptune";

/** The CSS custom-property name for a body's color, e.g. bodyColorVar("mars") === "--color-mars". */
export function bodyColorVar(body: BodyName): `--color-${BodyName}` {
	return `--color-${body}`;
}

/** Finish/material token names (Contract 4), one source shared by the material section and global.css. */
export const MATERIAL_TOKENS = {
	casePlatinum: "--case-platinum",
	strapCordovan: "--strap-cordovan",
	strapStitch: "--strap-stitch",
	dialMidnight: "--dial-midnight",
	lacquerDepth: "--lacquer-depth",
} as const;
