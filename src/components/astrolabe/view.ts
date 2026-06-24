// The Astrolabe dial render seam. `astrolabeView(svg)` owns the dynamic child
// FCC handles (the sanctioned "immediate children") plus the render-once static
// FCCs (defined in components.ts), and drives the static-id elements `buildDial()`
// already placed (cone, hands, sun-center, spokes, guilloche clip, clocks,
// tooltip, sign card) via Jiffies `up()`. `update(scene)` fans each Scene slice
// to the child that renders it.
//
// No DOM math lives here: every value is a literal string/flag from the pure
// `simulate(input) -> Scene`. No raw DOM mutation survives — children flow
// through builder/FCC reconcile, attrs/classes/styles/events through `update`/
// `up()` attrs, host inserts use `.append()` (the only sanctioned host-level
// insert, not in the no-raw-dom guard list). Page-emitted static-id elements are
// mutated through `up()` (the same Jiffies write path controls.ts uses on the
// document root) rather than a build-time `.update` graft, which the browser
// loses when it re-parses the serialized SSG markup. See
// .ailly/developer/2026-06-23-A-astrolabe-fcc-refactor/design.md.
import { type DenormAttrs, up } from "@davidsouther/jiffies/dom/dom.ts";
import { div } from "@davidsouther/jiffies/dom/html.ts";
import { BODIES, FULLNAME, SIGN_FULL } from "../../lib/astrolabe/bodies.ts";
import type { Scene } from "../../lib/astrolabe/simulate.ts";
import {
	DateComplication,
	type EventMap,
	Guilloche,
	glyphSvg,
	makeDisc,
	SHEEN,
	Sparkles,
	Spokes,
	SunDisc,
	SunHit,
	Texture,
	Zodiac,
} from "./components.ts";

const CX = 500;
const CY = 500;

// A jiffies-grafted element: builder elements and FCC boundaries carry `.update`.
type Updatable = Element & {
	update?: (
		attrs?: Record<string, unknown> | Node | string,
		...children: (Node | string)[]
	) => unknown;
};

// Apply a Jiffies update to a raw page-emitted element. `up()` is typed per the
// element's own DOM properties, so SVG presentation attrs (`d`, `transform`) and
// other verbatim attributes need a loose payload — the engine still writes every
// key as a real attribute / class token / style / event (no raw DOM survives).
// Mirrors controls.ts' `setAttrs`.
function setAttrs(
	el: Element,
	attrs: Record<string, unknown>,
	...children: (Node | string)[]
): void {
	up(el as Omit<Element, "update">, attrs as DenormAttrs<Element>, ...children);
}

// Optional event wiring supplied by the animation controller after mount, so it
// never holds raw DOM refs: events flow as `events:` attrs onto the hit/sign FCC
// boundaries via the dynamic FCCs' update.
export interface ViewEvents {
	body?: (key: string) => EventMap;
	sunHit?: () => EventMap;
	sign?: (i: number) => EventMap;
}

