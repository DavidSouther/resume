import { EARTH } from "./bodies.ts";
import { helioA } from "./math.ts";
import type { Body } from "./types.ts";

// Dial center, matching math.ts's pt().
const CX = 500;
const CY = 500;

// Geocentric direction of `body` as seen from Earth, in display degrees, as a
// pure function of simulated time. Extracted verbatim from animation.ts's
// `setGeo`: the au-scaled vector from Earth (on the unit circle) to the body (at
// radius = au); the quantity that produces apparent retrograde at a fixed dial
// radius. The Moon keeps its own `helioA` (it already orbits Earth in the
// model), the Sun's geocentric direction is `aE + 180`, and Earth itself returns
// the Sun direction (the source's `geo.earth = geo.sun`).
export function geoDirection(body: Body, simT: number): number {
	// Moon already orbits Earth in the model: its own helioA is the geocentric
	// direction.
	if (body.moon) return helioA(body, simT);
	// Sun sits opposite Earth's heliocentric direction.
	if (body.key === "sun") return helioA(EARTH, simT) + 180;
	// Earth itself looks toward the Sun (geo.earth = geo.sun in the source).
	if (body.key === "earth") return helioA(EARTH, simT) + 180;
	const aErad = (helioA(EARTH, simT) * Math.PI) / 180;
	const exh = Math.cos(aErad);
	const eyh = Math.sin(aErad);
	const ar = (helioA(body, simT) * Math.PI) / 180;
	const au = body.au ?? 1;
	return (
		(Math.atan2(au * Math.sin(ar) - eyh, au * Math.cos(ar) - exh) * 180) /
		Math.PI
	);
}

// Straight radial-spoke endpoints (dial coordinates) for the Ptolemaic
// guilloche: `inner` spokes from rInner to rMid, doubling to `2*inner` from rMid
// outward, matching the heliocentric guilloche's density doubling at Mars.
// Rendering/DOM lives in the component.
export function radialSpokes(
	inner: number,
	rInner: number,
	rMid: number,
	rOuter: number,
): { x1: number; y1: number; x2: number; y2: number }[] {
	const segs: { x1: number; y1: number; x2: number; y2: number }[] = [];
	const band = (count: number, rA: number, rB: number) => {
		for (let k = 0; k < count; k++) {
			const th = (k * 2 * Math.PI) / count;
			const c = Math.cos(th);
			const s = Math.sin(th);
			segs.push({
				x1: CX + rA * c,
				y1: CY + rA * s,
				x2: CX + rB * c,
				y2: CY + rB * s,
			});
		}
	};
	// `inner` spokes from rInner to rMid, doubling to 2*inner from rMid outward.
	band(inner, rInner, rMid);
	band(2 * inner, rMid, rOuter);
	return segs;
}
