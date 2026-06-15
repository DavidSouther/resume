import { describe, expect, it } from "vitest";
import {
	type BodyName,
	bodyColorVar,
	MATERIAL_TOKENS,
} from "./astro-tokens.ts";

// The ten bodies the dial renders (Contract 3). Listed independently of the
// production union so a drift between the literal name set and `bodyColorVar`'s
// output is caught here rather than at the CSS layer.
const BODIES: readonly BodyName[] = [
	"sun",
	"mercury",
	"venus",
	"earth",
	"moon",
	"mars",
	"jupiter",
	"saturn",
	"uranus",
	"neptune",
];

describe("bodyColorVar", () => {
	it("maps a body to its --color- custom-property name", () => {
		expect(bodyColorVar("mars")).toBe("--color-mars");
		expect(bodyColorVar("sun")).toBe("--color-sun");
	});

	it("round-trips every BodyName to --color-<body>", () => {
		for (const body of BODIES) {
			expect(bodyColorVar(body)).toBe(`--color-${body}`);
		}
	});
});

describe("MATERIAL_TOKENS", () => {
	it("holds exactly the five Contract-4 finish/material token names", () => {
		// Guards a rename in the TS map from silently drifting away from the
		// names declared in global.css.
		expect(MATERIAL_TOKENS).toEqual({
			casePlatinum: "--case-platinum",
			strapCordovan: "--strap-cordovan",
			strapStitch: "--strap-stitch",
			dialMidnight: "--dial-midnight",
			lacquerDepth: "--lacquer-depth",
		});
	});
});
