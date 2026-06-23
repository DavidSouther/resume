import {
	angDelta,
	guillochePathD,
	uniformPhis,
} from "../../lib/astrolabe/guilloche.ts";

export {
	guillochePoints,
	pointsToPathD,
} from "../../lib/astrolabe/guilloche.ts";

const SVGNS = "http://www.w3.org/2000/svg";
const R_MARS = 197.5;
const MAX_R = 422;
const SAMPLES = 50;
const R_SUN = 40;
const B = 168.4; // Earth dial radius (1 AU)

// Cache to skip recomputation when Earth hasn't moved.
let _cacheEx = Number.NaN;
let _cacheEy = Number.NaN;
let _cacheN = -1;
let _cacheExC = Number.NaN;
let _cacheExH = Number.NaN;

export function updateGuilloche(
	svg: SVGSVGElement,
	Ex: number,
	Ey: number,
	n: number,
	visible: boolean,
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

	const FADE = (10 * Math.PI) / 180;
	const opacityFor = (phi: number): number => {
		if (exHalf < 0) return 1;
		const delta = Math.abs(angDelta(phi, exCenter));
		if (delta <= exHalf - FADE / 2) return 0;
		if (delta >= exHalf + FADE / 2) return 1;
		return (delta - (exHalf - FADE / 2)) / FADE;
	};

	while (host.firstChild) host.removeChild(host.firstChild);

	const aEr = Math.atan2(Ey - 500, Ex - 500);

	function addLine(d: string, op: number) {
		if (!d || op <= 0) return;
		const p = document.createElementNS(SVGNS, "path");
		p.setAttribute("class", "guilloche-line");
		p.setAttribute("d", d);
		if (op < 1) p.setAttribute("opacity", op.toFixed(3));
		host?.appendChild(p);
	}

	const phis = uniformPhis(n, aEr, R_MARS);
	for (const phi of phis) {
		addLine(guillochePathD(Ex, Ey, phi, B, MAX_R, SAMPLES), opacityFor(phi));
	}
	for (const phi of phis) {
		addLine(guillochePathD(Ex, Ey, phi, R_SUN, B, SAMPLES), opacityFor(phi));
	}
	for (let i = 0; i < n; i++) {
		const phi0 = phis[i];
		let phi1 = phis[(i + 1) % n];
		if (phi1 < phi0) phi1 += 2 * Math.PI;
		const mid = ((phi0 + phi1) / 2) % (2 * Math.PI);
		addLine(
			guillochePathD(Ex, Ey, mid, R_MARS, MAX_R, Math.ceil(SAMPLES / 2)),
			opacityFor(mid),
		);
	}
}
