// The Astrolabe page overlays as FCCs: the two clock readouts (inside the
// controls drawer), the hover tooltip, and the sign card. Each is a dumb FCC that
// renders itself from its slice of the Scene — the stage component owns these
// instances and fans them their slices on `update({ scene })`. No element handle
// crosses a boundary; no raw DOM mutation. See
// .ailly/developer/2026-06-23-A-astrolabe-fcc-refactor/dial-redesign.md.
import { up } from "@davidsouther/jiffies/dom/dom.ts";
import { FCC, State } from "@davidsouther/jiffies/dom/fc.ts";
import { div, span } from "@davidsouther/jiffies/dom/html.ts";
import { FULLNAME, SIGN_FULL } from "../../lib/astrolabe/bodies.ts";
import { glyphSvg } from "./components.ts";

// A single clock readout (the `id` distinguishes sim vs real). Renders the
// formatted string as its text content.
interface ClockProps {
	id: string;
	text: string;
}
export const Clock = FCC<ClockProps>(
	"astro-clock",
	() => span({ class: "clock-v" }),
	(el, attrs) => {
		up(el, { id: attrs.id });
		// A text-node child: valid at runtime (reconcileChildren wraps strings), but
		// RenderFn's type is Element[], so assert through it.
		return [attrs.text] as unknown as Element[];
	},
);

// The hover tooltip. Shows the body name at the cursor point, or hides itself.
interface TooltipProps {
	shown: boolean;
	x: number;
	y: number;
	text: string;
}
export const Tooltip = FCC<TooltipProps>(
	"astro-tooltip",
	() => div({ id: "tip" }),
	(el, attrs) => {
		if (attrs.shown) {
			up(el, {
				class: "show",
				style: { left: `${attrs.x}px`, top: `${attrs.y}px` },
			});
			return [attrs.text] as unknown as Element[];
		}
		up(el, { class: "!show" });
		return [];
	},
);

// The sign card. Rebuilds its content only when the sign/occupants change (the
// content is a built svg glyph + name + planet list), and positions / shows or
// hides itself each render.
interface SignCardProps {
	shown: boolean;
	sign: number;
	occupants: string[];
	x: number;
	y: number;
}
type SignCardState = { sig: string; content: Element[] };
export const SignCard = FCC<SignCardProps, SignCardState>(
	"astro-signcard",
	() => div({ id: "signcard" }),
	(el, attrs) => {
		const st = el[State] as SignCardState;
		st.content ??= [];
		if (attrs.shown) {
			const sig = `${attrs.sign}:${attrs.occupants.join(",")}`;
			if (sig !== st.sig) {
				const pl = attrs.occupants.length
					? attrs.occupants.map((k) => FULLNAME[k]).join("  ·  ")
					: "No planets";
				st.content = [
					glyphSvg(attrs.sign, 46),
					div({ class: "sc-name" }, SIGN_FULL[attrs.sign]),
					div({ class: "sc-pl" }, pl),
				];
				st.sig = sig;
			}
			up(el, {
				class: "show",
				style: { left: `${attrs.x}px`, top: `${attrs.y}px` },
			});
		} else {
			if (st.sig) st.sig = "";
			up(el, { class: "!show" });
		}
		return st.content;
	},
);
