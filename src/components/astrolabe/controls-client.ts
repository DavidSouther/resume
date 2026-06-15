// The /astrolabe/ client toggle — the minimal browser script F1 ships.
//
// The page is statically generated: ControlsSheet() runs ONCE at build time with
// no #debug hash, so the SSG bakes only the always-visible sections into the HTML
// (first paint carries content). A real reader visiting /astrolabe/#debug needs
// the debugOnly material panel to appear — that gating is decided client-side off
// location.hash (design §"#debug gating in a static page"). This module re-mounts
// the sheet into its stable host on load and on every hashchange.
//
// It is wired through the SSG `clientModules` hook on pages/astrolabe/page.ts;
// Rollup bundles it and the SSG injects it as a deferred module script. This is
// F1's only client surface — the SVG dial hydration is F2's.
import { colorSection } from "./color-section.ts";
import {
	CONTROLS_HOST_ATTR,
	refreshControlsHost,
	registerControlsSection,
} from "./controls.ts";
import { guillocheSection } from "./guilloche-section.ts";
import { materialSection } from "./material-section.ts";

/** Re-render the controls host from the current hash. No-op if the host is absent. */
export function syncControlsHost(): void {
	const host = document.querySelector(`[${CONTROLS_HOST_ATTR}]`);
	if (host) {
		refreshControlsHost(host);
	}
}

/** Register F1's sections client-side and wire the live #debug toggle. */
export function startControlsClient(): void {
	// The build-time render and the client share one module-level registry only
	// within a single runtime; in the browser the registry starts empty, so every
	// contributed section must be (re-)registered here in the same order the SSG
	// registered them. Each is idempotent on id.
	registerControlsSection(materialSection);
	registerControlsSection(guillocheSection);
	registerControlsSection(colorSection);
	syncControlsHost();
	window.addEventListener("hashchange", syncControlsHost);
}

startControlsClient();
