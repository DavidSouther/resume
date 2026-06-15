const SVGNS = "http://www.w3.org/2000/svg";
const CX = 500;
const CY = 500;

// Log-scale mapping constants verified against bodies.ts AU/r pairs.
const A = 69.5;
const B = 168.4; // Earth dial radius (1 AU)
const R_MARS = 197.5; // Mars dial radius — inner/outer density boundary
const MAX_R = 422; // zodiac inner edge — guilloche clips here
const SAMPLES = 50;
const R_SUN = 40; // inner boundary — just outside sun-glow disc (r=34)

// Cache to skip recomputation when Earth hasn't moved.
let _cacheEx = Number.NaN;
let _cacheEy = Number.NaN;
let _cacheN = -1;
let _cacheExC = Number.NaN;
let _cacheExH = Number.NaN;

/**
 * Compute the SVG path `d` attribute for one guilloche curve.
 *
 * phi: geocentric angle in display-space radians (0 = right = Earth-to-anti-Sun).
 * Ex, Ey: Earth's current display position.
 * rFrom / rTo: dial radii to trace between.
 * samples: number of t steps.
 *
 * Parameterizes by t (geocentric distance from Earth in AU). t=0 is always
 * Earth's position. Each point is converted to heliocentric AU distance, then
 * to a dial radius via the log scale, giving the screen position.
 */
export function guillochePoints(
	Ex: number,
	Ey: number,
	phi: number,
	rFrom: number,
	rTo: number,
	samples: number,
): { x: number; y: number }[] {
	const aEr = Math.atan2(Ey - CY, Ex - CX);
	const cosAe = Math.cos(aEr);
	const sinAe = Math.sin(aEr);
	const cosPhi = Math.cos(phi);
	const sinPhi = Math.sin(phi);
	const c = Math.cos(phi - aEr);

	// t at rTo: solves A*ln(|P_au(t)|) + B = rTo for the outward root.
	const dAuTo = Math.exp((rTo - B) / A);
	const discTo = dAuTo * dAuTo + c * c - 1;
	if (discTo < 0) return [];
	const tMax = -c + Math.sqrt(discTo);
	if (tMax <= 0) return [];

	// t at rFrom: first t where the outward curve reaches rFrom (may be > 0 for
	// inner-orbit directions where the curve dips below Earth's orbit first).
	const dAuFrom = Math.exp((rFrom - B) / A);
	const discFrom = dAuFrom * dAuFrom + c * c - 1;
	const tStart = discFrom >= 0 ? Math.max(0, -c + Math.sqrt(discFrom)) : 0;

	const points: { x: number; y: number }[] = [];

	for (let s = 0; s <= samples; s++) {
		const t = tStart + ((tMax - tStart) * s) / samples;
		const px = cosAe + t * cosPhi;
		const py = sinAe + t * sinPhi;
		const dAu = Math.sqrt(px * px + py * py);
		if (dAu < 1e-6) continue;
		const rD = A * Math.log(dAu) + B;
		if (rD < rFrom - 0.5 || rD > rTo + 0.5) continue;
		const theta = Math.atan2(py, px);
		points.push({
			x: +(CX + rD * Math.cos(theta)).toFixed(1),
			y: +(CY + rD * Math.sin(theta)).toFixed(1),
		});
	}

	return points;
}

export function pointsToPathD(points: { x: number; y: number }[]): string {
	let d = "";
	for (let i = 0; i < points.length; i++) {
		d += `${i === 0 ? "M" : " L"}${points[i].x},${points[i].y}`;
	}
	return d;
}

export function guillochePathD(
	Ex: number,
	Ey: number,
	phi: number,
	rFrom: number,
	rTo: number,
	samples: number,
): string {
	return pointsToPathD(guillochePoints(Ex, Ey, phi, rFrom, rTo, samples));
}

/**
 * Signed angular distance from `center` to `phi`, wrapped to [-π, π]. Used to
 * test whether a guilloche direction falls inside the twilight exclusion band.
 */
