// The #debug per-body color ControlsSection (CONSUMES Contract 3, registers via Contract 2).
//
// One <input type="color"> per BodyName, each writing its bodyColorVar token onto
// document.documentElement via setProperty on input — the identical mechanism to
// material-section.ts::applyToken. The body markers in dial.ts fill with
// fill="var(--color-<body>)", so picking a swatch retints that body live.
//
// Astrolabe() registers this through registerControlsSection alongside the F1
// materialSection. The controls are keyed off bodyColorVar(body), so renaming a
// body in astro-tokens.ts breaks this import rather than silently the styling.
import {
	FormGroup,
	PropertySheet,
} from "@davidsouther/jiffies/components/index.ts";
import { input } from "@davidsouther/jiffies/dom/html.ts";
import type { BodyName } from "../../lib/astro-tokens.ts";
import { bodyColorVar } from "../../lib/astro-tokens.ts";
import type { ControlsSection } from "./controls.ts";

/** The bodies, in dial paint order, each getting a color picker row. */
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

/**
 * Provisional swatches seeding the color inputs. They mirror the global.css
 * @layer theme --color-<body> defaults so the picker opens near the live color;
 * the LIVE token is whatever the user picks. <input type="color"> needs a #rrggbb
 * default (it cannot seed from an oklch()), so these are sRGB approximations.
 */
const DEFAULT_SWATCH: Readonly<Record<BodyName, string>> = {
	sun: "#f3c969",
	mercury: "#b3b6bd",
	venus: "#e8d9b0",
	earth: "#3a7bd5",
	moon: "#e6e7ea",
	mars: "#c0492f",
	jupiter: "#cba87a",
	saturn: "#d8c79a",
	uranus: "#8fd0d6",
	neptune: "#2f5bd0",
};

/** Title-case a body name for its human-facing label, e.g. "mars" -> "Mars". */
function bodyLabel(body: BodyName): string {
	return body.charAt(0).toUpperCase() + body.slice(1);
}

/** One row of the color panel: a human label and its bound color swatch. */
interface BodyControl {
	label: string;
	value: HTMLInputElement;
}

/**
 * A color swatch bound to one body's --color-<body> token. Changing the swatch
 * writes the token onto documentElement live, retinting that body's marker. The
 * `data-body` hook names the body it drives, so the panel is addressable by body
 * name in tests and future tooling (mirrors material-section.ts's data-token).
 */
function bodyControl(body: BodyName): BodyControl {
	const control = input({
		type: "color",
		value: DEFAULT_SWATCH[body],
		events: {
			input(event) {
				const target = event.target as HTMLInputElement;
				document.documentElement.style.setProperty(
					bodyColorVar(body),
					target.value,
				);
			},
		},
	});
	// jiffies factories reject arbitrary data-* attrs at the type level (and drop
	// empty values), so set the addressable body hook post-construction.
	control.setAttribute("data-body", body);
	return { label: bodyLabel(body), value: control };
}

/** The F2 contributed per-body color ControlsSection (debugOnly: true). */
export const colorSection: ControlsSection = {
	id: "color",
	title: "Body colors",
	debugOnly: true,
	render(): Node[] {
		const controls = BODIES.map(bodyControl);
		return [
			FormGroup(
				{ legend: "Bodies" },
				PropertySheet({
					entries: controls.map(({ label, value }) => ({ label, value })),
				}),
			),
		];
	},
};
