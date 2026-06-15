// The F1 contributed material ControlsSection (a #debug panel, Contract 2 caller).
//
// A comprehensive, well-organized #debug panel: case-finish and strap-finish
// controls that write MATERIAL_TOKENS via element.style.setProperty on
// document.documentElement, so the prebaked case/strap SVG (which references the
// tokens through var()) and the .astrolabe-* layer rules retint live.
//
// Astrolabe() (Step 5) registers this section through registerControlsSection.
// The controls are keyed off the MATERIAL_TOKENS name constants, so renaming a
// token in astro-tokens.ts breaks this import rather than silently the styling.
import {
	FormGroup,
	PropertySheet,
} from "@davidsouther/jiffies/components/index.ts";
import { input } from "@davidsouther/jiffies/dom/html.ts";
import { MATERIAL_TOKENS } from "../../lib/astro-tokens.ts";
import type { ControlsSection } from "./controls.ts";

/** A material token name (a value of MATERIAL_TOKENS, e.g. "--case-platinum"). */
type MaterialToken = (typeof MATERIAL_TOKENS)[keyof typeof MATERIAL_TOKENS];

/** Write a material token onto the document root so the whole watch retints. */
function applyToken(token: MaterialToken, value: string): void {
	document.documentElement.style.setProperty(token, value);
}

/** One row of the material panel: a human label and its bound color swatch. */
interface TokenControl {
	label: string;
	value: HTMLInputElement;
}

/**
 * A human-labeled color swatch bound to one material token. Changing the swatch
 * writes the token live. The `data-token` hook names the CSS custom-property it
 * drives, so the panel is addressable by token name in tests and future tooling.
 */
function tokenControl(
	token: MaterialToken,
	label: string,
	swatch: string,
): TokenControl {
	const control = input({
		type: "color",
		value: swatch,
		events: {
			input(event) {
				const target = event.target as HTMLInputElement;
				applyToken(token, target.value);
			},
		},
	});
	// jiffies factories reject arbitrary data-* attrs at the type level (and drop
	// empty values), so set the addressable token hook post-construction.
	control.setAttribute("data-token", token);
	return { label, value: control };
}

/** Group a set of token controls under a legend as a labeled property sheet. */
function finishGroup(
	legend: string,
	controls: TokenControl[],
): HTMLFieldSetElement {
	return FormGroup(
		{ legend },
		PropertySheet({
			entries: controls.map(({ label, value }) => ({ label, value })),
		}),
	);
}

/** The F1 contributed material ControlsSection (debugOnly: true). */
export const materialSection: ControlsSection = {
	id: "material",
	title: "Case & Strap",
	debugOnly: true,
	render(): Node[] {
		// Provisional swatches mirror the global.css @layer theme defaults; they
		// only seed the color inputs — the live token is whatever the user picks.
		const caseGroup = finishGroup("Case", [
			tokenControl(MATERIAL_TOKENS.casePlatinum, "Platinum", "#e7e9ee"),
			tokenControl(MATERIAL_TOKENS.dialMidnight, "Dial midnight", "#0b1020"),
			tokenControl(MATERIAL_TOKENS.lacquerDepth, "Lacquer depth", "#05070f"),
		]);
		const strapGroup = finishGroup("Strap", [
			tokenControl(MATERIAL_TOKENS.strapCordovan, "Cordovan", "#5a2a22"),
			tokenControl(MATERIAL_TOKENS.strapStitch, "Tonal stitch", "#caa46a"),
		]);
		return [caseGroup, strapGroup];
	},
};
