// The #debug guilloché ControlsSection (CONSUMES Contract 4, registers via Contract 2).
//
// Density / pitch / relief / glint / lacquer sliders plus a flat-finish toggle,
// driving the Step-4 live guilloché relief filter in dial.ts. Each slider's
// `input` event addresses the filter's feTurbulence / feDisplacementMap by id +
// data-param and setAttribute — the SVG analogue of material-section.ts's
// data-token + setProperty idiom — so a refined parameter retints the finish live
// with no rebuild. The flat-finish toggle clears the finish's filter reference so
// the prebaked <image> reads flat.
//
// Astrolabe() registers this through registerControlsSection alongside the F1
// materialSection (idempotent on id). The slider→param mapping is keyed off the
// GUILLOCHE_FILTER_ID export and the filter children's data-param hooks, so
// renaming either in dial.ts breaks this wiring at the call site rather than
// silently leaving a dead slider.
import {
	FormGroup,
	PropertySheet,
} from "@davidsouther/jiffies/components/index.ts";
import { input } from "@davidsouther/jiffies/dom/html.ts";
import { MATERIAL_TOKENS } from "../../lib/astro-tokens.ts";
import type { ControlsSection } from "./controls.ts";
import { GUILLOCHE_FILTER_ID } from "./dial.ts";

/** A guilloché slider's parameter hook — also the value of its `data-param` attribute. */
type GuillocheParam = "density" | "pitch" | "relief" | "glint" | "lacquer";

/** The relief filter element in the live dial, if mounted (#debug only). */
function reliefFilter(): Element | null {
	return document.getElementById(GUILLOCHE_FILTER_ID);
}

/** The feTurbulence node carrying the density/pitch/glint params, if mounted. */
function turbulenceNode(): Element | null {
	return reliefFilter()?.querySelector('[data-param="density"]') ?? null;
}

/** The feDisplacementMap node carrying the relief param, if mounted. */
function displaceNode(): Element | null {
	return reliefFilter()?.querySelector('[data-param="relief"]') ?? null;
}

/**
 * Apply a slider's value to the live finish. Each param maps to one concrete,
 * visible knob on the Step-4 relief filter (or the lacquer token). No-ops when the
 * dial is not mounted (the section can render in isolation, e.g. in tests).
 */
function applyParam(param: GuillocheParam, value: number): void {
	switch (param) {
		case "density": {
			// Spatial frequency of the engine-turning: denser → finer spirals.
			turbulenceNode()?.setAttribute(
				"baseFrequency",
				`${value.toFixed(4)} ${value.toFixed(4)}`,
			);
			break;
		}
		case "pitch": {
			// Octave count layers finer detail over the base field (whole steps).
			turbulenceNode()?.setAttribute("numOctaves", String(Math.round(value)));
			break;
		}
		case "relief": {
			// Displacement scale: how deeply the noise embosses the finish.
			displaceNode()?.setAttribute("scale", String(Math.round(value)));
			break;
		}
		case "glint": {
			// Re-rolling the turbulence seed shifts the highlight pattern — the
			// engine-turning "catches the light" differently without changing density.
			turbulenceNode()?.setAttribute("seed", String(Math.round(value)));
			break;
		}
		case "lacquer": {
			// Lacquer depth as an alpha on the midnight overlay: deeper lacquer
			// darkens the finish. Writing the token retints the overlay live.
			document.documentElement.style.setProperty(
				MATERIAL_TOKENS.lacquerDepth,
				`oklch(22% 0.05 265deg / ${value.toFixed(2)})`,
			);
			break;
		}
	}
}

/** Clear or restore the finish's relief filter so it reads flat (prebaked image only). */
function applyFlatFinish(flat: boolean): void {
	const finish = document.querySelector('[data-finish="guilloche"]');
	if (!finish) {
		return;
	}
	if (flat) {
		finish.setAttribute("filter", "none");
	} else {
		finish.setAttribute("filter", `url(#${GUILLOCHE_FILTER_ID})`);
	}
}

/** A slider's range, default, and human label. */
interface SliderSpec {
	param: GuillocheParam;
	label: string;
	min: number;
	max: number;
	step: number;
	value: number;
}

// Slider ranges bracket the Step-4 filter defaults (baseFrequency 0.012,
// numOctaves 2, displacement scale 18, seed 7, lacquer alpha 0.55). They seed the
// sliders near the baked finish; the LIVE value is whatever the user drags to.
const SLIDERS: readonly SliderSpec[] = [
	{
		param: "density",
		label: "Density",
		min: 0.002,
		max: 0.06,
		step: 0.002,
		value: 0.012,
	},
	{ param: "pitch", label: "Pitch", min: 1, max: 6, step: 1, value: 2 },
	{ param: "relief", label: "Relief", min: 0, max: 60, step: 1, value: 18 },
	{ param: "glint", label: "Glint", min: 0, max: 99, step: 1, value: 7 },
	{
		param: "lacquer",
		label: "Lacquer",
		min: 0,
		max: 1,
		step: 0.01,
		value: 0.55,
	},
];

/** One labeled row of the panel: a human label bound to its control. */
interface GuillocheControl {
	label: string;
	value: HTMLInputElement;
}

/**
 * A range slider bound to one live filter parameter. Dragging it writes the param
 * onto the relief filter (or the lacquer token) live. The `data-param` hook names
 * the parameter it drives, so the panel is addressable by param name in tests and
 * future tooling (mirrors material-section.ts's data-token addressing).
 */
function sliderControl(spec: SliderSpec): GuillocheControl {
	const control = input({
		type: "range",
		min: String(spec.min),
		max: String(spec.max),
		step: String(spec.step),
		value: String(spec.value),
		events: {
			input(event) {
				const target = event.target as HTMLInputElement;
				applyParam(spec.param, Number(target.value));
			},
		},
	});
	// jiffies factories reject arbitrary data-* attrs at the type level (and drop
	// empty values), so set the addressable param hook post-construction.
	control.setAttribute("data-param", spec.param);
	return { label: spec.label, value: control };
}

/**
 * The flat-finish toggle: a checkbox that swaps the live relief for the flat
 * prebaked finish. Carries data-param="flat" so the panel is addressable the same
 * way the sliders are.
 */
function flatToggleControl(): GuillocheControl {
	const control = input({
		type: "checkbox",
		events: {
			input(event) {
				const target = event.target as HTMLInputElement;
				applyFlatFinish(target.checked);
			},
		},
	});
	control.setAttribute("data-param", "flat");
	return { label: "Flat finish", value: control };
}

/** The F2 contributed guilloché ControlsSection (debugOnly: true). */
export const guillocheSection: ControlsSection = {
	id: "guilloche",
	title: "Guilloché",
	debugOnly: true,
	render(): Node[] {
		const controls = [...SLIDERS.map(sliderControl), flatToggleControl()];
		return [
			FormGroup(
				{ legend: "Finish" },
				PropertySheet({
					entries: controls.map(({ label, value }) => ({ label, value })),
				}),
			),
		];
	},
};
