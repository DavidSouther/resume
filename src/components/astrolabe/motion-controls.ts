// The live F3 motion controller — the seam between the #debug sections and the
// running engine/parallax (no circular import, no engine instance leaking into a
// section).
//
// motion-client.ts registers the live MotionEngine and the parallax binding here at
// boot; the #debug motion section (motion-section.ts) drives motion on/off, parallax
// on/off, and parallax strength through these imperative setters. Every setter is
// no-op-safe before registration (a section can render with no live engine, e.g. in
// tests), so the debug panel is decoupled from the engine lifecycle.
import type { MotionEngine } from "./motion.ts";
import { bindParallax, setParallaxStrength } from "./parallax.ts";

/** The live engine + parallax handles motion-client registers at boot. */
interface LiveMotion {
	engine: MotionEngine;
	root: ParentNode;
	unbindParallax: (() => void) | null;
}

let live: LiveMotion | null = null;

/** Register the running engine + dial root so the #debug section can drive them. */
export function registerMotion(engine: MotionEngine, root: ParentNode): void {
	live = { engine, root, unbindParallax: null };
}

/** Start or stop the rAF motion loop live. No-op before registration. */
export function setMotionEnabled(enabled: boolean): void {
	if (!live) {
		return;
	}
	if (enabled) {
		live.engine.start();
	} else {
		live.engine.stop();
	}
}

/** Bind or unbind the mousemove parallax live. No-op before registration. */
export function setParallaxEnabled(enabled: boolean): void {
	if (!live) {
		return;
	}
	if (enabled && !live.unbindParallax) {
		live.unbindParallax = bindParallax(live.root);
	} else if (!enabled && live.unbindParallax) {
		live.unbindParallax();
		live.unbindParallax = null;
	}
}

/** Set the live parallax strength the bound handler reads on the next move. */
export function setParallaxStrengthLive(value: number): void {
	setParallaxStrength(value);
}
