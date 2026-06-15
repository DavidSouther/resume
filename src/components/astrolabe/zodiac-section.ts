// The #debug zodiac ControlsSection (registers via Contract 2).
//
// Comprehensive sky controls: zodiac band on/off and twilight wedge on/off. Each is
// a jiffies Switch defaulting to ON; switching it OFF writes a `data-hide-*` flag on
// the watch root that the astrolabe CSS reads to collapse that layer's visibility,
// and switching it back ON clears the flag. The switches let a later session refine
// the sky layers live under #debug; the side effect mirrors render-mode.ts /
// speed-toggle.ts — resolve the live watch root at event time and write the flag.
import { Switches } from "@davidsouther/jiffies/dom/form/form.ts";
import type { ControlsSection } from "./controls.ts";
import { watchRoot } from "./watch-root.ts";

/** A sky layer: its switch hook and the watch-root flag the CSS reads when hidden. */
interface SkyLayer {
	hook: string;
	label: string;
	hideAttr: string;
}

/** The two toggleable sky layers, in display order. */
const LAYERS: readonly SkyLayer[] = [
	{ hook: "zodiac-band", label: "Zodiac band", hideAttr: "data-hide-zodiac" },
	{ hook: "twilight", label: "Twilight zone", hideAttr: "data-hide-twilight" },
];

/** A Switch defaulting to ON; off writes the layer's hide flag, on clears it. */
function layerSwitch(layer: SkyLayer): HTMLFieldSetElement {
	const group = Switches(layer.label, { [layer.hook]: layer.label });
	const box = group.querySelector("input");
	if (box) {
		box.setAttribute("data-toggle", layer.hook);
		box.checked = true;
		box.addEventListener("change", () => {
			const root = watchRoot();
			if ((box as HTMLInputElement).checked) {
				root.removeAttribute(layer.hideAttr);
			} else {
				root.setAttribute(layer.hideAttr, "");
			}
		});
	}
	return group;
}

/** The F3 contributed zodiac ControlsSection (debugOnly: true): band + twilight toggles. */
export const zodiacSection: ControlsSection = {
	id: "zodiac",
	title: "Zodiac & Sky",
	debugOnly: true,
	render(): Node[] {
		return LAYERS.map(layerSwitch);
	},
};
