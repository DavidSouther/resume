// The always-visible geocentric/orbital render-mode switch (registers via Contract 2).
//
// A non-debug ControlsSection holding a StaticTabList of two tabs (Geocentric /
// Orbital). Selecting a tab writes RENDER_MODE_ATTR onto the watch root; the
// motion engine (motion.ts) reads it to apply or drop the Earth-pin rotation.
// currentRenderMode reads the attribute back, defaulting to "geocentric".
//
// The switch is CSS-only at rest (StaticTabList = radio+label pairs); the change
// handler is the single side effect, mirroring color-section.ts / material-
// section.ts: it resolves the live watch root at event time and writes the
// attribute there. No-op-safe when no root is mounted.
import { StaticTabList } from "@davidsouther/jiffies/components/index.ts";
import type { ControlsSection } from "./controls.ts";
import { watchRoot } from "./watch-root.ts";

/** The two render modes: geocentric pins Earth on the +x ray; orbital releases it. */
export type RenderMode = "geocentric" | "orbital";

/** Attribute on the watch root the motion engine reads to apply/drop the Earth-pin. */
export const RENDER_MODE_ATTR = "data-render-mode";

/** The default mode when the watch root carries no RENDER_MODE_ATTR. */
const DEFAULT_RENDER_MODE: RenderMode = "geocentric";

/** The two tabs, in display order; each id is exactly its RenderMode value. */
const RENDER_MODE_TABS: readonly { id: RenderMode; label: string }[] = [
	{ id: "geocentric", label: "Geocentric" },
	{ id: "orbital", label: "Orbital" },
];

/** Narrow an arbitrary id to a RenderMode, falling back to the default. */
function asRenderMode(id: string | null): RenderMode {
	return id === "orbital" ? "orbital" : DEFAULT_RENDER_MODE;
}

/** Always-visible contributed section (debugOnly: false) holding the StaticTabList switch. */
export const renderModeSection: ControlsSection = {
	id: "render-mode",
	title: "Render mode",
	debugOnly: false,
	render(): Node {
		const tabs = StaticTabList({
			name: "render-mode",
			tabs: RENDER_MODE_TABS.map((tab) => ({
				id: tab.id,
				label: tab.label,
				selected: tab.id === DEFAULT_RENDER_MODE,
			})),
		});
		// StaticTabList is CSS-only (no per-tab callback); a single delegated change
		// handler reads the selected radio's id (== RenderMode) and writes it onto
		// the live watch root, which the motion engine reads each frame.
		tabs.addEventListener("change", (event) => {
			const radio = event.target as HTMLInputElement;
			watchRoot().setAttribute(RENDER_MODE_ATTR, asRenderMode(radio.id));
		});
		return tabs;
	},
};

/**
 * Read the current render mode off the watch root (defaults to "geocentric").
 * Accepts either the `.astrolabe` shell itself or any ancestor that contains it,
 * so the motion engine can pass whatever root it was constructed with.
 */
export function currentRenderMode(root: ParentNode): RenderMode {
	const shell =
		root instanceof Element && root.matches(".astrolabe")
			? root
			: root.querySelector(".astrolabe");
	const value = shell?.getAttribute(RENDER_MODE_ATTR) ?? null;
	return asRenderMode(value);
}
