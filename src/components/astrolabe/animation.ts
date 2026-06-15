import { assertExists } from "@davidsouther/jiffies/assert.ts";
import { circle, stop, text } from "@davidsouther/jiffies/dom/svg.ts";
import {
	BODIES,
	EARTH,
	EARTH_YEAR,
	FULLNAME,
	GLYPHS,
	SIGN_FULL,
} from "../../lib/astrolabe/bodies.ts";
import {
	caseOffsetPreservingRot,
	dialAngle,
	dialRotation,
	displayedRate,
	dragTimeStep,
	handAngles,
	helioA,
	pt,
	simTimeForNow,
	wrap180,
	ZODIAC_DRAG_RATE,
} from "../../lib/astrolabe/math.ts";
import type { Config } from "../../lib/astrolabe/types.ts";
import {
	guillochePoints,
	pointsToPathD,
	updateGuilloche,
} from "./guilloche.ts";
import type { PlanetRefs } from "./planets.ts";
import type { ZodiacRefs } from "./zodiac.ts";

const CX = 500;
const CY = 500;
const ZLAB = 445;
const GLYPH_S = 1.12;
const MAXPX = 16;
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
const EARTH_RATE = 360 / (EARTH.period * EARTH_YEAR);

function fmtClock(d: Date): string {
	const hh = String(d.getHours()).padStart(2, "0");
	const mm = String(d.getMinutes()).padStart(2, "0");
	return `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}  ·  ${hh}:${mm}`;
}

function bodyColor(key: string): string {
	return (
		getComputedStyle(document.documentElement)
			.getPropertyValue(`--${key}`)
			.trim() || "#888"
	);
}

function setGradientStops(grad: Element, keys: string[]) {
	while (grad.firstChild) grad.removeChild(grad.firstChild);
	if (keys.length === 1) {
		const col = bodyColor(keys[0]);
		grad.appendChild(stop({ offset: "0%", "stop-color": col }));
		grad.appendChild(stop({ offset: "100%", "stop-color": col }));
	} else {
		for (let i = 0; i < keys.length; i++) {
			grad.appendChild(
				stop({
					offset: `${((i / (keys.length - 1)) * 100).toFixed(1)}%`,
					"stop-color": bodyColor(keys[i]),
				}),
			);
		}
	}
}

function glyphSVG(i: number, size: number): string {
	const paths = GLYPHS[i].map((d) => `<path d="${d}"/>`).join("");
	return `<svg class="sc-glyph" viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${paths}</svg>`;
}

