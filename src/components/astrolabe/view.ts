// The Astrolabe dial as a single FCC. `AstrolabeView`'s boundary IS the
// `<svg id="dial">`; it builds the static skeleton (defs / ground / bezel / clips)
// and the dynamic subsystem FCCs (zodiac, discs, sun disc, spokes, hands,
// sun-center, guilloche, date) ONCE into its `[State]`, and on `update({ scene })`
// fans each Scene slice to the child that renders it — returning the same child
// instances, so the reconcile is a no-op. It owns the dial-root mode class on its
// own boundary, and each visibility leaf owns its own show/hide. Pointer event
// maps ride the `viewEvents` prop (NOT `events`, which Jiffies would wire onto the
// svg boundary itself) and are forwarded once to the interactive children. No DOM
// handle crosses a boundary; no document query. See
// .ailly/developer/2026-06-23-A-astrolabe-fcc-refactor/dial-redesign.md.
import { up } from "@davidsouther/jiffies/dom/dom.ts";
import { FCC, State } from "@davidsouther/jiffies/dom/fc.ts";
import {
	svg as buildSvg,
	circle,
	clipPath,
	g,
	linearGradient,
	path,
	radialGradient,
	stop,
	defs as svgDefs,
} from "@davidsouther/jiffies/dom/svg.ts";
import { BODIES } from "../../lib/astrolabe/bodies.ts";
import type { Scene } from "../../lib/astrolabe/simulate.ts";
import {
	DateComplication,
	type EventMap,
	Guilloche,
	Hands,
	makeDisc,
	SHEEN,
	Sparkles,
	Spokes,
	SunCenter,
	SunDisc,
	SunHit,
	Texture,
	Zodiac,
} from "./components.ts";

const CX = 500;
const CY = 500;

// Hardcoded annulus path for the zodiac band background (ZIN=422, ZOUT=468).
const ZBAND_BG_D =
	"M500 32 A468 468 0 1 1 499.99 32 Z M500 78 A422 422 0 1 0 499.99 78 Z";

// A jiffies element carrying `.update` (builder elements and FCC boundaries).
type Updatable = Element & {
	update?: (
		attrs?: Record<string, unknown> | Node | string,
		...children: (Node | string)[]
	) => unknown;
};

// Pointer event maps, authored by the animation controller and handed down via the
// `viewEvents` prop. Each is forwarded once to the interactive child that carries
// it (the disc/sun `.hit` child, the per-sign zhit) — the honored non-bubbling-hover
// exception: hover does not bubble, so the map cannot ride a group boundary.
export interface ViewEvents {
	body?: (key: string) => EventMap;
	sunHit?: () => EventMap;
	sign?: (i: number) => EventMap;
}

interface ViewProps {
	scene?: Scene;
	viewEvents?: ViewEvents;
}

interface DialInternals {
	built: boolean;
	eventsBound: boolean;
	guillocheClipPath: SVGPathElement;
	twilightCone: SVGPathElement;
	guilloche: Element & Updatable;
	spokes: Element & Updatable;
	sunCenter: Element & Updatable;
	hands: Element & Updatable;
	zodiac: Element & Updatable;
	sunDisc: Element & Updatable;
	sunHit: Element & Updatable;
	date: Element & Updatable;
	discs: Record<string, Element & Updatable>;
	kids: Element[];
}

