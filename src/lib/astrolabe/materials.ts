import { assertExists } from "@davidsouther/jiffies/assert.ts";

export type MaterialId = "gold" | "rosegold" | "platinum";

export interface Material {
	id: MaterialId;
	/** Human-facing label for the swatch button. */
	name: string;
	/** Representative metal hex for the button's swatch graphic. */
	swatch: string;
	/** :root CSS-variable overrides this material applies, as a complete map. */
	vars: Record<string, string>;
}

// Every material carries the identical key set: the full color-picker set plus
// the two material-specific accents (--guilloche, the engine-turning metal, and
// --case, the bezel/lug/strap-hardware metal). Picking a material seeds the
// pickers from this map, so the values must be concrete six-digit hex.
export const MATERIALS: Material[] = [
	{
		id: "gold",
		name: "Gold",
		swatch: "#D9A441",
		vars: {
			"--ground": "#0B0805",
			"--zband": "#171008",
			"--orbit": "#3A2E16",
			"--label": "#C8A86A",
			"--hand": "#F2D8A0",
			"--sun": "#E7B23E",
			"--mercury": "#B9A57E",
			"--venus": "#E0C57A",
			"--earth": "#C9A24A",
			"--mars": "#C97A38",
			"--jupiter": "#D9B36A",
			"--saturn": "#D7C386",
			"--uranus": "#B9AE72",
			"--neptune": "#A88C46",
			"--moon": "#E6D9B8",
			"--guilloche": "#C9A24A",
			"--case": "#D9A441",
		},
	},
	{
		id: "rosegold",
		name: "Rose Gold",
		swatch: "#D98E73",
		vars: {
			"--ground": "#0C0707",
			"--zband": "#1A1010",
			"--orbit": "#3C2820",
			"--label": "#C99A8A",
			"--hand": "#F2C9B6",
			"--sun": "#E59A6F",
			"--mercury": "#C09A8E",
			"--venus": "#E3B49A",
			"--earth": "#C98A78",
			"--mars": "#C96A4E",
			"--jupiter": "#D9A088",
			"--saturn": "#D9B2A0",
			"--uranus": "#BFA096",
			"--neptune": "#A8746A",
			"--moon": "#EAD2C6",
			"--guilloche": "#C98A78",
			"--case": "#D98E73",
		},
	},
	{
		id: "platinum",
		name: "Platinum",
		swatch: "#C7CBD2",
		vars: {
			"--ground": "#080B12",
			"--zband": "#0E1422",
			"--orbit": "#1A2340",
			"--label": "#8898BB",
			"--hand": "#EDE6CF",
			"--sun": "#D4A843",
			"--mercury": "#9A9AAE",
			"--venus": "#C8B87A",
			"--earth": "#4A7FC1",
			"--mars": "#C46A3A",
			"--jupiter": "#BFA06A",
			"--saturn": "#C8BE9A",
			"--uranus": "#6AACB8",
			"--neptune": "#4A5CAA",
			"--moon": "#D0D4DC",
			"--guilloche": "#AEB6C2",
			"--case": "#C7CBD2",
		},
	},
];

export function materialVars(id: MaterialId): Record<string, string> {
	const material = assertExists(
		MATERIALS.find((m) => m.id === id),
		`unknown material: ${id}`,
	);
	return { ...material.vars };
}
