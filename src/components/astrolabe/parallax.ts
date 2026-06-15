// Desktop mousemove parallax (device-tilt parallax deferred).
//
// parallaxShift returns a per-group pixel offset that scales DOWN with ring radius
// so the outer-body groups shift LESS than the inner ones, giving the dial depth:
// the inner orbits feel close, the zodiac rim feels far. bindParallax attaches a
// mousemove handler that applies that shift to every [data-body]/[data-zodiac-band]
// group from the pointer's offset from the dial center, and returns an unbind.
// Strength and on/off are driven from the #debug motion section (motion-section.ts).
import { R_OUTER } from "../../lib/astro-math.ts";

/** Per-group depth factor: 1 at center, 0 at the outer rim — outer groups drift less. */
function depthFactor(radius: number): number {
	return 1 - radius / R_OUTER;
}

/**
 * Outer groups shift less: a pure shift for a ring radius and a pointer offset.
 * `factor = strength · (1 − radius / R_OUTER)`, so an inner orbit gets the full
 * pointer-scaled shift while the zodiac rim (radius ≈ R_OUTER) barely moves, and a
 * strength of 0 freezes the field.
 */
export function parallaxShift(
	radius: number,
	pointer: { x: number; y: number },
	strength: number,
): { dx: number; dy: number } {
	const factor = strength * depthFactor(radius);
	return { dx: pointer.x * factor, dy: pointer.y * factor };
}

/** Per-instance parallax strength, mutated live by the #debug motion section. */
let strength = 0.04;

/** Set the live parallax strength the bound handler reads on the next mousemove. */
export function setParallaxStrength(value: number): void {
	strength = value;
}

/** The dial center in client pixels (the element's bounding-box midpoint). */
function pointerOffset(
	target: Element,
	event: MouseEvent,
): { x: number; y: number } {
	const rect = target.getBoundingClientRect();
	return {
		x: event.clientX - (rect.left + rect.width / 2),
		y: event.clientY - (rect.top + rect.height / 2),
	};
}

/**
 * The shiftable groups: every body group plus the zodiac band, each carrying a
 * `data-radius` ring-radius hint (the band reads R_OUTER). Re-queried per move so a
 * re-rendered dial is picked up.
 */
function parallaxGroups(root: ParentNode): Element[] {
	return [
		...root.querySelectorAll<Element>("[data-body]"),
		...root.querySelectorAll<Element>("[data-zodiac-band]"),
	];
}

/** The ring radius a group parallaxes at, from its data-radius hint (rim by default). */
function groupRadius(group: Element): number {
	const hint = group.getAttribute("data-radius");
	return hint === null ? R_OUTER : Number(hint);
}

/**
 * Bind a mousemove handler that shifts body groups; returns an unbind. The handler
 * is attached to the dial `<svg>` when present (so it fires only over the dial),
 * falling back to the root. It composes the parallax translate onto the engine's
 * own transform via a CSS `translate` so the two never fight: the engine owns the
 * SVG `transform` attribute, parallax owns the inline `translate` style.
 */
export function bindParallax(root: ParentNode): () => void {
	const surface =
		(root instanceof Element && root.matches("svg") ? root : null) ??
		root.querySelector("svg") ??
		(root instanceof Element ? root : root.querySelector("*")) ??
		document.documentElement;

	const onMove = (event: MouseEvent): void => {
		const pointer = pointerOffset(surface, event);
		for (const group of parallaxGroups(root)) {
			const { dx, dy } = parallaxShift(groupRadius(group), pointer, strength);
			// The CSS `translate` individual property composes WITH the SVG `transform`
			// attribute the engine owns, so motion (transform) and parallax (translate)
			// never overwrite each other.
			(group as HTMLElement | SVGElement).style.translate = `${dx}px ${dy}px`;
		}
	};

	surface.addEventListener("mousemove", onMove as EventListener);
	return () =>
		surface.removeEventListener("mousemove", onMove as EventListener);
}
