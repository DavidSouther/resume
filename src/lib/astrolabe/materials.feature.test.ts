import { describe, expect, test } from "vitest";
// Seam does not exist yet — the materials feature adds it. Keeps this red.
import { MATERIALS, type MaterialId, materialVars } from "./materials.ts";

/**
 * Feature spec for case materials.
 *
 * A single case-material choice (Gold / Rose Gold / Platinum) paints a
 * coordinated palette across the case metal, background, guilloche accent, and
 * every planet. The per-element color pickers stay as an override, seeded from
 * the chosen material's variable map.
 */
const REQUIRED_VARS = [
	"--ground",
	"--zband",
	"--orbit",
	"--label",
	"--hand",
	"--sun",
	"--mercury",
	"--venus",
	"--earth",
	"--mars",
	"--jupiter",
	"--saturn",
	"--uranus",
	"--neptune",
	"--moon",
	"--guilloche",
	"--case",
];

const HEX = /^#[0-9a-fA-F]{6}$/;

describe("astrolabe case materials", () => {
	test("there are three materials in catalog order", () => {
		expect(MATERIALS.map((m) => m.id)).toEqual([
			"gold",
			"rosegold",
			"platinum",
		]);
		expect(MATERIALS.map((m) => m.name)).toEqual([
			"Gold",
			"Rose Gold",
			"Platinum",
		]);
	});

	test("every material exposes the identical required variable set", () => {
		for (const m of MATERIALS) {
			expect(Object.keys(m.vars).sort()).toEqual([...REQUIRED_VARS].sort());
		}
	});

	test("platinum is a genuinely distinct palette from gold", () => {
		const gold = materialVars("gold");
		const plat = materialVars("platinum");
		for (const key of ["--ground", "--case", "--guilloche", "--sun"]) {
			expect(plat[key]).not.toBe(gold[key]);
		}
	});

	test("every variable value and swatch is a six-digit hex", () => {
		for (const m of MATERIALS) {
			expect(m.swatch).toMatch(HEX);
			for (const value of Object.values(m.vars)) {
				expect(value).toMatch(HEX);
			}
		}
	});

	test("materialVars throws on an unknown id", () => {
		expect(() => materialVars("brass" as MaterialId)).toThrow();
	});
});
