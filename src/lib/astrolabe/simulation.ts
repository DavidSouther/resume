import { BODIES, EARTH, EARTH_YEAR, SIGN_FULL } from "./bodies.ts";
import { geoDirection } from "./geocentric.ts";
import { guillochePoints, pointsToPathD } from "./guilloche.ts";
import {
	caseOffsetPreservingRot,
	dialRotation,
	handAngles,
	helioA,
	pt,
} from "./math.ts";
import {
	type BodyName,
	type Config,
	type EarthMode,
	PTOLEMAIC,
} from "./types.ts";

export type Vec = { x: number; y: number; a: number };
export type ScreenPoint = { x: number; y: number };
export type GradientStop = { offset: string; color: string };

export interface FrameInput {
	config: Config;
	simT: number;
	bootMs: number;
	wallNow: Date;
	caseOffset: number;
	prevEarthMode: EarthMode;
	mouse: { nx: number; ny: number };
	interaction: {
		hovered: { key: BodyName | "sun"; name: string } | null;
		pinned: { key: BodyName | "sun"; name: string } | null;
		hoveredSign: number | null;
		pinnedSign: number | null;
		dragging: boolean;
	};
	layout: {
		rect: { left: number; top: number; width: number; height: number };
		viewport: { width: number; height: number };
	};
}

export interface FrameState {
	ptolemaic: boolean;
	rootClass: string[];
	bodies: Record<BodyName, { transform: string; world: Vec }>;
	sun: { discTransform: string; hit: { cx: number; cy: number }; world: Vec };
	zhitsTransform: string;
	zodiac: Array<{
		wedgeD: string;
		arcD: string;
		dividerD: string;
		glyphTransform: string;
		active: boolean;
		gradientStops: GradientStop[];
	}>;
	occupancy: Record<number, BodyName[]>;
	sunSign: number;
	visibility: { sunCenter: boolean; sunDisc: boolean; spokes: boolean };
	coneD: string;
	guilloche: { clipD: string; lines: Array<{ d: string; opacity?: number }> };
	hands: { hourTransform: string; minuteTransform: string; visible: boolean };
	dateComplication: { x: number; y: number; month: string; day: string };
	simClock: string;
	realClock: string;
	tooltip: { shown: boolean; point: ScreenPoint; text: string };
	signCard: {
		shown: boolean;
		sign: number;
		occupants: string[];
		point: ScreenPoint;
	};
	next: { caseOffset: number; prevEarthMode: EarthMode };
}

const CX = 500;
const CY = 500;
const ZLAB = 445;
const GLYPH_S = 1.12;
const MAXPX = 16;
const ZIN = 422;
const ZOUT = 468;
const R_SUN_DISC = 168.4;
const EARTH_RATE = 360 / (EARTH.period * EARTH_YEAR);
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

