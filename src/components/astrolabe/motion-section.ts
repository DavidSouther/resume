// The #debug motion ControlsSection (registers via Contract 2).
//
// Comprehensive motion controls: motion on/off, parallax on/off, and a parallax
// strength slider — each driving the live engine/parallax through motion-controls.ts
// (the seam that keeps this section decoupled from the engine instance). The two
// switches are jiffies Switches; the strength is a range slider, mirroring the
// guilloché panel's data-param idiom. Each control carries an addressable data-hook
// (data-toggle / data-param) the suite and future tooling target, set after
// construction since jiffies factories reject arbitrary data-* attrs.
import { FormGroup } from "@davidsouther/jiffies/components/index.ts";
import { Switches } from "@davidsouther/jiffies/dom/form/form.ts";
import { input } from "@davidsouther/jiffies/dom/html.ts";
import type { ControlsSection } from "./controls.ts";
import {
	setMotionEnabled,
	setParallaxEnabled,
	setParallaxStrengthLive,
} from "./motion-controls.ts";

/** The parallax-strength slider's range and default (matches parallax.ts's default). */
const STRENGTH = { min: 0, max: 0.2, step: 0.01, value: 0.04 } as const;

/**
 * Tag a Switches fieldset's checkbox with a stable data-toggle hook and wire its
 * change to a live setter. jiffies Switches keys inputs by the slugged legend, so
 * the single checkbox is the fieldset's only `input`; we tag it directly.
 */
function wiredSwitch(
	legend: string,
	hook: string,
	onChange: (on: boolean) => void,
): HTMLFieldSetElement {
	const group = Switches(legend, { [hook]: legend });
	const box = group.querySelector("input");
	if (box) {
		box.setAttribute("data-toggle", hook);
		box.checked = true;
		box.addEventListener("change", () => {
			onChange((box as HTMLInputElement).checked);
		});
	}
	return group;
}

/** The parallax-strength range slider, addressable by data-param. */
function strengthSlider(): HTMLInputElement {
	const control = input({
		type: "range",
		min: String(STRENGTH.min),
		max: String(STRENGTH.max),
		step: String(STRENGTH.step),
		value: String(STRENGTH.value),
		events: {
			input(event) {
				setParallaxStrengthLive(
					Number((event.target as HTMLInputElement).value),
				);
			},
		},
	});
	control.setAttribute("data-param", "parallax-strength");
	return control;
}

/** The F3 contributed motion ControlsSection (debugOnly: true): motion + parallax toggles. */
export const motionSection: ControlsSection = {
	id: "motion",
	title: "Motion",
	debugOnly: true,
	render(): Node[] {
		return [
			wiredSwitch("Motion", "motion", setMotionEnabled),
			wiredSwitch("Parallax", "parallax", setParallaxEnabled),
			FormGroup({ legend: "Parallax strength" }, strengthSlider()),
		];
	},
};
