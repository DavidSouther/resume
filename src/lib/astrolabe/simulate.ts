// Pure per-frame projection for the Astrolabe dial. `simulate(input) -> Scene`
// computes every DOM string and flag the view needs, with no DOM access. The
// 60fps animation loop reads layout/clock/color through `FrameInput` and pushes
// the resulting `Scene` to the FCC tree via `stageRoot.update({ scene })`.
//
// This is the seam the project's design fixes: "what the frame is" (this pure
// module, fully unit-testable) is separated from "how it reaches the screen"
// (the FCC tree in src/components/astrolabe/view.ts). The two reference-branch
// holes are filled HERE: gradient-stop colors (via the injected `color`
// resolver) and the guilloche line list (ported from updateGuilloche).
import { range } from "@davidsouther/jiffies/range.ts";
import { BODIES, EARTH, EARTH_YEAR, SIGN_FULL } from "./bodies.ts";
import { geoDirection } from "./geocentric.ts";
import {
	caseOffsetPreservingRot,
	dialRotation,
	handAngles,
	helioA,
	pt,
} from "./math.ts";
import { type Config, type EarthMode, PTOLEMAIC } from "./types.ts";

const CX = 500;
const CY = 500;
const ZLAB = 445;
const GLYPH_S = 1.12;
const MAXPX = 16;
const EARTH_RATE = 360 / (EARTH.period * EARTH_YEAR);

// Ptolemaic geometry (mirrors animation.ts).
const R_SUN_DISC = 168.4;

// Guilloche curve constants (ported verbatim from guilloche.ts).
const GA = 69.5;
const GB = 168.4; // Earth dial radius (1 AU)
const G_R_MARS = 197.5;
const G_MAX_R = 422;
const G_SAMPLES = 50;
const G_R_SUN = 40;

// Zodiac band radii.
const ZIN = 422;
const ZOUT = 468;

// Full dial circle path — outer boundary of the evenodd guilloche clip.
const DIAL_CIRCLE = `M${CX} ${CY - 470} A470 470 0 1 1 ${CX - 0.01} ${CY - 470} Z`;

const MONTHS = [
	"JAN",
	"FEB",
	"MAR",
	"APR",
	"MAY",
	"JUN",
	"JUL",
	"AUG",
	"SEP",
	"OCT",
	"NOV",
	"DEC",
];