export function simulateFrame(input: FrameInput): FrameState {
	const { config: cfg, simT, mouse, interaction, layout } = input;

	const aE = (((EARTH.start + EARTH_RATE * simT) % 360) + 360) % 360;

	// The rotation formula differs between modes; absorb the difference into
	// caseOffset so the dial angle is continuous across a switch.
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
	const ptolemaic = cfg.earthMode === PTOLEMAIC;

	const bodies = {} as Record<BodyName, { transform: string; world: Vec }>;
	const world: Record<string, Vec> = { sun: { x: CX, y: CY, a: 0 } };
	const on = cfg.parallaxOn ? 1 : 0;

	for (const b of BODIES.values()) {
		const a = ptolemaic ? geoDirection(b, simT) : helioA(b, simT);
		const earthCentered = ptolemaic && b.key === "earth";
		const r = earthCentered ? 0 : b.r;
		const da = (((a + rot) % 360) + 360) % 360;
		const rad = (da * Math.PI) / 180;

		let transform: string;
		let w: Vec;

		if (b.moon) {
			const e = world.earth ?? { x: CX, y: CY, a: 0 };
			transform = `translate(${e.x.toFixed(2)} ${e.y.toFixed(2)}) rotate(${da.toFixed(3)} 0 0)`;
			w = {
				x: e.x + b.r * Math.cos(rad),
				y: e.y + b.r * Math.sin(rad),
				a: da,
			};
		} else {
			const px = mouse.nx * MAXPX * cfg.parallax * b.weight * on;
			const py = mouse.ny * MAXPX * cfg.parallax * b.weight * on;
			transform = earthCentered
				? `translate(${(px - b.r).toFixed(2)} ${py.toFixed(2)})`
				: `translate(${px.toFixed(2)} ${py.toFixed(2)}) rotate(${da.toFixed(3)} ${CX} ${CY})`;
			w = {
				x: CX + r * Math.cos(rad) + px,
				y: CY + r * Math.sin(rad) + py,
				a: da,
			};
		}

		bodies[b.key] = { transform, world: w };
		world[b.key] = w;
	}

	let sunDiscTransform: string;
	let sunHit: { cx: number; cy: number };
	let sunWorld: Vec;

	if (ptolemaic) {
		const sa = (((aE + 180 + rot) % 360) + 360) % 360;
		const srad = (sa * Math.PI) / 180;
		sunDiscTransform = `rotate(${sa.toFixed(3)} ${CX} ${CY})`;
		sunWorld = {
			x: CX + R_SUN_DISC * Math.cos(srad),
			y: CY + R_SUN_DISC * Math.sin(srad),
			a: sa,
		};
		sunHit = { cx: +sunWorld.x.toFixed(2), cy: +sunWorld.y.toFixed(2) };
		world.sun = sunWorld;
	} else {
		sunDiscTransform = "";
		sunWorld = { x: CX, y: CY, a: 0 };
		sunHit = { cx: CX, cy: CY };
	}

	const zhitsTransform = `rotate(${rot.toFixed(3)} ${CX} ${CY})`;

	const aErad = (aE * Math.PI) / 180;
	const exh = Math.cos(aErad);
	const eyh = Math.sin(aErad);
	const geo: Record<string, { si: number; deg: number; g: number }> = {};

	function setGeo(key: string, gScreen: number) {
		const g = ((gScreen % 360) + 360) % 360;
		const lon = (((g + 90) % 360) + 360) % 360;
		geo[key] = { g, si: Math.floor(lon / 30), deg: Math.floor(lon % 30) };
	}

	setGeo("sun", aE + 180);
	for (const b of BODIES.values()) {
		if (b.key === "earth") continue;
		const a = helioA(b, simT);
		if (b.moon) {
			setGeo("moon", a);
		} else {
			const ar = (a * Math.PI) / 180;
			const au = b.au ?? 1;
			setGeo(
				b.key,
				(Math.atan2(au * Math.sin(ar) - eyh, au * Math.cos(ar) - exh) * 180) /
					Math.PI,
			);
		}
	}
	geo.earth = geo.sun;

	// Occupancy: sun-direction sign is always labelled "earth".
	const occupancy = {} as Record<number, BodyName[]>;
	const sunSign = geo.sun.si;
	occupancy[sunSign] = occupancy[sunSign] ?? [];
	occupancy[sunSign].push("earth");
	for (const b of BODIES.values()) {
		if (b.key === "earth" || b.moon) continue;
		const si = geo[b.key]?.si ?? 0;
		occupancy[si] = occupancy[si] ?? [];
		occupancy[si].push(b.key);
	}

	const Ex = world.earth?.x ?? CX;
	const Ey = world.earth?.y ?? CY;

	const bpts: { x: number; y: number }[][] = [];
	for (let j = 0; j < 12; j++) {
		const clockDeg = j * 30 + rot;
		const phi = ((-90 + clockDeg) * Math.PI) / 180;
		let pts = ptolemaic ? [] : guillochePoints(Ex, Ey, phi, ZIN, ZOUT, 6);
		if (pts.length < 2) pts = [pt(clockDeg, ZIN), pt(clockDeg, ZOUT)];
		bpts.push(pts);
	}

	const zodiac = Array.from({ length: 12 }, (_, i) => {
		const a = bpts[i];
		const b = bpts[(i + 1) % 12];
		const aIn = a[0];
		const bIn = b[0];
		const bOut = b[b.length - 1];

		let wedgeD = `M${aIn.x} ${aIn.y}`;
		for (let k = 1; k < a.length; k++) wedgeD += ` L${a[k].x} ${a[k].y}`;
		wedgeD += ` A${ZOUT} ${ZOUT} 0 0 1 ${bOut.x} ${bOut.y}`;
		for (let k = b.length - 2; k >= 0; k--) wedgeD += ` L${b[k].x} ${b[k].y}`;
		wedgeD += ` A${ZIN} ${ZIN} 0 0 0 ${aIn.x} ${aIn.y} Z`;

		const arcD = `M${aIn.x} ${aIn.y} A${ZIN} ${ZIN} 0 0 1 ${bIn.x} ${bIn.y}`;

		const dividerD = pointsToPathD(a);

		const lc = (i * 30 + 15 + rot) % 360;
		const gp = pt(lc, ZLAB);
		const glyphTransform = `translate(${gp.x.toFixed(2)} ${gp.y.toFixed(2)}) scale(${GLYPH_S}) translate(-12 -12)`;

		const active = !!occupancy[i];
		const gradientStops: GradientStop[] = []; // filled by view from occupancy color tokens

		return { wedgeD, arcD, dividerD, glyphTransform, active, gradientStops };
	});

	const R_SUN_R = 40;
	const MAX_R = 422;
	const hw = (12.5 * Math.PI) / 180;
	let coneD = "";
	if (world.earth && !ptolemaic) {
		const ds = Math.atan2(CY - Ey, CX - Ex);
		const edgeA = guillochePoints(Ex, Ey, ds - hw, R_SUN_R, MAX_R, 40);
		const edgeB = guillochePoints(Ex, Ey, ds + hw, R_SUN_R, MAX_R, 40);
		if (cfg.twilight && edgeA.length >= 2 && edgeB.length >= 2) {
			const bOut = edgeB[edgeB.length - 1];
			coneD = `M${Ex.toFixed(1)} ${Ey.toFixed(1)}`;
			for (const p of edgeA) coneD += ` L${p.x} ${p.y}`;
			coneD += ` A${MAX_R} ${MAX_R} 0 0 1 ${bOut.x} ${bOut.y}`;
			for (let k = edgeB.length - 1; k >= 0; k--)
				coneD += ` L${edgeB[k].x} ${edgeB[k].y}`;
			coneD += " Z";
		}
	}

	// Watch hands (real clock, not sim).
	const handsAngles = handAngles(input.wallNow);
	const handsVisible = cfg.hands && !interaction.dragging;

	const simDate = new Date(input.bootMs + simT * 1000);
	const dateWorld = ptolemaic ? world.sun : world.earth;
	const dateX = dateWorld?.x ?? CX;
	const dateY = dateWorld?.y ?? CY;

	const show = interaction.pinned ?? interaction.hovered;
	let tooltip: FrameState["tooltip"];
	if (show) {
		const w = world[show.key] ?? { x: CX, y: CY };
		const sc = layout.rect.width / 1000;
		const point: ScreenPoint = {
			x: layout.rect.left + w.x * sc,
			y: layout.rect.top + w.y * sc,
		};
		const geoEntry = geo[show.key];
		const text = geoEntry
			? `${show.name}  ·  ${SIGN_FULL[geoEntry.si]} ${geoEntry.deg}°`
			: show.name;
		tooltip = { shown: true, point, text };
	} else {
		tooltip = { shown: false, point: { x: 0, y: 0 }, text: "" };
	}

	const curSign = interaction.pinnedSign ?? interaction.hoveredSign ?? -1;
	const wantCard = cfg.occ && curSign >= 0;
	let signCard: FrameState["signCard"];
	if (wantCard) {
		const lc = (((curSign * 30 + 15 + rot) % 360) + 360) % 360;
		const cp = pt(lc, ZLAB);
		const sc = layout.rect.width / 1000;
		const point: ScreenPoint = {
			x: layout.rect.left + cp.x * sc,
			y: layout.rect.top + cp.y * sc,
		};
		const ks = occupancy[curSign] ?? [];
		const occupants = ks.map((k) => k);
		signCard = { shown: true, sign: curSign, occupants, point };
	} else {
		signCard = { shown: false, sign: -1, occupants: [], point: { x: 0, y: 0 } };
	}

	return {
		ptolemaic,
		rootClass: ptolemaic ? ["ptolemaic"] : [],
		bodies,
		sun: { discTransform: sunDiscTransform, hit: sunHit, world: sunWorld },
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
		guilloche: { clipD: DIAL_CIRCLE, lines: [] },
		hands: {
			hourTransform: `rotate(${handsAngles.hour.toFixed(2)} ${CX} ${CY})`,
			minuteTransform: `rotate(${handsAngles.minute.toFixed(2)} ${CX} ${CY})`,
			visible: handsVisible,
		},
		dateComplication: {
			x: dateX,
			y: dateY,
			month: MONTHS[simDate.getMonth()],
			day: String(simDate.getDate()),
		},
		simClock: fmtClock(simDate),
		realClock: fmtClock(input.wallNow),
		tooltip,
		signCard,
		next: { caseOffset, prevEarthMode },
	};
}