function angDelta(phi: number, center: number): number {
	let d = (((phi - center) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
	if (d > Math.PI) d -= 2 * Math.PI;
	return d;
}

/**
 * Compute n phi values whose heliocentric display angles at refR are uniformly
 * spaced. Corrects for the log-scale angular compression that otherwise causes
 * density artifacts near the Earth-Sun axis.
 */
function uniformPhis(n: number, aEr: number, refR: number): number[] {
	const FINE = n * 24;
	const dAuRef = Math.exp((refR - B) / A);
	const cosAer = Math.cos(aEr);
	const sinAer = Math.sin(aEr);

	const fineTheta: number[] = new Array(FINE);
	for (let i = 0; i < FINE; i++) {
		const phi = (i / FINE) * 2 * Math.PI;
		const cosPhi = Math.cos(phi);
		const sinPhi = Math.sin(phi);
		const c = cosAer * cosPhi + sinAer * sinPhi;
		const disc = dAuRef * dAuRef + c * c - 1;
		const t = disc >= 0 ? -c + Math.sqrt(disc) : 0;
		const px = cosAer + t * cosPhi;
		const py = sinAer + t * sinPhi;
		fineTheta[i] = Math.atan2(py, px);
	}

	// Unwrap to make theta monotone across the 0/2π boundary.
	for (let i = 1; i < FINE; i++) {
		const diff = fineTheta[i] - fineTheta[i - 1];
		if (diff > Math.PI) fineTheta[i] -= 2 * Math.PI;
		else if (diff < -Math.PI) fineTheta[i] += 2 * Math.PI;
	}

	const tMin = fineTheta[0];
	const tSpan = fineTheta[FINE - 1] - tMin;

	const phis: number[] = [];
	let fi = 0;
	for (let j = 0; j < n; j++) {
		const target = tMin + (j / n) * tSpan;
		while (fi < FINE - 2 && fineTheta[fi + 1] < target) fi++;
		const t0 = fineTheta[fi];
		const t1 = fineTheta[fi + 1] ?? t0;
		const frac = t1 > t0 ? (target - t0) / (t1 - t0) : 0;
		phis.push(((fi + frac) / FINE) * 2 * Math.PI);
	}
	return phis;
}

export function updateGuilloche(
	svg: SVGSVGElement,
	Ex: number,
	Ey: number,
	n: number,
	visible: boolean,
	// Twilight exclusion band, in the same phi frame as the curves. Any line
	// whose direction lies within `exHalf` of `exCenter` is dropped entirely so
	// it never crosses the twilight zone. A negative `exHalf` disables the band.
	exCenter = 0,
	exHalf = -1,
): void {
	const host = svg.querySelector<SVGGElement>("#guilloche");
	if (!host) return;

	if (!visible) return;

	if (
		Math.abs(Ex - _cacheEx) < 0.05 &&
		Math.abs(Ey - _cacheEy) < 0.05 &&
		n === _cacheN &&
		exCenter === _cacheExC &&
		exHalf === _cacheExH
	)
		return;

	_cacheEx = Ex;
	_cacheEy = Ey;
	_cacheN = n;
	_cacheExC = exCenter;
	_cacheExH = exHalf;

	const excluded = (phi: number) =>
		exHalf >= 0 && Math.abs(angDelta(phi, exCenter)) <= exHalf;

	while (host.firstChild) host.removeChild(host.firstChild);

	const aEr = Math.atan2(Ey - CY, Ex - CX);

	function addLine(d: string) {
		if (!d) return;
		const p = document.createElementNS(SVGNS, "path");
		p.setAttribute("class", "guilloche-line");
		p.setAttribute("d", d);
		host?.appendChild(p);
	}

	// Main curves: uniformly spaced in display angle at Mars orbit, traced from
	// Earth's orbit (B) to zodiac inner edge (MAX_R).
	const phis = uniformPhis(n, aEr, R_MARS);
	for (const phi of phis) {
		if (excluded(phi)) continue;
		addLine(guillochePathD(Ex, Ey, phi, B, MAX_R, SAMPLES));
	}

	// Inner curves: same phis, traced from sun disc (R_SUN) to Earth's orbit (B).
	// Only sunward-half directions (c < 0) produce paths; others return "".
	for (const phi of phis) {
		if (excluded(phi)) continue;
		addLine(guillochePathD(Ex, Ey, phi, R_SUN, B, SAMPLES));
	}

	// Outer-only curves at angles interleaved between the main curves, traced
	// from Mars orbit to the zodiac inner edge. Doubles the visual density in the
	// outer solar system where the log scale spreads features apart.
	for (let i = 0; i < n; i++) {
		const phi0 = phis[i];
		let phi1 = phis[(i + 1) % n];
		// Handle the wrap from ~2π back to ~0.
		if (phi1 < phi0) phi1 += 2 * Math.PI;
		const mid = ((phi0 + phi1) / 2) % (2 * Math.PI);
		if (excluded(mid)) continue;
		addLine(guillochePathD(Ex, Ey, mid, R_MARS, MAX_R, Math.ceil(SAMPLES / 2)));
	}
}