export function startAnimation(
	svg: SVGSVGElement,
	zodiac: ZodiacRefs,
	planets: PlanetRefs,
	getConfig: () => Config,
): void {
	const { wedges, arcs, glyphs, grads, divs } = zodiac;
	const zhits = assertExists(
		svg.querySelector<SVGGElement>("#zhits"),
		"#zhits missing",
	);
	const simClock = document.getElementById("simClock") as HTMLDivElement;
	const realClock = document.getElementById("realClock") as HTMLDivElement;
	const tip = document.getElementById("tip") as HTMLDivElement;
	const signcard = document.getElementById("signcard") as HTMLDivElement;

	// All static dial elements (hands, bezel, gradients, cone) are pre-rendered
	// by buildDial() in the page module. Grab existing references.
	const handHour = assertExists(
		svg.querySelector<SVGPathElement>("#handHour"),
		"#handHour missing",
	);
	const handMin = assertExists(
		svg.querySelector<SVGPathElement>("#handMin"),
		"#handMin missing",
	);
	const handsGroup = assertExists(
		svg.querySelector<SVGGElement>("#hands"),
		"#hands missing",
	);
	const cone = assertExists(
		svg.querySelector<SVGPathElement>("#twilightCone"),
		"#twilightCone missing",
	);
	const guillocheClipPath = assertExists(
		svg.querySelector<SVGPathElement>("#guillocheClipPath"),
		"#guillocheClipPath missing",
	);
	// Full dial circle path — outer boundary of the evenodd clip
	const DIAL_CIRCLE = `M${CX} ${CY - 470} A470 470 0 1 1 ${CX - 0.01} ${CY - 470} Z`;

	// Date complication text (created here — not pre-rendered)
	const dateMonth = text({ class: "date-month" });
	svg.appendChild(dateMonth);
	const dateDay = text({ class: "date-day" });
	svg.appendChild(dateDay);

	// Sun hit target at centre
	const sunHit = circle({ class: "hit", cx: CX, cy: CY, r: 18 });
	svg.appendChild(sunHit);

	// Parallax mouse/touch tracking (normalized -1..1 from center)
	let mouseNX = 0;
	let mouseNY = 0;
	function updateMouse(cx: number, cy: number) {
		const r = svg.getBoundingClientRect();
		mouseNX = Math.max(
			-1,
			Math.min(1, (cx - (r.left + r.width / 2)) / (r.width / 2)),
		);
		mouseNY = Math.max(
			-1,
			Math.min(1, (cy - (r.top + r.height / 2)) / (r.height / 2)),
		);
	}
	svg.addEventListener("pointermove", (e) => updateMouse(e.clientX, e.clientY));
	svg.addEventListener("pointerleave", () => {
		mouseNX = 0;
		mouseNY = 0;
	});

	// Hover state
	let hovered: { key: string; name: string } | null = null;
	let pinned: { key: string; name: string } | null = null;
	let hoveredSign: number | null = null;
	let pinnedSign: number | null = null;

	function bindHover(el: Element, body: { key: string; name: string }) {
		el.addEventListener("pointerenter", () => {
			hovered = body;
		});
		el.addEventListener("pointerleave", () => {
			hovered = null;
		});
		el.addEventListener("click", (e) => {
			e.stopPropagation();
			if (dragMoved) {
				dragMoved = false;
				return;
			}
			pinned = pinned?.key === body.key ? null : body;
		});
	}

	function bindSignHover(el: Element, i: number) {
		el.addEventListener("pointerenter", () => {
			hoveredSign = i;
		});
		el.addEventListener("pointerleave", () => {
			hoveredSign = null;
		});
		el.addEventListener("click", (e) => {
			e.stopPropagation();
			if (dragMoved) {
				dragMoved = false;
				return;
			}
			pinned = null;
			pinnedSign = pinnedSign === i ? null : i;
		});
	}

	svg.addEventListener("pointerdown", () => {
		pinned = null;
		pinnedSign = null;
	});

	bindHover(sunHit, { key: "sun", name: "SUN" });
	for (let i = 0; i < zodiac.hits.length; i++) bindSignHover(zodiac.hits[i], i);
	for (const b of BODIES) {
		const group = planets[b.key];
		const hit = group?.querySelector(".hit");
		if (hit) bindHover(hit, { key: b.key, name: b.name });
	}

	// Live ephemeris via astronomy-engine (CDN script loaded in head)
	const bootMs = Date.now();
	function applyEphemeris(A: Record<string, unknown>) {
		try {
			const date = new Date(bootMs);
			for (const b of BODIES) {
				const rate = 360 / (b.period * EARTH_YEAR);
				let lon: number;
				if (b.moon) {
					lon = (A.EclipticGeoMoon as (d: Date) => { lon: number })(date).lon;
				} else {
					const key = b.key.charAt(0).toUpperCase() + b.key.slice(1);
					const Body = A.Body as Record<string, unknown>;
					if (!Body[key]) continue;
					lon = (A.EclipticLongitude as (body: unknown, date: Date) => number)(
						Body[key],
						date,
					);
				}
				b.start = (((lon - 90 - rate * 0) % 360) + 360) % 360;
			}
		} catch {
			// keep snapshot defaults
		}
	}

	const win = window as unknown as Record<string, unknown>;
	if (win.Astronomy) {
		applyEphemeris(win.Astronomy as Record<string, unknown>);
	}

	// Simulation state
	let simT = 0;
	let last = performance.now();

	// Drag-mode state. caseOffset rotates the whole dial (case re-aim); dragging
	// holds the active winding descriptor and suspends the clock while held.
	type DragKind = { time: true; R: number } | { time: false };
	let caseOffset = 0;
	// Tracks the earth-frame mode so a Stationary/Orbital switch can re-aim the
	// case and keep Earth at its current angle (see caseOffsetPreservingRot).
	let prevEarthFixed = getConfig().earthFixed;
	let dragging: {
		kind: DragKind;
		prevAngle: number;
		moved: boolean;
		acc: number;
	} | null = null;
	// Set on a moved drag's release so the trailing click does not toggle a pin.
	let dragMoved = false;
	let shownCardSig = "";
	let cardCX = 0;
	let cardCY = 0;
	const world: Record<string, { x: number; y: number; a: number }> = {};
	world.sun = { x: CX, y: CY, a: 0 };

	// Drag harness. dialAngle is scale-invariant, so raw client deltas from the
	// SVG center feed the winding directly. Threshold separates a drag from a tap.
	const MOVE_THRESH = 4; // accumulated degrees before a press counts as a drag
	function center(): { cx: number; cy: number } {
		const r = svg.getBoundingClientRect();
		return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
	}

	function bindDrag(el: Element, resolve: () => DragKind | null) {
		const cap = el as Element & {
			setPointerCapture(id: number): void;
			releasePointerCapture(id: number): void;
		};
		el.addEventListener("pointerdown", (e) => {
			const pe = e as PointerEvent;
			const kind = resolve();
			if (!kind) return;
			dragMoved = false;
			cap.setPointerCapture(pe.pointerId);
			// Hide the watch hands while winding; "" restores the controls'
			// hide-hands class logic on release.
			handsGroup.style.display = "none";
			const { cx, cy } = center();
			dragging = {
				kind,
				prevAngle: dialAngle(pe.clientX - cx, pe.clientY - cy),
				moved: false,
				acc: 0,
			};
		});
		el.addEventListener("pointermove", (e) => {
			if (!dragging) return;
			const pe = e as PointerEvent;
			const { cx, cy } = center();
			const theta = dialAngle(pe.clientX - cx, pe.clientY - cy);
			const dTheta = wrap180(theta - dragging.prevAngle);
			if (dragging.kind.time) simT += dragTimeStep(dTheta, dragging.kind.R);
			else caseOffset += dTheta;
			dragging.prevAngle = theta;
			dragging.acc += Math.abs(dTheta);
			if (dragging.acc > MOVE_THRESH) dragging.moved = true;
		});
		const end = (e: Event) => {
			if (!dragging) return;
			const pe = e as PointerEvent;
			try {
				cap.releasePointerCapture(pe.pointerId);
			} catch {
				// capture may already be released (e.g. pointercancel)
			}
			if (dragging.moved) dragMoved = true;
			dragging = null;
			handsGroup.style.display = "";
		};
		el.addEventListener("pointerup", end);
		el.addEventListener("pointercancel", end);
	}

	// Orbiting planets and Earth are draggable; Sun and Moon are not. Target
	// routing follows the design table, read live from getConfig().earthFixed.
	for (const b of BODIES) {
		if (b.moon) continue;
		const hit = planets[b.key]?.querySelector(".hit");
		if (!hit) continue;
		bindDrag(hit, () => {
			const ef = getConfig().earthFixed;
			if (b.key === "earth") {
				// earth-fixed: Earth re-aims the case; earth-free: Earth winds time.
				return ef
					? { time: false }
					: { time: true, R: displayedRate(b, false) };
			}
			return { time: true, R: displayedRate(b, ef) };
		});
		// Double-clicking Earth resets simulated time to the real system time.
		if (b.key === "earth") {
			hit.addEventListener("dblclick", () => {
				simT = simTimeForNow(bootMs, Date.now());
			});
		}
	}
	for (let i = 0; i < zodiac.hits.length; i++) {
		bindDrag(zodiac.hits[i], () =>
			// earth-fixed: band winds time at the simplified-year rate;
			// earth-free: band re-aims the case.
			getConfig().earthFixed
				? { time: true, R: ZODIAC_DRAG_RATE }
				: { time: false },
		);
	}

	function frame(now: number) {
		const cfg = getConfig();
		let dt = (now - last) / 1000;
		last = now;
		// While dragging, the clock is winding-driven only: contribute no wall-clock
		// time so releasing the body introduces no accumulated jump.
		if (dragging) dt = 0;
		else if (dt > 0.1) dt = 0.1;
		simT += dt * cfg.speed;

		const aE = (((EARTH.start + EARTH_RATE * simT) % 360) + 360) % 360;
		// On a Stationary/Orbital switch, re-aim the case so Earth keeps its
		// current angle instead of snapping by aE.
		if (cfg.earthFixed !== prevEarthFixed) {
			caseOffset = caseOffsetPreservingRot(cfg.earthFixed, aE, caseOffset);
			prevEarthFixed = cfg.earthFixed;
		}
		const rot = dialRotation(cfg.earthFixed, aE, caseOffset);

		for (const b of BODIES) {
			const a = helioA(b, simT);
			const da = (a + rot) % 360;
			const rad = (da * Math.PI) / 180;
			const group = planets[b.key];
			if (!group) continue;

			if (b.moon) {
				const e = world.earth ?? { x: CX, y: CY };
				group.setAttribute(
					"transform",
					`translate(${e.x.toFixed(2)} ${e.y.toFixed(2)}) rotate(${da.toFixed(3)} 0 0)`,
				);
				world[b.key] = {
					x: e.x + b.r * Math.cos(rad),
					y: e.y + b.r * Math.sin(rad),
					a: da,
				};
			} else {
				const on = cfg.parallaxOn ? 1 : 0;
				const px = mouseNX * MAXPX * cfg.parallax * b.weight * on;
				const py = mouseNY * MAXPX * cfg.parallax * b.weight * on;
				group.setAttribute(
					"transform",
					`translate(${px.toFixed(2)} ${py.toFixed(2)}) rotate(${da.toFixed(3)} ${CX} ${CY})`,
				);
				world[b.key] = {
					x: CX + b.r * Math.cos(rad) + px,
					y: CY + b.r * Math.sin(rad) + py,
					a: da,
				};
			}
		}

		zhits.setAttribute("transform", `rotate(${rot.toFixed(3)} ${CX} ${CY})`);

		// Geocentric directions (true sky)
		const aErad = (aE * Math.PI) / 180;
		const exh = Math.cos(aErad);
		const eyh = Math.sin(aErad);
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

		// Zodiac occupancy
		const occ: Record<number, string[]> = {};
		// The dial is heliocentric with Earth as a body; the occupant of the
		// sun-direction sign is presented as Earth, not the Sun.
		const sunSi = geo.sun.si;
		occ[sunSi] = occ[sunSi] ?? [];
		occ[sunSi].push("earth");
		for (const b of BODIES) {
			if (b.key === "earth" || b.moon) continue;
			const si = geo[b.key]?.si ?? 0;
			occ[si] = occ[si] ?? [];
			occ[si].push(b.key);
		}

		for (let i = 0; i < 12; i++) {
			const keys = occ[i];
			const lit = !!keys;
			wedges[i].classList.toggle("active", lit);
			arcs[i].classList.toggle("active", lit);
			glyphs[i].classList.toggle("active", lit);
			if (lit) setGradientStops(grads[i], keys);

			const lc = (i * 30 + 15 + rot) % 360;
			const gp = pt(lc, ZLAB);
			glyphs[i].setAttribute(
				"transform",
				`translate(${gp.x.toFixed(2)} ${gp.y.toFixed(2)}) scale(${GLYPH_S}) translate(-12 -12)`,
			);
		}

		// Sign card
		const curSign = pinnedSign ?? hoveredSign ?? -1;
		const want = cfg.occ && curSign >= 0;
		const cardSig = want ? `${curSign}:${(occ[curSign] ?? []).join(",")}` : "";
		if (want) {
			if (cardSig !== shownCardSig) {
				const ks = occ[curSign] ?? [];
				const pl = ks.length
					? ks.map((k) => FULLNAME[k]).join("  \u00b7  ")
					: "No planets";
				signcard.innerHTML = `${glyphSVG(curSign, 46)}<div class="sc-name">${SIGN_FULL[curSign]}</div><div class="sc-pl">${pl}</div>`;
				signcard.classList.add("show");
			}
			const cp = pt((((curSign * 30 + 15 + rot) % 360) + 360) % 360, ZLAB);
			const rr = svg.getBoundingClientRect();
			const scl = rr.width / 1000;
			const sx = rr.left + cp.x * scl;
			const sy = rr.top + cp.y * scl;
			if (cardSig !== shownCardSig) {
				signcard.style.left = `${sx}px`;
				signcard.style.top = `${sy}px`;
				const cr = signcard.getBoundingClientRect();
				const vw = window.innerWidth;
				const vh = window.innerHeight;
				cardCX =
					cr.left < 6 ? 6 - cr.left : cr.right > vw - 6 ? vw - 6 - cr.right : 0;
				cardCY =
					cr.top < 6 ? 6 - cr.top : cr.bottom > vh - 6 ? vh - 6 - cr.bottom : 0;
			}
			signcard.style.left = `${sx + cardCX}px`;
			signcard.style.top = `${sy + cardCY}px`;
			shownCardSig = cardSig;
		} else if (shownCardSig) {
			signcard.classList.remove("show");
			shownCardSig = "";
		}

		// Watch hands always follow the real system clock, independent of the
		// simulation (still hidden while dragging, handled in bindDrag).
		const hands = handAngles(new Date());
		handHour.setAttribute(
			"transform",
			`rotate(${hands.hour.toFixed(2)} ${CX} ${CY})`,
		);
		handMin.setAttribute(
			"transform",
			`rotate(${hands.minute.toFixed(2)} ${CX} ${CY})`,
		);

		// Sim clock + date complication follow simulated time.
		const d = new Date(bootMs + simT * 1000);

		const ew = world.earth;
		if (ew) {
			dateMonth.setAttribute("x", ew.x.toFixed(1));
			dateMonth.setAttribute("y", (ew.y - 7.5).toFixed(1));
			dateMonth.textContent = MONTHS[d.getMonth()];
			dateDay.setAttribute("x", ew.x.toFixed(1));
			dateDay.setAttribute("y", (ew.y + 4.5).toFixed(1));
			dateDay.textContent = String(d.getDate());
		}
		simClock.textContent = fmtClock(d);
		realClock.textContent = fmtClock(new Date());

		const Ex = world.earth?.x ?? CX;
		const Ey = world.earth?.y ?? CY;

		// Twilight zone — a wedge around the Earth→Sun direction whose two edges
		// follow the guilloche curves bounding it. Guilloche lines whose direction
		// falls inside the band are dropped entirely (see updateGuilloche below),
		// so none ever cross the zone.
		const R_SUN = 40;
		const MAX_R = 422;
		const hw = (12.5 * Math.PI) / 180;
		let exCenter = 0;
		let exHalf = -1;
		if (ew) {
			const ds = Math.atan2(CY - ew.y, CX - ew.x);
			exCenter = ds;
			if (cfg.twilight) exHalf = hw;
			const edgeA = guillochePoints(Ex, Ey, ds - hw, R_SUN, MAX_R, 40);
			const edgeB = guillochePoints(Ex, Ey, ds + hw, R_SUN, MAX_R, 40);
			if (cfg.twilight && edgeA.length >= 2 && edgeB.length >= 2) {
				const bOut = edgeB[edgeB.length - 1];
				let coneD = `M${ew.x.toFixed(1)} ${ew.y.toFixed(1)}`;
				for (const p of edgeA) coneD += ` L${p.x} ${p.y}`;
				coneD += ` A${MAX_R} ${MAX_R} 0 0 1 ${bOut.x} ${bOut.y}`;
				for (let k = edgeB.length - 1; k >= 0; k--)
					coneD += ` L${edgeB[k].x} ${edgeB[k].y}`;
				coneD += " Z";
				cone.setAttribute("d", coneD);
			}
		}
		// Guilloche is clipped to the dial circle only; the zone is handled by
		// dropping intersecting lines, not by clipping.
		guillocheClipPath.setAttribute("d", DIAL_CIRCLE);

		// Guilloche background
		updateGuilloche(
			svg,
			Ex,
			Ey,
			cfg.guillocheN,
			cfg.guilloche,
			exCenter,
			exHalf,
		);

		// Zodiac sign boundaries and shaded wedges both follow the guilloche curve.
		// phi converts from clock-angle (0=top, clockwise) to the curve's phi frame.
		// bpts[j] is the boundary-j polyline, inner (ZIN) -> outer (ZOUT).
		const ZIN = 422;
		const ZOUT = 468;
		const bpts: { x: number; y: number }[][] = [];
		for (let j = 0; j < 12; j++) {
			const clockDeg = j * 30 + rot;
			const phi = ((-90 + clockDeg) * Math.PI) / 180;
			let pts = guillochePoints(Ex, Ey, phi, ZIN, ZOUT, 6);
			if (pts.length < 2) pts = [pt(clockDeg, ZIN), pt(clockDeg, ZOUT)];
			bpts.push(pts);
			divs[j].setAttribute("d", pointsToPathD(pts));
		}
		for (let i = 0; i < 12; i++) {
			const a = bpts[i]; // boundary i (lower angle)
			const b = bpts[(i + 1) % 12]; // boundary i+1 (higher angle)
			const aIn = a[0];
			const bIn = b[0];
			const bOut = b[b.length - 1];
			let d = `M${aIn.x} ${aIn.y}`;
			for (let k = 1; k < a.length; k++) d += ` L${a[k].x} ${a[k].y}`;
			d += ` A${ZOUT} ${ZOUT} 0 0 1 ${bOut.x} ${bOut.y}`;
			for (let k = b.length - 2; k >= 0; k--) d += ` L${b[k].x} ${b[k].y}`;
			d += ` A${ZIN} ${ZIN} 0 0 0 ${aIn.x} ${aIn.y} Z`;
			wedges[i].setAttribute("d", d);

			// Inner-edge highlight arc shares the wedge's inner edge exactly, so
			// the lit arc lines up with the shaded fill instead of cutting across.
			arcs[i].setAttribute(
				"d",
				`M${aIn.x} ${aIn.y} A${ZIN} ${ZIN} 0 0 1 ${bIn.x} ${bIn.y}`,
			);
		}

		// Tooltip
		const show = pinned ?? hovered;
		if (show) {
			const w = world[show.key] ?? { x: CX, y: CY };
			const r = svg.getBoundingClientRect();
			const sc = r.width / 1000;
			tip.style.left = `${r.left + w.x * sc}px`;
			tip.style.top = `${r.top + w.y * sc}px`;
			const s = geo[show.key];
			tip.textContent = s
				? `${show.name}  \u00b7  ${SIGN_FULL[s.si]} ${s.deg}\u00b0`
				: show.name;
			tip.classList.add("show");
		} else {
			tip.classList.remove("show");
		}

		requestAnimationFrame(frame);
	}

	requestAnimationFrame(frame);
}
