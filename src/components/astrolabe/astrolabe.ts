// The top-level astrolabe SHELL (F1).
//
// Composes the platinum case/strap figure around an empty dial container, with
// the always-visible controls sheet below it. F1 ships SHELL ONLY: NO bodies, NO
// astronomy, NO Realtime/Fast button (those are F2/F3).
//
// The F1 #debug material panel is contributed through the controls registry
// (Contract 2), never hardcoded into this markup — registering it here is
// idempotent on its id, so re-rendering the shell never duplicates the panel.
import { div } from "@davidsouther/jiffies/dom/html.ts";
import { WatchCase } from "./case.ts";
import { colorSection } from "./color-section.ts";
import { ControlsHost, registerControlsSection } from "./controls.ts";
import { Dial } from "./dial.ts";
import { DialContainer } from "./dial-container.ts";
import { guillocheSection } from "./guilloche-section.ts";
import { materialSection } from "./material-section.ts";
import { renderModeSection } from "./render-mode.ts";
import { SpeedToggle } from "./speed-toggle.ts";

/** Top-level composition: case/strap figure + populated dial + Realtime/Fast case button + controls sheet. */
export function Astrolabe(): Element {
	// Contribute the #debug panels through the registry, not the markup. Each is
	// idempotent on id, so this is safe on every (re-)render. F1 contributes the
	// material (case & strap) panel; F2 appends the guilloché finish sliders and
	// the per-body color pickers; F3 appends the always-visible geocentric/orbital
	// render-mode switch (Contracts 2/3/4).
	registerControlsSection(materialSection);
	registerControlsSection(guillocheSection);
	registerControlsSection(colorSection);
	registerControlsSection(renderModeSection);

	// F2 fills the F1 dial host with the populated geocentric SVG (the contracted
	// hand-off). The host stays the stable [data-astrolabe-dial] slot; appending
	// keeps astrolabe.ts a thin composer with the SVG-heavy code in dial.ts.
	const dial = DialContainer();
	dial.append(Dial());
	const caseFigure = WatchCase(dial);
	// F3's Realtime/Fast button sits ON THE CASE, OUTSIDE the controls sheet (the
	// sanctioned deviation from the spec's exponential slider): a sibling of the
	// case figure inside `.astrolabe`, never nested in the controls host.
	const speedToggle = SpeedToggle();
	// The controls live in a stable host the client toggle (controls-client.ts)
	// re-renders on hashchange, so the #debug material panel appears live in the
	// browser rather than being frozen at the SSG build-time hash.
	const controls = ControlsHost();
	return div({ class: "astrolabe" }, caseFigure, speedToggle, controls);
}
