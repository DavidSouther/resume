// The Astrolabe stage builder: constructs the single `#stage-wrap` component (the
// evolved controls drawer), which itself builds and owns the dial (`AstrolabeView`)
// and the page overlays. The SSG page renders `.root`; the client builds a fresh
// stage from the same function and drives it via `initControls(root)` (controls)
// and `startAnimation(root, dial, …)` (scene). Nothing here hands out interior
// element handles — the only things returned are the root component and the dial
// `<svg>` the loop holds for sanctioned layout reads. See
// .ailly/developer/2026-06-23-A-astrolabe-fcc-refactor/dial-redesign.md.
import {
	ControlsDrawer,
	type ControlsDrawerHandle,
	DEFAULTS,
	dialSvgOf,
} from "./controls-components.ts";

export interface StageHandles {
	// `root` IS the `#stage-wrap` component (the controls handle), which owns the
	// dial + overlays internally.
	root: ControlsDrawerHandle;
	// The dial `<svg>` — held by the loop for layout reads / root pointer wiring,
	// never poked for content (that flows through `root.update({ scene })`).
	dial: SVGSVGElement;
}

export function buildStage(): StageHandles {
	const root = ControlsDrawer({ state: { ...DEFAULTS } });
	return { root, dial: dialSvgOf(root) };
}
