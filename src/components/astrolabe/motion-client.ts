// The F3 client entry (the controls-client.ts analogue).
//
// Re-registers the F3 sections (renderModeSection, motionSection, zodiacSection)
// into the browser registry — which starts EMPTY, exactly as controls-client.ts
// re-registers F1/F2's sections so the #debug panels appear live. Then it resolves
// the rendered dial, instantiates a MotionEngine on it seeded to "now", registers
// the engine with motion-controls.ts (the seam the #debug motion switches drive),
// wires the rendered SpeedToggle to the clock's setSpeed, binds the mousemove
// parallax, and starts the rAF loop — unless prefers-reduced-motion is set, in which
// case the dial stays the static first-paint snapshot. A no-op when the dial is
// absent (SSR-safe import).
import {
	CONTROLS_HOST_ATTR,
	refreshControlsHost,
	registerControlsSection,
} from "./controls.ts";
import { MotionEngine, SimulatedClock } from "./motion.ts";
import { registerMotion, setParallaxEnabled } from "./motion-controls.ts";
import { motionSection } from "./motion-section.ts";
import { renderModeSection } from "./render-mode.ts";
import { bindSpeedToggle } from "./speed-toggle.ts";
import { zodiacSection } from "./zodiac-section.ts";

/** True when the reader asked the OS to minimize motion — the loop then stays paused. */
function prefersReducedMotion(): boolean {
	return (
		typeof window.matchMedia === "function" &&
		window.matchMedia("(prefers-reduced-motion: reduce)").matches
	);
}

/** Re-render the controls host from the current hash so #debug F3 sections appear. */
function syncControlsHost(): void {
	const host = document.querySelector(`[${CONTROLS_HOST_ATTR}]`);
	if (host) {
		refreshControlsHost(host);
	}
}

/** Register F3's sections client-side and start the motion loop. No-op if the dial is absent. */
export function startMotionClient(): void {
	// The browser registry starts empty; (re-)register F3's sections in the order the
	// SSG registered them (renderMode is always-visible, the other two are #debug).
	// Each is idempotent on id, so this never duplicates a panel.
	registerControlsSection(renderModeSection);
	registerControlsSection(motionSection);
	registerControlsSection(zodiacSection);
	syncControlsHost();
	window.addEventListener("hashchange", syncControlsHost);

	const shell = document.querySelector(".astrolabe");
	const dial = shell?.querySelector("svg");
	if (!shell || !dial) {
		return;
	}

	const clock = new SimulatedClock(new Date(), "realtime");
	const engine = new MotionEngine(shell, clock);
	registerMotion(engine, shell);

	// The static button is inert (the SSG drops jiffies' click closure), so re-graft
	// the live behavior here: each click flips Realtime/Fast on the watch root and
	// re-anchors the clock (continuity is handled in setSpeed — the loop's elapsed
	// baseline is left untouched).
	const toggle = shell.querySelector<HTMLButtonElement>("[data-speed-toggle]");
	if (toggle) {
		bindSpeedToggle(toggle, (speed) => clock.setSpeed(speed));
	}

	// Parallax defaults ON (matched by the #debug switch's default-checked state).
	setParallaxEnabled(true);

	if (!prefersReducedMotion()) {
		engine.start();
	}
}

startMotionClient();