// The dial's <defs>: clips, gradients, and the per-frame guilloche clip path
// (passed in so the component can hold its handle to poke `d` each frame).
function buildDefs(guillocheClipPath: SVGPathElement): SVGDefsElement {
	return svgDefs(
		{},
		clipPath({ id: "dialClip" }, circle({ cx: CX, cy: CY, r: 470 })),
		clipPath({ id: "guillocheClip" }, guillocheClipPath),
		radialGradient(
			{
				id: "twilightGrad",
				gradientUnits: "userSpaceOnUse",
				cx: CX,
				cy: CY,
				r: 470,
			},
			stop({ offset: "0%", "stop-color": "#D4A843", "stop-opacity": "0.30" }),
			stop({ offset: "55%", "stop-color": "#D4A843", "stop-opacity": "0.10" }),
			stop({ offset: "100%", "stop-color": "#D4A843", "stop-opacity": "0" }),
		),
		radialGradient(
			{ id: "vignette", cx: "50%", cy: "50%", r: "50%" },
			stop({ offset: "55%", "stop-color": "#000", "stop-opacity": "0" }),
			stop({ offset: "100%", "stop-color": "#000", "stop-opacity": "0.55" }),
		),
		radialGradient(
			{ id: "sunGlow", cx: "50%", cy: "50%", r: "50%" },
			stop({ offset: "0%", class: "sg0" }),
			stop({ offset: "100%", class: "sg1" }),
		),
		linearGradient(
			{
				id: "caseMetal",
				gradientUnits: "userSpaceOnUse",
				x1: CX,
				y1: 14,
				x2: CX,
				y2: 986,
			},
			stop({
				offset: "0%",
				"stop-color": "var(--case)",
				"stop-opacity": "0.45",
			}),
			stop({ offset: "16%", "stop-color": "var(--case)", "stop-opacity": "1" }),
			stop({
				offset: "38%",
				"stop-color": "var(--case)",
				"stop-opacity": "0.7",
			}),
			stop({ offset: "62%", "stop-color": "var(--case)", "stop-opacity": "1" }),
			stop({
				offset: "84%",
				"stop-color": "var(--case)",
				"stop-opacity": "0.62",
			}),
			stop({
				offset: "100%",
				"stop-color": "var(--case)",
				"stop-opacity": "0.4",
			}),
		),
	);
}

// Build the skeleton + subsystem FCCs once into `[State]`. The host groups
// (#guilloche/#texture/#sparkles/#zodiac/#discs) are plain containers the subsystem
// FCCs are appended into (`.append` is the sanctioned host-level insert); the
// visibility-governed subsystems (#spokes/#sunCenter/#hands) ARE FCCs that own their
// own show/hide; #sunHit/#date sit at the svg root (last, painted on top).
function buildDial(st: DialInternals): void {
	const guillocheClipPath = path({
		id: "guillocheClipPath",
		"fill-rule": "evenodd",
		d: "",
	});
	st.guillocheClipPath = guillocheClipPath;
	const defs = buildDefs(guillocheClipPath);
	defs.append(SHEEN({}));

	const ground = circle({ class: "ground", cx: CX, cy: CY, r: 470 });
	const zbandBg = path({
		id: "zbandBg",
		class: "zband-bg",
		d: ZBAND_BG_D,
		"fill-rule": "evenodd",
	});

	const guillocheHost = g({
		id: "guilloche",
		"clip-path": "url(#guillocheClip)",
	});
	st.guilloche = Guilloche({ lines: [] }) as Element & Updatable;
	guillocheHost.append(st.guilloche);

	st.spokes = Spokes({ visible: false }) as Element & Updatable;

	const textureHost = g({ id: "texture" });
	textureHost.append(Texture({}));
	const sparklesHost = g({ id: "sparkles" });
	sparklesHost.append(Sparkles({}));

	const vignette = circle({ cx: CX, cy: CY, r: 470, fill: "url(#vignette)" });

	const zodiacHost = g({ id: "zodiac" });
	st.zodiac = Zodiac({
		zodiac: emptyZodiac(),
		zhitsTransform: "rotate(0 500 500)",
	}) as Element & Updatable;
	zodiacHost.append(st.zodiac);

	const discsHost = g({ id: "discs" });
	st.sunDisc = SunDisc({
		transform: "rotate(0 500 500)",
		visible: false,
	}) as Element & Updatable;
	discsHost.append(st.sunDisc);
	st.discs = {};
	for (const b of BODIES) {
		const handle = makeDisc(b.key)({
			transform: "rotate(0 500 500)",
		}) as Element & Updatable;
		discsHost.append(handle);
		st.discs[b.key] = handle;
	}

	st.twilightCone = path({
		id: "twilightCone",
		fill: "url(#twilightGrad)",
		"clip-path": "url(#dialClip)",
		opacity: "0.25",
	});
	const conj = g({ id: "conj" });
	st.sunCenter = SunCenter({ visible: true }) as Element & Updatable;

	const bezelRing = circle({
		class: "bezel-ring",
		cx: CX,
		cy: CY,
		r: 484,
		stroke: "url(#caseMetal)",
		"stroke-width": 28,
	});
	const bezelEdge1 = circle({
		class: "bezel-edge",
		cx: CX,
		cy: CY,
		r: 470,
		stroke: "rgba(255,255,255,0.16)",
	});
	const bezelEdge2 = circle({
		class: "bezel-edge",
		cx: CX,
		cy: CY,
		r: 498,
		stroke: "rgba(0,0,0,0.45)",
	});

	st.hands = Hands({
		hourTransform: "",
		minuteTransform: "",
		visible: true,
	}) as Element & Updatable;
	const dialG = g({ id: "dial-g" });

	st.sunHit = SunHit({ x: CX, y: CY }) as Element & Updatable;
	st.date = DateComplication({
		x: CX,
		y: CY,
		month: "",
		day: "",
	}) as Element & Updatable;

	st.kids = [
		defs,
		ground,
		zbandBg,
		guillocheHost,
		st.spokes,
		textureHost,
		sparklesHost,
		vignette,
		zodiacHost,
		discsHost,
		st.twilightCone,
		conj,
		st.sunCenter,
		bezelRing,
		bezelEdge1,
		bezelEdge2,
		st.hands,
		dialG,
		st.sunHit,
		st.date,
	];
	st.built = true;
}

