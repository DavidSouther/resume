import { assertExists } from "@davidsouther/jiffies/assert.ts";
import {
	BODIES,
	EARTH,
	EARTH_YEAR,
	FULLNAME,
	GLYPHS,
	SIGN_FULL,
} from "../../lib/astrolabe/bodies.ts";
import { helioA, pt } from "../../lib/astrolabe/math.ts";
import type { Config } from "../../lib/astrolabe/types.ts";
import { guillochePathD, updateGuilloche } from "./guilloche.ts";
import type { PlanetRefs } from "./planets.ts";
import type { ZodiacRefs } from "./zodiac.ts";

const SVGNS = "http://www.w3.org/2000/svg";
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

function svgEl<K extends keyof SVGElementTagNameMap>(
	tag: K,
	attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
	const e = document.createElementNS(SVGNS, tag);
	for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
	return e;
}

function bodyColor(key: string): string {
	return (
		getComputedStyle(document.documentElement)
			.getPropertyValue(`--${key}`)
			.trim() || "#888"
	);
}

function setGradientStops(grad: SVGLinearGradientElement, keys: string[]) {
	while (grad.firstChild) grad.removeChild(grad.firstChild);
	if (keys.length === 1) {
		const col = bodyColor(keys[0]);
		const s0 = svgEl("stop", { offset: "0%" });
		s0.setAttribute("stop-color", col);
		const s1 = svgEl("stop", { offset: "100%" });
		s1.setAttribute("stop-color", col);
		grad.appendChild(s0);
		grad.appendChild(s1);
	} else {
		for (let i = 0; i < keys.length; i++) {
			const s = svgEl("stop", {
				offset: `${((i / (keys.length - 1)) * 100).toFixed(1)}%`,
			});
			s.setAttribute("stop-color", bodyColor(keys[i]));
			grad.appendChild(s);
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
	const { wedges, arcs, glyphs, grads } = zodiac;
	const zwheel = assertExists(
		svg.querySelector<SVGGElement>("#zwheel"),
		"#zwheel missing",
	);
	const zhits = assertExists(
		svg.querySelector<SVGGElement>("#zhits"),
		"#zhits missing",
	);
	const conjHost = document.getElementById("conj") as unknown as SVGGElement;
	const simClock = document.getElementById("simClock") as HTMLDivElement;
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
	const cone = assertExists(
		svg.querySelector<SVGPathElement>("#twilightCone"),
		"#twilightCone missing",
	);

	// Date complication text (created here — not pre-rendered)
	const dateMonth = svgEl("text", { class: "date-month" });
	svg.appendChild(dateMonth);
	const dateDay = svgEl("text", { class: "date-day" });
	svg.appendChild(dateDay);

	// Sun hit target at centre
	const sunHit = svgEl("circle", { class: "hit", cx: CX, cy: CY, r: 18 });
	svg.appendChild(sunHit);

	// Hover state
	let hovered: { key: string; name: string } | null = null;
	let pinned: { key: string; name: string } | null = null;
	let hoveredSign: number | null = null;
	let pinnedSign: number | null = null;

	function bindHover(el: SVGElement, body: { key: string; name: string }) {
		el.addEventListener("pointerenter", () => {
			hovered = body;
		});
		el.addEventListener("pointerleave", () => {
			hovered = null;
		});
		el.addEventListener("click", (e) => {
			e.stopPropagation();
			pinned = pinned?.key === body.key ? null : body;
		});
	}

	function bindSignHover(el: SVGElement, i: number) {
		el.addEventListener("pointerenter", () => {
			hoveredSign = i;
		});
		el.addEventListener("pointerleave", () => {
			hoveredSign = null;
		});
		el.addEventListener("click", (e) => {
			e.stopPropagation();
			pinned = null;
			pinnedSign = pinnedSign === i ? null : i;
		});
	}

	svg.addEventListener("pointerdown", () => {
		pinned = null;
		pinnedSign = null;
	});

	bindHover(sunHit, { key: "sun", name: "SUN" });
	for (let i = 0; i < zodiac.hits.length; i++)
		bindSignHover(zodiac.hits[i] as SVGElement, i);
	for (const b of BODIES) {
		const group = planets[b.key];
		const hit = group?.querySelector(".hit");
		if (hit) bindHover(hit as SVGElement, { key: b.key, name: b.name });
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
	let shownCardSig = "";
	let cardCX = 0;
	let cardCY = 0;
	const world: Record<string, { x: number; y: number; a: number }> = {};
	world.sun = { x: CX, y: CY, a: 0 };

	function frame(now: number) {
		const cfg = getConfig();
		let dt = (now - last) / 1000;
		last = now;
		if (dt > 0.1) dt = 0.1;
		simT += dt * cfg.speed;

		const aE = (((EARTH.start + EARTH_RATE * simT) % 360) + 360) % 360;
		const rot = cfg.earthFixed ? (360 - aE) % 360 : 0;

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
				const px = 0 * MAXPX * cfg.parallax * b.weight * on;
				const py = 0 * MAXPX * cfg.parallax * b.weight * on;
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

		zwheel.setAttribute("transform", `rotate(${rot.toFixed(3)} ${CX} ${CY})`);
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
		const sunSi = geo.sun.si;
		occ[sunSi] = occ[sunSi] ?? [];
		occ[sunSi].push("sun");
		for (const b of BODIES) {
			if (b.key === "earth" || b.moon) continue;
			const si = geo[b.key]?.si ?? 0;
			occ[si] = occ[si] ?? [];
			occ[si].push(b.key);
		}

		for (let i = 0; i < 12; i++) {
			const keys = occ[i];
			const lit = cfg.glow && !!keys;
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
					? ks.map((k) => FULLNAME[k]).join("  ·  ")
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

		// Sim clock + date complication
		const d = new Date(bootMs + simT * 1000);
		const mh = d.getMinutes() + d.getSeconds() / 60;
		handHour.setAttribute(
			"transform",
			`rotate(${(((d.getHours() % 12) + mh / 60) * 30).toFixed(2)} ${CX} ${CY})`,
		);
		handMin.setAttribute(
			"transform",
			`rotate(${(mh * 6).toFixed(2)} ${CX} ${CY})`,
		);

		const ew = world.earth;
		if (ew) {
			dateMonth.setAttribute("x", ew.x.toFixed(1));
			dateMonth.setAttribute("y", (ew.y - 7.5).toFixed(1));
			dateMonth.textContent = MONTHS[d.getMonth()];
			dateDay.setAttribute("x", ew.x.toFixed(1));
			dateDay.setAttribute("y", (ew.y + 4.5).toFixed(1));
			dateDay.textContent = String(d.getDate());
		}
		const hh = String(d.getHours()).padStart(2, "0");
		const mm = String(d.getMinutes()).padStart(2, "0");
		simClock.textContent = `${d.getDate()} ${MONTHS[d.getMonth()]} ${d.getFullYear()}  ·  ${hh}:${mm}`;

		// Twilight cone
		if (cfg.twilight && ew) {
			const ds = Math.atan2(CY - ew.y, CX - ew.x);
			const hw = (12.5 * Math.PI) / 180;
			const L = 760;
			const x1 = ew.x + L * Math.cos(ds - hw);
			const y1 = ew.y + L * Math.sin(ds - hw);
			const x2 = ew.x + L * Math.cos(ds + hw);
			const y2 = ew.y + L * Math.sin(ds + hw);
			cone.setAttribute(
				"d",
				`M${ew.x.toFixed(1)} ${ew.y.toFixed(1)} L${x1.toFixed(1)} ${y1.toFixed(1)} L${x2.toFixed(1)} ${y2.toFixed(1)} Z`,
			);
		}

		// Guilloche background
		updateGuilloche(
			svg,
			world.earth?.x ?? CX,
			world.earth?.y ?? CY,
			cfg.guillocheN,
			cfg.guilloche,
		);

		// Conjunction lines
		while (conjHost.firstChild) conjHost.removeChild(conjHost.firstChild);
		if (cfg.conj) {
			const E = world.earth;
			const Ex = E?.x ?? CX;
			const Ey = E?.y ?? CY;
			const TWILIGHT = 12.5;
			const items = BODIES.filter((b) => b.key !== "earth").map((b) => ({
				moon: !!b.moon,
				g: geo[b.key]?.g ?? 0,
			}));
			items.sort((p, q) => p.g - q.g);
			const n = items.length;

			let start = 0;
			let maxGap = -1;
			for (let gi = 0; gi < n; gi++) {
				const gap = (items[(gi + 1) % n].g - items[gi].g + 360) % 360;
				if (gap > maxGap) {
					maxGap = gap;
					start = (gi + 1) % n;
				}
			}

			const clusters: (typeof items)[] = [];
			let cur = [items[start]];
			for (let ci = 1; ci < n; ci++) {
				const prev = items[(start + ci - 1) % n];
				const it = items[(start + ci) % n];
				if ((it.g - prev.g + 360) % 360 <= cfg.conjDeg) cur.push(it);
				else {
					clusters.push(cur);
					cur = [it];
				}
			}
			clusters.push(cur);

			for (const group of clusters) {
				if (group.length < 2) continue;
				let nPlanets = 0;
				let hasMoon = false;
				let sx = 0;
				let sy = 0;
				for (const m of group) {
					if (m.moon) hasMoon = true;
					else nPlanets++;
					const r = (m.g * Math.PI) / 180;
					sx += Math.cos(r);
					sy += Math.sin(r);
				}
				if (nPlanets === 0) continue;
				const meanG = (Math.atan2(sy, sx) * 180) / Math.PI;
				let sep = Math.abs(meanG - geo.sun.g) % 360;
				if (sep > 180) sep = 360 - sep;
				if (sep < TWILIGHT) continue;

				const score = nPlanets + (hasMoon ? 0.5 : 0);
				const conjT = Math.max(0, Math.min(1, (score - 1.5) / 2.5));
				const sw = (0.5 + conjT * 1.9).toFixed(2);
				const so = (0.07 + conjT * 0.53).toFixed(3);

				let conjD: string;
				if (cfg.conjCurved) {
					const phi = ((meanG + rot) * Math.PI) / 180;
					conjD = guillochePathD(Ex, Ey, phi, 168.4, 422, 30);
				} else {
					const ep = pt((((meanG + 90 + rot) % 360) + 360) % 360, 422);
					conjD = `M${Ex.toFixed(1)},${Ey.toFixed(1)} L${ep.x.toFixed(1)},${ep.y.toFixed(1)}`;
				}

				const path = svgEl("path", {
					class: "conj-line",
					d: conjD,
					"stroke-width": sw,
					"stroke-opacity": so,
				});
				conjHost.appendChild(path);
			}
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
				? `${show.name}  ·  ${SIGN_FULL[s.si]} ${s.deg}°`
				: show.name;
			tip.classList.add("show");
		} else {
			tip.classList.remove("show");
		}

		requestAnimationFrame(frame);
	}

	requestAnimationFrame(frame);
}