export function astrolabeView(
	svg: SVGSVGElement,
	events: ViewEvents = {},
): { update(scene: Scene): void; bindEvents(events: ViewEvents): void } {
	let viewEvents = events;
	const q = <T extends Element>(sel: string): (T & Updatable) | null =>
		svg.querySelector<T>(sel) as (T & Updatable) | null;
	const doc = svg.ownerDocument ?? window.document;

	const discsHost = q<SVGGElement>("#discs");
	const zodiacHost = q<SVGGElement>("#zodiac");
	const guillocheHost = q<SVGGElement>("#guilloche");
	const spokesHost = q<SVGGElement>("#spokes");
	const textureHost = q<SVGGElement>("#texture");
	const sparklesHost = q<SVGGElement>("#sparkles");
	const handsHost = q<SVGGElement>("#hands");
	const handHour = q<SVGPathElement>("#handHour");
	const handMin = q<SVGPathElement>("#handMin");
	const sunCenterHost = q<SVGGElement>("#sunCenter");
	const coneEl = q<SVGPathElement>("#twilightCone");
	const clipEl = q<SVGPathElement>("#guillocheClipPath");
	const defsHost = svg.querySelector("defs") as (Element & Updatable) | null;

	// Render-once static FCCs into their host groups.
	if (defsHost) defsHost.append(SHEEN({}));
	if (textureHost) textureHost.append(Texture({}));
	if (sparklesHost) sparklesHost.append(Sparkles({}));
	if (spokesHost) spokesHost.append(Spokes({}));

	// Dynamic body discs + ptolemaic sun disc + sun hit.
	let sunDiscHandle: (Element & Updatable) | null = null;
	const discHandles: Record<string, Element & Updatable> = {};
	if (discsHost) {
		sunDiscHandle = SunDisc({
			transform: "rotate(0 500 500)",
			style: "display:none",
		}) as Element & Updatable;
		discsHost.append(sunDiscHandle);
		for (const b of BODIES) {
			const handle = makeDisc(b.key)({
				transform: "rotate(0 500 500)",
			}) as Element & Updatable;
			discsHost.append(handle);
			discHandles[b.key] = handle;
		}
	}

	const sunHitHandle = SunHit({ x: CX, y: CY }) as Element & Updatable;
	svg.append(sunHitHandle);

	// Zodiac.
	let zodiacHandle: (Element & Updatable) | null = null;
	if (zodiacHost) {
		zodiacHandle = Zodiac({
			zodiac: emptyZodiac(),
			zhitsTransform: "rotate(0 500 500)",
		}) as Element & Updatable;
		zodiacHost.append(zodiacHandle);
	}

	// Guilloche line list.
	let guillocheHandle: (Element & Updatable) | null = null;
	if (guillocheHost) {
		guillocheHandle = Guilloche({ lines: [] }) as Element & Updatable;
		guillocheHost.append(guillocheHandle);
	}

	// Date complication.
	const dateHandle = DateComplication({
		x: CX,
		y: CY,
		month: "",
		day: "",
	}) as Element & Updatable;
	svg.append(dateHandle);

	// Document overlays — existing builder elements in the page (carry .update).
	const simClockEl = doc.getElementById("simClock") as
		| (Element & Updatable)
		| null;
	const realClockEl = doc.getElementById("realClock") as
		| (Element & Updatable)
		| null;
	const tipEl = doc.getElementById("tip") as (Element & Updatable) | null;
	const signcardEl = doc.getElementById("signcard") as
		| (Element & Updatable)
		| null;

	let lastCardSig = "";

	function bindEvents(next: ViewEvents): void {
		viewEvents = next;
		for (const b of BODIES) {
			const h = discHandles[b.key];
			if (h?.update && viewEvents.body)
				h.update({ hitEvents: viewEvents.body(b.key) });
		}
		if (sunHitHandle.update && viewEvents.sunHit) {
			sunHitHandle.update({ hitEvents: viewEvents.sunHit() });
		}
		if (zodiacHandle?.update && viewEvents.sign) {
			zodiacHandle.update({ signEvents: viewEvents.sign });
		}
	}

	function update(scene: Scene): void {
		for (const b of BODIES) {
			discHandles[b.key]?.update?.({
				transform: scene.bodies[b.key].transform,
			});
		}
		sunDiscHandle?.update?.({
			transform: scene.sun.transform,
			style: scene.visibility.sunDisc ? "" : "display:none",
		});
		sunHitHandle.update?.({ x: scene.sun.hit.x, y: scene.sun.hit.y });

		zodiacHandle?.update?.({
			zodiac: scene.zodiac,
			zhitsTransform: scene.zhitsTransform,
		});

		// Page-emitted static-id elements: apply through `up()` (works on any raw
		// element, post-SSG-reparse), never a grafted `.update` that the browser
		// loses on serialize. Same Jiffies write path controls.ts uses on the root.
		if (clipEl) setAttrs(clipEl, { d: scene.guilloche.clipD });
		guillocheHandle?.update?.({ lines: scene.guilloche.lines });

		if (coneEl) setAttrs(coneEl, { d: scene.coneD });

		if (handHour) setAttrs(handHour, { transform: scene.hands.hourTransform });
		if (handMin) setAttrs(handMin, { transform: scene.hands.minuteTransform });
		if (handsHost)
			setAttrs(handsHost, { style: scene.hands.visible ? "" : "display:none" });

		if (sunCenterHost)
			setAttrs(sunCenterHost, {
				style: scene.visibility.sunCenter ? "" : "display:none",
			});
		if (spokesHost)
			setAttrs(spokesHost, {
				style: scene.visibility.spokes ? "" : "display:none",
			});

		dateHandle.update?.({
			x: scene.dateComplication.x,
			y: scene.dateComplication.y,
			month: scene.dateComplication.month,
			day: scene.dateComplication.day,
		});

		setAttrs(svg, {
			class: scene.ptolemaic ? "ptolemaic" : "!ptolemaic",
		});

		if (simClockEl) setAttrs(simClockEl, {}, scene.simClock);
		if (realClockEl) setAttrs(realClockEl, {}, scene.realClock);

		if (tipEl) {
			if (scene.tooltip.shown) {
				setAttrs(
					tipEl,
					{
						class: "show",
						style: {
							left: `${scene.tooltip.point.x}px`,
							top: `${scene.tooltip.point.y}px`,
						},
					},
					scene.tooltip.text,
				);
			} else {
				setAttrs(tipEl, { class: "!show" });
			}
		}

		if (signcardEl) {
			if (scene.signCard.shown) {
				const cardSig = `${scene.signCard.sign}:${scene.signCard.occupants.join(",")}`;
				if (cardSig !== lastCardSig) {
					const pl = scene.signCard.occupants.length
						? scene.signCard.occupants.map((k) => FULLNAME[k]).join("  ·  ")
						: "No planets";
					setAttrs(
						signcardEl,
						{ class: "show" },
						glyphSvg(scene.signCard.sign, 46),
						div({ class: "sc-name" }, SIGN_FULL[scene.signCard.sign]),
						div({ class: "sc-pl" }, pl),
					);
					lastCardSig = cardSig;
				}
				setAttrs(signcardEl, {
					class: "show",
					style: {
						left: `${scene.signCard.point.x}px`,
						top: `${scene.signCard.point.y}px`,
					},
				});
			} else if (lastCardSig) {
				setAttrs(signcardEl, { class: "!show" });
				lastCardSig = "";
			}
		}
	}

	if (Object.keys(events).length) bindEvents(events);

	return { update, bindEvents };
}

function emptyZodiac(): Scene["zodiac"] {
	return Array.from({ length: 12 }, () => ({
		wedgeD: "",
		arcD: "",
		dividerD: "",
		glyphTransform: "rotate(0 500 500)",
		active: false,
		gradientStops: [],
	}));
}
