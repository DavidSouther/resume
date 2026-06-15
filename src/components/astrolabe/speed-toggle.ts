// The Realtime/Fast button on the case (the sanctioned spec deviation).
//
// A two-state toggle rendered ONTO the case figure, OUTSIDE the controls sheet —
// the sanctioned substitute for the visual spec's exponential slider. Clicking it
// writes/removes FAST_ATTR on the watch root; the CSS hides the hands in Fast and
// the motion engine re-anchors its clock via setSpeed (wired in Step 6). Fast runs
// at roughly one simulated year per real minute.
//
// The button is its own DOM element; the only side effect is the click handler,
// which resolves the live watch root at event time (the shared watchRoot helper,
// also used by render-mode.ts) and writes FAST_ATTR there. No-op-safe when no
// root is mounted.
import { button } from "@davidsouther/jiffies/dom/html.ts";
import { watchRoot } from "./watch-root.ts";

/** The two simulation speeds: realtime tracks the wall clock; fast ≈ one year per minute. */
export type Speed = "realtime" | "fast";

/** Attribute on the watch root: present + "fast" hides hands and runs the loop fast. */
export const FAST_ATTR = "data-fast";

/** The visible label for each speed (also the source of the button's text). */
const SPEED_LABEL: Readonly<Record<Speed, string>> = {
	realtime: "Realtime",
	fast: "Fast",
};

/**
 * Real-seconds-per-simulated-second factors. Realtime tracks the wall clock 1:1;
 * fast advances one calendar year (31_557_600 s) per real minute (60 s) ≈ 525_960×.
 */
export const SPEED_FACTOR: Readonly<Record<Speed, number>> = {
	realtime: 1,
	fast: 31_557_600 / 60,
};

/** The current speed implied by the watch root's FAST_ATTR. */
function speedOf(root: Element): Speed {
	return root.hasAttribute(FAST_ATTR) ? "fast" : "realtime";
}

/**
 * Apply a speed to the button + watch root: write/remove FAST_ATTR and set the
 * label. Shared by the build-time click closure and the client re-binding so the
 * two never drift (the SSG serializes static HTML and drops the closure, so the
 * client re-attaches this exact behavior in bindSpeedToggle).
 */
function applySpeed(
	toggle: HTMLButtonElement,
	root: Element,
	speed: Speed,
): void {
	toggle.textContent = SPEED_LABEL[speed];
	if (speed === "fast") {
		root.setAttribute(FAST_ATTR, "");
	} else {
		root.removeAttribute(FAST_ATTR);
	}
}

/**
 * Wire a (possibly server-rendered, inert) speed button: each click flips the
 * Realtime/Fast state on the watch root and reports the new speed to `onSpeed`
 * (the motion client re-anchors its clock with it). Returns an unbind. The static
 * page ships an inert button (jiffies closures don't serialize), so motion-client.ts
 * calls this on load to graft the live behavior onto the rendered button.
 */
export function bindSpeedToggle(
	toggle: HTMLButtonElement,
	onSpeed: (speed: Speed) => void = () => {},
): () => void {
	const onClick = (): void => {
		const root = watchRoot();
		const next: Speed = speedOf(root) === "realtime" ? "fast" : "realtime";
		applySpeed(toggle, root, next);
		onSpeed(next);
	};
	toggle.addEventListener("click", onClick);
	return () => toggle.removeEventListener("click", onClick);
}

/** The <button data-speed-toggle> rendered onto the case (OUTSIDE the controls sheet). */
export function SpeedToggle(): HTMLButtonElement {
	const toggle = button(
		{ class: "astrolabe-speed-toggle" },
		SPEED_LABEL.realtime,
	);
	toggle.setAttribute("data-speed-toggle", "");
	// Build-time binding so a non-SSG render (e.g. a direct mount in a test) is live;
	// the SSG drops this closure, and motion-client.ts re-binds in the browser.
	bindSpeedToggle(toggle);
	return toggle;
}
