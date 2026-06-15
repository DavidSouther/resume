const SVGNS = "http://www.w3.org/2000/svg";
const CX = 500;
const CY = 500;

// Log-scale mapping constants verified against bodies.ts AU/r pairs.
const A = 69.5;
const B = 168.4;
const MAX_R = 468;
const SAMPLES = 60;

// Cache to skip recomputation when Earth hasn't moved.
let _cacheEx = Number.NaN;
let _cacheEy = Number.NaN;
let _cacheN = -1;

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
export function guillochePathD(
	Ex: number,
	Ey: number,
	phi: number,
	rFrom: number,
	rTo: number,
	samples: number,
): string {
	const aEr = Math.atan2(Ey - CY, Ex - CX);
	const cosAe = Math.cos(aEr);
	const sinAe = Math.sin(aEr);
	const cosPhi = Math.cos(phi);
	const sinPhi = Math.sin(phi);
	const c = Math.cos(phi - aEr);

	// t_max: geocentric distance where the dial radius reaches rTo.
	// Solves: A*ln(sqrt(1 + 2t*c + t²)) + B = rTo
	// → 1 + 2t*c + t² = dAuTo² → t = -c + sqrt(dAuTo² + c² - 1)
	const dAuTo = Math.exp((rTo - B) / A);
	const discTo = dAuTo * dAuTo + c * c - 1;
	if (discTo < 0) return "";
	const tMax = -c + Math.sqrt(discTo);
	if (tMax <= 0) return "";

	const parts: string[] = [];

	for (let s = 0; s <= samples; s++) {
		const t = (tMax * s) / samples;
		const px = cosAe + t * cosPhi;
		const py = sinAe + t * sinPhi;
		const dAu = Math.sqrt(px * px + py * py);
		if (dAu < 1e-6) continue;
		const rD = A * Math.log(dAu) + B;
		if (rD < rFrom || rD > rTo + 1) continue;
		const theta = Math.atan2(py, px);
		const sx = (CX + rD * Math.cos(theta)).toFixed(1);
		const sy = (CY + rD * Math.sin(theta)).toFixed(1);
		parts.push(`${parts.length === 0 ? "M" : "L"}${sx},${sy}`);
	}

	return parts.join(" ");
}

export function buildGuilloche(): void {
	// Group already created by buildDial(); nothing further needed at build time.
}

export function updateGuilloche(
	svg: SVGSVGElement,
	Ex: number,
	Ey: number,
	n: number,
	visible: boolean,
): void {
	const host = svg.querySelector<SVGGElement>("#guilloche");
	if (!host) return;

	if (!visible) {
		// Leave DOM as-is; CSS hide-guilloche class handles visibility.
		return;
	}

	// Skip if Earth hasn't moved and n hasn't changed.
	if (
		Math.abs(Ex - _cacheEx) < 0.05 &&
		Math.abs(Ey - _cacheEy) < 0.05 &&
		n === _cacheN
	)
		return;

	_cacheEx = Ex;
	_cacheEy = Ey;
	_cacheN = n;

	// Reuse existing path elements if count matches; otherwise rebuild.
	const existing = host.querySelectorAll("path");
	const rebuild = existing.length !== n;

	if (rebuild) {
		while (host.firstChild) host.removeChild(host.firstChild);
	}

	for (let i = 0; i < n; i++) {
		const phi = (i / n) * 2 * Math.PI;
		const d = guillochePathD(Ex, Ey, phi, B, MAX_R, SAMPLES);

		if (rebuild) {
			const path = document.createElementNS(SVGNS, "path");
			path.setAttribute("class", "guilloche-line");
			path.setAttribute("d", d);
			host.appendChild(path);
		} else {
			(existing[i] as SVGPathElement).setAttribute("d", d);
		}
	}
}
