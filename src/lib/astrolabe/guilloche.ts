const CX = 500;
const CY = 500;

const A = 69.5;
const B = 168.4; // Earth dial radius (1 AU)

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

	const dAuTo = Math.exp((rTo - B) / A);
	const discTo = dAuTo * dAuTo + c * c - 1;
	if (discTo < 0) return [];
	const tMax = -c + Math.sqrt(discTo);
	if (tMax <= 0) return [];

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

// Log-scale angular density helper: uniform phi values in display-angle at refR.
export function uniformPhis(n: number, aEr: number, refR: number): number[] {
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

// Signed angular distance wrapped to [-π, π].
export function angDelta(phi: number, center: number): number {
	let d = (((phi - center) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
	if (d > Math.PI) d -= 2 * Math.PI;
	return d;
}