function fmtClock(d: Date): string {
	const hh = String(d.getHours()).padStart(2, "0");
	const mm = String(d.getMinutes()).padStart(2, "0");
	return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}  ·  ${hh}:${mm}`;
}

export interface FrameInput {
	config: Config;
	simT: number;
	bootMs: number;
	wallNow: Date;
	caseOffset: number;
	prevEarthMode: EarthMode;
	mouse: { nx: number; ny: number };
	interaction: {
		hovered?: string; // body key
		pinned?: string;
		hoveredSign?: number; // 0..11
		pinnedSign?: number;
		dragging: boolean;
	};
	layout: {
		rect: { left: number; top: number; width: number; height: number };
		viewport: { width: number; height: number };
	};
	color: (key: string) => string; // CSS-var resolver (getComputedStyle-backed; test stub)
}

export interface BodyScene {
	transform: string;
	world: { x: number; y: number; a: number };
}

export interface ZodiacSlice {
	wedgeD: string;
	arcD: string;
	dividerD: string;
	glyphTransform: string;
	active: boolean;
	gradientStops: { offset: string; color: string }[];
}

export interface Scene {
	bodies: Record<string, BodyScene>; // keyed by b.key (string)
	sun: { transform: string; hit: { x: number; y: number } };
	zhitsTransform: string;
	zodiac: ZodiacSlice[]; // length 12
	occupancy: Record<number, string[]>; // sign index -> body keys ("earth" first on sunSign)
	sunSign: number; // [0,12)
	visibility: { sunCenter: boolean; sunDisc: boolean; spokes: boolean };
	coneD: string;
	guilloche: { clipD: string; lines: { d: string; opacity?: number }[] };
	hands: { hourTransform: string; minuteTransform: string; visible: boolean };
	dateComplication: { x: number; y: number; month: string; day: string };
	simClock: string;
	realClock: string;
	tooltip: { shown: boolean; point: { x: number; y: number }; text: string };
	signCard: {
		shown: boolean;
		sign: number;
		occupants: string[];
		point: { x: number; y: number };
	};
	ptolemaic: boolean;
	next: { caseOffset: number; prevEarthMode: EarthMode };
}

// --- Guilloche helpers (ported from guilloche.ts; pure, DOM-free) ----------

function guillochePoints(
	Ex: number,
	Ey: number,
	phi: number,
	rFrom: number,
	rTo: number,
	samples: number,
): { x: number; y: number }[] {
	const earthAngle = Math.atan2(Ey - CY, Ex - CX);
	const cosEarth = Math.cos(earthAngle);
	const sinEarth = Math.sin(earthAngle);
	const cosPhi = Math.cos(phi);
	const sinPhi = Math.sin(phi);
	const cosRel = Math.cos(phi - earthAngle);

	const distAuTo = Math.exp((rTo - GB) / GA);
	const discTo = distAuTo * distAuTo + cosRel * cosRel - 1;
	if (discTo < 0) return [];
	const tMax = -cosRel + Math.sqrt(discTo);
	if (tMax <= 0) return [];

	const distAuFrom = Math.exp((rFrom - GB) / GA);
	const discFrom = distAuFrom * distAuFrom + cosRel * cosRel - 1;
	const tStart = discFrom >= 0 ? Math.max(0, -cosRel + Math.sqrt(discFrom)) : 0;

	return range(0, samples + 1)
		.map((s) => {
			const t = tStart + ((tMax - tStart) * s) / samples;
			const rayX = cosEarth + t * cosPhi;
			const rayY = sinEarth + t * sinPhi;
			const distAu = Math.sqrt(rayX * rayX + rayY * rayY);
			if (distAu < 1e-6) return null;
			const radius = GA * Math.log(distAu) + GB;
			if (radius < rFrom - 0.5 || radius > rTo + 0.5) return null;
			const theta = Math.atan2(rayY, rayX);
			return {
				x: +(CX + radius * Math.cos(theta)).toFixed(1),
				y: +(CY + radius * Math.sin(theta)).toFixed(1),
			};
		})
		.filter((p): p is { x: number; y: number } => p !== null);
}

function pointsToPathD(points: { x: number; y: number }[]): string {
	return points.map((p, i) => `${i === 0 ? "M" : " L"}${p.x},${p.y}`).join("");
}

function guillochePathD(
	Ex: number,
	Ey: number,
	phi: number,
	rFrom: number,
	rTo: number,
	samples: number,
): string {
	return pointsToPathD(guillochePoints(Ex, Ey, phi, rFrom, rTo, samples));
}

function angDelta(phi: number, center: number): number {
	let d = (((phi - center) % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
	if (d > Math.PI) d -= 2 * Math.PI;
	return d;
}

function uniformPhis(n: number, earthAngle: number, refR: number): number[] {
	const FINE = n * 24;
	const distAuRef = Math.exp((refR - GB) / GA);
	const cosEarth = Math.cos(earthAngle);
	const sinEarth = Math.sin(earthAngle);

	const fineTheta = range(0, FINE).map((i) => {
		const phi = (i / FINE) * 2 * Math.PI;
		const cosPhi = Math.cos(phi);
		const sinPhi = Math.sin(phi);
		const cosRel = cosEarth * cosPhi + sinEarth * sinPhi;
		const disc = distAuRef * distAuRef + cosRel * cosRel - 1;
		const t = disc >= 0 ? -cosRel + Math.sqrt(disc) : 0;
		const rayX = cosEarth + t * cosPhi;
		const rayY = sinEarth + t * sinPhi;
		return Math.atan2(rayY, rayX);
	});

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

// The guilloche line/opacity list (FILLED HOLE #2). Ported from
// updateGuilloche's addLine loop, emitting { d, opacity? } data instead of
// appending <path> elements. The module-level frame cache and the early-return
// short-circuit are dropped: the view reconciles by nodeName, so re-emitting an
// identical list patches the existing paths in place with no cost worth caching.
function guillocheLines(
	Ex: number,
	Ey: number,
	n: number,
	visible: boolean,
	exCenter: number,
	exHalf: number,
): { d: string; opacity?: number }[] {
	const lines: { d: string; opacity?: number }[] = [];
	if (!visible) return lines;

	const FADE = (10 * Math.PI) / 180;
	const opacityFor = (phi: number): number => {
		if (exHalf < 0) return 1;
		const delta = Math.abs(angDelta(phi, exCenter));
		if (delta <= exHalf - FADE / 2) return 0;
		if (delta >= exHalf + FADE / 2) return 1;
		return (delta - (exHalf - FADE / 2)) / FADE;
	};

	const add = (d: string, op: number) => {
		if (!d || op <= 0) return;
		if (op < 1) lines.push({ d, opacity: +op.toFixed(3) });
		else lines.push({ d });
	};

	const earthAngle = Math.atan2(Ey - CY, Ex - CX);

	const phis = uniformPhis(n, earthAngle, G_R_MARS);
	for (const phi of phis) {
		add(guillochePathD(Ex, Ey, phi, GB, G_MAX_R, G_SAMPLES), opacityFor(phi));
	}
	for (const phi of phis) {
		add(guillochePathD(Ex, Ey, phi, G_R_SUN, GB, G_SAMPLES), opacityFor(phi));
	}
	for (let i = 0; i < n; i++) {
		const phi0 = phis[i];
		let phi1 = phis[(i + 1) % n];
		if (phi1 < phi0) phi1 += 2 * Math.PI;
		const mid = ((phi0 + phi1) / 2) % (2 * Math.PI);
		add(
			guillochePathD(Ex, Ey, mid, G_R_MARS, G_MAX_R, Math.ceil(G_SAMPLES / 2)),
			opacityFor(mid),
		);
	}
	return lines;
}

// Gradient stops for one zodiac sign's occupants (FILLED HOLE #1). The colors
// are resolved through the injected `color()` resolver, so the pure layer never
// touches getComputedStyle.
function gradientStopsFor(
	keys: string[],
	color: (key: string) => string,
): { offset: string; color: string }[] {
	if (keys.length === 0) return [];
	if (keys.length === 1) {
		const col = color(keys[0]);
		return [
			{ offset: "0%", color: col },
			{ offset: "100%", color: col },
		];
	}
	return keys.map((k, i) => ({
		offset: `${((i / (keys.length - 1)) * 100).toFixed(1)}%`,
		color: color(k),
	}));
}

export function simulate(input: FrameInput): Scene {
	const cfg = input.config;
	const simT = input.simT;
	const ptolemaic = cfg.earthMode === PTOLEMAIC;

	const aE = (((EARTH.start + EARTH_RATE * simT) % 360) + 360) % 360;

	// Fold caseOffset/prevEarthMode forward on a mode switch.
	let caseOffset = input.caseOffset;
	let prevEarthMode = input.prevEarthMode;
	if (cfg.earthMode !== prevEarthMode) {
		caseOffset = caseOffsetPreservingRot(
			prevEarthMode,
			cfg.earthMode,
			aE,
			caseOffset,
		);
		prevEarthMode = cfg.earthMode;
	}

	const rot = dialRotation(cfg.earthMode, aE, caseOffset);

	const bodies: Record<string, BodyScene> = {};
	const world: Record<string, { x: number; y: number; a: number }> = {
		sun: { x: CX, y: CY, a: 0 },
	};

	const parallaxOn = cfg.parallaxOn ? 1 : 0;
	for (const b of BODIES) {
		const a = ptolemaic ? geoDirection(b, simT) : helioA(b, simT);
		const earthCentered = ptolemaic && b.key === "earth";
		const r = earthCentered ? 0 : b.r;
		const da = (((a + rot) % 360) + 360) % 360;
		const rad = (da * Math.PI) / 180;

		if (b.moon) {
			const e = world.earth ?? { x: CX, y: CY, a: 0 };
			bodies[b.key] = {
				transform: `translate(${e.x.toFixed(2)} ${e.y.toFixed(2)}) rotate(${da.toFixed(3)} 0 0)`,
				world: {
					x: e.x + b.r * Math.cos(rad),
					y: e.y + b.r * Math.sin(rad),
					a: da,
				},
			};
			world[b.key] = bodies[b.key].world;
		} else {
			const px = input.mouse.nx * MAXPX * cfg.parallax * b.weight * parallaxOn;
			const py = input.mouse.ny * MAXPX * cfg.parallax * b.weight * parallaxOn;
			const transform = earthCentered
				? `translate(${(px - b.r).toFixed(2)} ${py.toFixed(2)})`
				: `translate(${px.toFixed(2)} ${py.toFixed(2)}) rotate(${da.toFixed(3)} ${CX} ${CY})`;
			bodies[b.key] = {
				transform,
				world: {
					x: CX + r * Math.cos(rad) + px,
					y: CY + r * Math.sin(rad) + py,
					a: da,
				},
			};
			world[b.key] = bodies[b.key].world;
		}
	}

	// Ptolemaic sun disc + hit.
	let sunTransform = `rotate(0 ${CX} ${CY})`;
	let sunHit = { x: CX, y: CY };
	if (ptolemaic) {
		const sa = (((aE + 180 + rot) % 360) + 360) % 360;
		const srad = (sa * Math.PI) / 180;
		sunTransform = `rotate(${sa.toFixed(3)} ${CX} ${CY})`;
		world.sun = {
			x: CX + R_SUN_DISC * Math.cos(srad),
			y: CY + R_SUN_DISC * Math.sin(srad),
			a: sa,
		};
		sunHit = { x: +world.sun.x.toFixed(2), y: +world.sun.y.toFixed(2) };
	} else {
		world.sun = { x: CX, y: CY, a: 0 };
		sunHit = { x: CX, y: CY };
	}

	const zhitsTransform = `rotate(${rot.toFixed(3)} ${CX} ${CY})`;

	// Geocentric directions (true sky) -> occupancy.
	const earthAngleRad = (aE * Math.PI) / 180;
	const earthX = Math.cos(earthAngleRad);
	const earthY = Math.sin(earthAngleRad);
	const geo: Record<string, { g: number; si: number; deg: number }> = {};

	function setGeo(key: string, gScreen: number) {
		const g = ((gScreen % 360) + 360) % 360;
		const lon = (((g + 90) % 360) + 360) % 360;
		geo[key] = { g, si: Math.floor(lon / 30), deg: Math.floor(lon % 30) };
	}

	setGeo("sun", aE + 180);
	for (const b of BODIES) {
		if (b.key === "earth") continue;
		const a = helioA(b, simT);
		if (b.moon) {
			setGeo("moon", a);
		} else {
			const bodyAngleRad = (a * Math.PI) / 180;
			const au = b.au ?? 1;
			setGeo(
				b.key,
				(Math.atan2(
					au * Math.sin(bodyAngleRad) - earthY,
					au * Math.cos(bodyAngleRad) - earthX,
				) *
					180) /
					Math.PI,
			);
		}
	}
	geo.earth = geo.sun;

	const occupancy: Record<number, string[]> = {};
	const sunSign = geo.sun.si;
	occupancy[sunSign] = occupancy[sunSign] ?? [];
	occupancy[sunSign].push("earth");
	for (const b of BODIES) {
		if (b.key === "earth" || b.moon) continue;
		const si = geo[b.key]?.si ?? 0;
		occupancy[si] = occupancy[si] ?? [];
		occupancy[si].push(b.key);
	}

	const Ex = world.earth?.x ?? CX;
	const Ey = world.earth?.y ?? CY;
	const ew = ptolemaic ? world.sun : world.earth;

	// Twilight cone (informs the guilloche fade band too).
	const R_SUN = 40;
	const MAX_R = 422;
	const hw = (12.5 * Math.PI) / 180;
	let exCenter = 0;
	let exHalf = -1;
	let coneD = "";
	if (ew && !ptolemaic) {
		const ds = Math.atan2(CY - ew.y, CX - ew.x);
		exCenter = ds;
		if (cfg.twilight) exHalf = hw;
		const edgeA = guillochePoints(Ex, Ey, ds - hw, R_SUN, MAX_R, 40);
		const edgeB = guillochePoints(Ex, Ey, ds + hw, R_SUN, MAX_R, 40);
		if (cfg.twilight && edgeA.length >= 2 && edgeB.length >= 2) {
			const bOut = edgeB[edgeB.length - 1];
			let d = `M${ew.x.toFixed(1)} ${ew.y.toFixed(1)}`;
			for (const p of edgeA) d += ` L${p.x} ${p.y}`;
			d += ` A${MAX_R} ${MAX_R} 0 0 1 ${bOut.x} ${bOut.y}`;
			for (let k = edgeB.length - 1; k >= 0; k--)
				d += ` L${edgeB[k].x} ${edgeB[k].y}`;
			d += " Z";
			coneD = d;
		}
	}

	// Guilloche.
	const guillocheLineList = guillocheLines(
		Ex,
		Ey,
		cfg.guillocheN,
		cfg.guilloche && !ptolemaic,
		exCenter,
		exHalf,
	);

	// Zodiac dividers / wedges / arcs (curved). bpts[j] is boundary j's polyline.
	const bpts = range(0, 12).map((j) => {
		const clockDeg = j * 30 + rot;
		const phi = ((-90 + clockDeg) * Math.PI) / 180;
		const pts = ptolemaic ? [] : guillochePoints(Ex, Ey, phi, ZIN, ZOUT, 6);
		return pts.length < 2 ? [pt(clockDeg, ZIN), pt(clockDeg, ZOUT)] : pts;
	});

	const zodiac: ZodiacSlice[] = range(0, 12).map((i) => {
		const a = bpts[i];
		const b = bpts[(i + 1) % 12];
		const aIn = a[0];
		const bIn = b[0];
		const bOut = b[b.length - 1];
		const wedgeD =
			`M${aIn.x} ${aIn.y}` +
			a
				.slice(1)
				.map((p) => ` L${p.x} ${p.y}`)
				.join("") +
			` A${ZOUT} ${ZOUT} 0 0 1 ${bOut.x} ${bOut.y}` +
			b
				.slice(0, -1)
				.reverse()
				.map((p) => ` L${p.x} ${p.y}`)
				.join("") +
			` A${ZIN} ${ZIN} 0 0 0 ${aIn.x} ${aIn.y} Z`;

		const arcD = `M${aIn.x} ${aIn.y} A${ZIN} ${ZIN} 0 0 1 ${bIn.x} ${bIn.y}`;
		const dividerD = pointsToPathD(bpts[i]);

		const keys = occupancy[i];
		const active = !!keys;
		const lc = (i * 30 + 15 + rot) % 360;
		const gp = pt(lc, ZLAB);
		const glyphTransform = `translate(${gp.x.toFixed(2)} ${gp.y.toFixed(2)}) scale(${GLYPH_S}) translate(-12 -12)`;
		const gradientStops = active ? gradientStopsFor(keys, input.color) : [];

		return {
			wedgeD,
			arcD,
			dividerD,
			glyphTransform,
			active,
			gradientStops,
		};
	});

	// Hands (real clock).
	const handsA = handAngles(input.wallNow);
	const hands = {
		hourTransform: `rotate(${handsA.hour.toFixed(2)} ${CX} ${CY})`,
		minuteTransform: `rotate(${handsA.minute.toFixed(2)} ${CX} ${CY})`,
		visible: !input.interaction.dragging,
	};

	// Sim clock + date complication.
	const d = new Date(input.bootMs + simT * 1000);
	const dx = ew?.x ?? CX;
	const dy = ew?.y ?? CY;
	const dateComplication = {
		x: +dx.toFixed(1),
		y: dy,
		month: MONTHS[d.getMonth()],
		day: String(d.getDate()),
	};
	const simClock = fmtClock(d);
	const realClock = fmtClock(input.wallNow);

	// Tooltip.
	const showKey = input.interaction.pinned ?? input.interaction.hovered;
	let tooltip = {
		shown: false,
		point: { x: 0, y: 0 },
		text: "",
	};
	if (showKey) {
		const w = world[showKey] ?? { x: CX, y: CY, a: 0 };
		const sc = input.layout.rect.width / 1000;
		const s = geo[showKey];
		const name = nameFor(showKey);
		tooltip = {
			shown: true,
			point: {
				x: input.layout.rect.left + w.x * sc,
				y: input.layout.rect.top + w.y * sc,
			},
			text: s ? `${name}  ·  ${SIGN_FULL[s.si]} ${s.deg}°` : name,
		};
	}

	// Sign card.
	const curSign =
		input.interaction.pinnedSign ?? input.interaction.hoveredSign ?? -1;
	const wantCard = cfg.occ && curSign >= 0;
	let signCard = {
		shown: false,
		sign: 0,
		occupants: [] as string[],
		point: { x: 0, y: 0 },
	};
	if (wantCard) {
		const cp = pt((((curSign * 30 + 15 + rot) % 360) + 360) % 360, ZLAB);
		const scl = input.layout.rect.width / 1000;
		signCard = {
			shown: true,
			sign: curSign,
			occupants: occupancy[curSign] ?? [],
			point: {
				x: input.layout.rect.left + cp.x * scl,
				y: input.layout.rect.top + cp.y * scl,
			},
		};
	}

	return {
		bodies,
		sun: { transform: sunTransform, hit: sunHit },
		zhitsTransform,
		zodiac,
		occupancy,
		sunSign,
		visibility: {
			sunCenter: !ptolemaic,
			sunDisc: ptolemaic,
			spokes: ptolemaic,
		},
		coneD,
		guilloche: { clipD: DIAL_CIRCLE, lines: guillocheLineList },
		hands,
		dateComplication,
		simClock,
		realClock,
		tooltip,
		signCard,
		ptolemaic,
		next: { caseOffset, prevEarthMode },
	};
}

// Body display name for the tooltip (the loop's `show.name`, derived from the
// body key — uppercase, like BODIES[].name / "SUN").
function nameFor(key: string): string {
	return key.toUpperCase();
}
