// The empty square dial host (project-plan Contract 1 slot).
//
// F2 mounts its <svg viewBox="-500 -500 1000 1000"> into this element. F1 ships it
// EMPTY (no SVG, no body groups) carrying the stable `data-astrolabe-dial` hook.
//
// The midnight ground (--dial-midnight) is painted via the `.astrolabe-dial`
// class so the #debug material section can retint it live with setProperty.
import { div } from "@davidsouther/jiffies/dom/html.ts";

/** The empty square host F2 mounts its <svg viewBox="-500 -500 1000 1000"> into. Carries [data-astrolabe-dial]. */
export function DialContainer(): Element {
	// jiffies factories type their attrs by the element's own properties and treat
	// an empty-string value as "remove attribute", so the F2 mount hook is set
	// directly. A bare presence attribute is all the slot needs.
	const host = div({ class: "astrolabe-dial" });
	host.setAttribute("data-astrolabe-dial", "");
	return host;
}
