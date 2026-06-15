// Shared watch-root resolution for the F3 motion surface.
//
// Several F3 modules (render-mode.ts, speed-toggle.ts, and the motion engine)
// write attributes onto the SAME live watch element — the `.astrolabe` shell
// (astrolabe.ts) the CSS and motion loop read each frame. Unlike the F1/F2
// material/color sections, which cascade CSS custom properties off
// document.documentElement, these attributes must land on the specific watch
// element, so they share one resolver instead of each rediscovering it.

/**
 * The live watch root for attribute writes. Resolved at call time (a section may
 * render before the dial mounts), preferring the `.astrolabe` shell and falling
 * back to the document element so the write is never lost. No-op-safe.
 */
export function watchRoot(): Element {
	return document.querySelector(".astrolabe") ?? document.documentElement;
}