// Fan one Scene to the stashed children. No styling decision here beyond the
// dial-root mode class (owned by this component's own boundary); every show/hide
// is the leaf's own job, driven by the boolean it receives.
function fanScene(el: Element, st: DialInternals, scene: Scene): void {
	for (const b of BODIES) {
		st.discs[b.key]?.update?.({ transform: scene.bodies[b.key].transform });
	}
	st.sunDisc.update?.({
		transform: scene.sun.transform,
		visible: scene.visibility.sunDisc,
	});
	st.sunHit.update?.({ x: scene.sun.hit.x, y: scene.sun.hit.y });
	st.zodiac.update?.({
		zodiac: scene.zodiac,
		zhitsTransform: scene.zhitsTransform,
	});
	up(st.guillocheClipPath, { d: scene.guilloche.clipD });
	st.guilloche.update?.({ lines: scene.guilloche.lines });
	up(st.twilightCone, { d: scene.coneD });
	st.hands.update?.({
		hourTransform: scene.hands.hourTransform,
		minuteTransform: scene.hands.minuteTransform,
		visible: scene.hands.visible,
	});
	st.sunCenter.update?.({ visible: scene.visibility.sunCenter });
	st.spokes.update?.({ visible: scene.visibility.spokes });
	st.date.update?.({
		x: scene.dateComplication.x,
		y: scene.dateComplication.y,
		month: scene.dateComplication.month,
		day: scene.dateComplication.day,
	});
	up(el, { class: scene.ptolemaic ? "ptolemaic" : "!ptolemaic" });
}

// Forward each event map ONCE to the interactive child that carries it. Event maps
// are stable, so this runs on the first frame that supplies them; the per-frame
// scene fan merges with these on each child without disturbing them.
function bindViewEvents(st: DialInternals, events: ViewEvents): void {
	if (events.body) {
		for (const b of BODIES) {
			st.discs[b.key]?.update?.({ hitEvents: events.body(b.key) });
		}
	}
	if (events.sunHit) st.sunHit.update?.({ hitEvents: events.sunHit() });
	if (events.sign) st.zodiac.update?.({ signEvents: events.sign });
	st.eventsBound = true;
}

export const AstrolabeView = FCC<ViewProps, DialInternals>(
	"astro-view",
	() =>
		buildSvg({
			id: "dial",
			viewBox: "0 0 1000 1000",
			preserveAspectRatio: "xMidYMid meet",
		}),
	(el, attrs) => {
		const st = el[State] as DialInternals;
		if (!st.built) buildDial(st);
		if (attrs.scene) fanScene(el, st, attrs.scene);
		if (attrs.viewEvents && !st.eventsBound)
			bindViewEvents(st, attrs.viewEvents);
		return st.kids;
	},
);

export type AstrolabeViewHandle = ReturnType<typeof AstrolabeView>;

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
