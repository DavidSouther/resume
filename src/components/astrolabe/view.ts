import { assertExists } from "@davidsouther/jiffies/assert.ts";
import { circle, g, line, text } from "@davidsouther/jiffies/dom/svg.ts";
import { BODIES, FULLNAME, SIGN_FULL } from "../../lib/astrolabe/bodies.ts";
import { radialSpokes } from "../../lib/astrolabe/geocentric.ts";
import type { FrameState } from "../../lib/astrolabe/simulation.ts";
import { buildPlanets } from "./planets.ts";
import { buildZodiac } from "./zodiac.ts";

const CX = 500;
const CY = 500;
const R_SUN_DISC = 168.4;
const R_MARS = 197.5;
const MAX_SPOKE_R = 422;
const R_SPOKE_INNER = 14;

function setDisplay(el: Element | null, visible: boolean) {
	if (!el) return;
	(el as SVGElement & { style: CSSStyleDeclaration }).style.display = visible
		? ""
		: "none";
}

export function astrolabeView(svg: SVGSVGElement): {
	update(state: FrameState): void;
} {
	const zodiacGrp = assertExists(
		svg.querySelector<SVGGElement>("#zodiac"),
		"#zodiac missing",
	);
	const zodiac = buildZodiac(zodiacGrp);
	// #zhits is appended to svg by buildZodiac.
	const zhits = assertExists(
		svg.querySelector<SVGGElement>("#zhits"),
		"#zhits missing",
	);

	const discsGrp = assertExists(
		svg.querySelector<SVGGElement>("#discs"),
		"#discs missing",
	);
	const planets = buildPlanets(discsGrp);

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
	const sunCenter = svg.querySelector<SVGGElement>("#sunCenter");
	const spokesGroup = svg.querySelector<SVGGElement>("#spokes");

	// Document-level overlays (outside the SVG).
	const simClock = document.getElementById("simClock");
	const realClock = document.getElementById("realClock");
	const tip = document.getElementById("tip");
	const signcard = document.getElementById("signcard");

	// Boot-time construction: elements not pre-rendered by dial.ts.
	const dateMonth = text({ class: "date-month" });
	svg.appendChild(dateMonth);
	const dateDay = text({ class: "date-day" });
	svg.appendChild(dateDay);

	const sunHit = circle({ class: "hit", cx: CX, cy: CY, r: 24 });
	svg.appendChild(sunHit);

	const sunDisc = g({ class: "disc disc-sun", style: "display:none" });
	sunDisc.appendChild(
		circle({ class: "orbit-ring", cx: CX, cy: CY, r: R_SUN_DISC }),
	);
	sunDisc.appendChild(
		circle({
			class: "planet sun-disc-dot",
			cx: CX + R_SUN_DISC,
			cy: CY,
			r: 21,
			fill: "#9C6B14",
		}),
	);
	svg.insertBefore(sunDisc, discsGrp);

	// Ptolemaic radial spokes (static in dial coordinates).
	if (spokesGroup) {
		for (const s of radialSpokes(120, R_SPOKE_INNER, R_MARS, MAX_SPOKE_R)) {
			spokesGroup.appendChild(
				line({
					class: "guilloche-line",
					x1: s.x1.toFixed(1),
					y1: s.y1.toFixed(1),
					x2: s.x2.toFixed(1),
					y2: s.y2.toFixed(1),
				}),
			);
		}
	}

	function update(state: FrameState): void {
		svg.classList.toggle("ptolemaic", state.ptolemaic);

		for (const b of BODIES.values()) {
			const disc = planets[b.key];
			const bodyState = state.bodies[b.key];
			if (disc && bodyState) {
				disc.setAttribute("transform", bodyState.transform);
			}
		}

		if (state.ptolemaic && state.sun.discTransform) {
			sunDisc.setAttribute("transform", state.sun.discTransform);
		}
		sunHit.setAttribute("cx", String(state.sun.hit.cx));
		sunHit.setAttribute("cy", String(state.sun.hit.cy));

		zhits.setAttribute("transform", state.zhitsTransform);

		for (let i = 0; i < 12; i++) {
			const z = state.zodiac[i];
			zodiac.divs[i].setAttribute("d", z.dividerD);
			zodiac.wedges[i].setAttribute("d", z.wedgeD);
			zodiac.arcs[i].setAttribute("d", z.arcD);
			zodiac.glyphs[i].setAttribute("transform", z.glyphTransform);
			zodiac.wedges[i].classList.toggle("active", z.active);
			zodiac.arcs[i].classList.toggle("active", z.active);
			zodiac.glyphs[i].classList.toggle("active", z.active);
		}

		setDisplay(sunCenter, state.visibility.sunCenter);
		setDisplay(sunDisc, state.visibility.sunDisc);
		setDisplay(spokesGroup, state.visibility.spokes);

		cone.setAttribute("d", state.coneD);

		guillocheClipPath.setAttribute("d", state.guilloche.clipD);

		handHour.setAttribute("transform", state.hands.hourTransform);
		handMin.setAttribute("transform", state.hands.minuteTransform);
		setDisplay(handsGroup, state.hands.visible);

		const dc = state.dateComplication;
		dateMonth.setAttribute("x", dc.x.toFixed(1));
		dateMonth.setAttribute("y", (dc.y - 7.5).toFixed(1));
		dateMonth.textContent = dc.month;
		dateDay.setAttribute("x", dc.x.toFixed(1));
		dateDay.setAttribute("y", (dc.y + 4.5).toFixed(1));
		dateDay.textContent = dc.day;

		if (simClock) simClock.textContent = state.simClock;
		if (realClock) realClock.textContent = state.realClock;

		if (tip) {
			if (state.tooltip.shown) {
				tip.style.left = `${state.tooltip.point.x}px`;
				tip.style.top = `${state.tooltip.point.y}px`;
				tip.textContent = state.tooltip.text;
				tip.classList.add("show");
			} else {
				tip.classList.remove("show");
			}
		}

		if (signcard) {
			if (state.signCard.shown) {
				signcard.style.left = `${state.signCard.point.x}px`;
				signcard.style.top = `${state.signCard.point.y}px`;
				const ks = state.signCard.occupants;
				const pl = ks.length
					? ks.map((k) => FULLNAME[k] ?? k).join("  ·  ")
					: "No planets";
				signcard.innerHTML = `<div class="sc-name">${SIGN_FULL[state.signCard.sign]}</div><div class="sc-pl">${pl}</div>`;
				signcard.classList.add("show");
			} else {
				signcard.classList.remove("show");
			}
		}
	}

	return { update };
}
