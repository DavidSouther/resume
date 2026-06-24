// The Astrolabe animation controller. It owns the mutable interaction state,
// wires every pointer interaction as `events:` attrs (through the view's FCC
// boundaries and the dial root's grafted update method), and each frame
// assembles a pure `FrameInput`, calls `simulate()`, and pushes the resulting
// `Scene` to `view.update(scene)`. No raw DOM mutation survives here: every DOM
// write flows through the FCC tree in view.ts via builder attrs, class tokens,
// style attrs, and event maps. `getBoundingClientRect`,
// `getComputedStyle`, `window.Astronomy`, `set/releasePointerCapture`,
// `requestAnimationFrame`, and `performance.now`/`Date.now` are the permitted
// reads / non-element APIs. See
// .ailly/developer/2026-06-23-A-astrolabe-fcc-refactor/design.md.
import { up } from "@davidsouther/jiffies/dom/dom.ts";
import { BODIES, EARTH } from "../../lib/astrolabe/bodies.ts";
import {
	dialAngle,
	displayedRate,
	dragTimeStep,
	simTimeForNow,
	wrap180,
	ZODIAC_DRAG_RATE,
} from "../../lib/astrolabe/math.ts";
import { type FrameInput, simulate } from "../../lib/astrolabe/simulate.ts";
import {
	type Config,
	type EarthMode,
	GALILEAN,
	KEPLERIAN,
	PTOLEMAIC,
} from "../../lib/astrolabe/types.ts";
import type { ViewEvents } from "./view.ts";

type EventMap = Record<string, (e: Event) => void>;

interface AstrolabeView {
	update(scene: ReturnType<typeof simulate>): void;
	bindEvents(events: ViewEvents): void;
}

export function startAnimation(
	svg: SVGSVGElement & {
		update?: (attrs?: Record<string, unknown>) => unknown;
	},
	view: AstrolabeView,
	getConfig: () => Config,
): void {
	// Parallax mouse/touch tracking (normalized -1..1 from center).
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

	// Hover / pin state.
	let hovered: { key: string; name: string } | null = null;
	let pinned: { key: string; name: string } | null = null;
	let hoveredSign: number | null = null;
	let pinnedSign: number | null = null;

	// Drag state.
	type DragKind = { time: true; R: number } | { time: false };
	let caseOffset = 0;
	let prevEarthMode = getConfig().earthMode;
	let dragging: {
		kind: DragKind;
		prevAngle: number;
		moved: boolean;
		acc: number;
	} | null = null;
	let dragMoved = false;

	const MOVE_THRESH = 4;
	function center(): { cx: number; cy: number } {
		const r = svg.getBoundingClientRect();
		return { cx: r.left + r.width / 2, cy: r.top + r.height / 2 };
	}

	// Ephemeris seeding (mutates b.start; not a DOM write).
	const bootMs = Date.now();
	function applyEphemeris(A: Record<string, unknown>, mode: EarthMode) {
		try {
			const date = new Date(bootMs);
			const ptol = mode === PTOLEMAIC;
			for (const b of BODIES) {
				let lon: number;
				if (b.moon) {
					lon = (A.EclipticGeoMoon as (d: Date) => { lon: number })(date).lon;
				} else {
					const key = b.key.charAt(0).toUpperCase() + b.key.slice(1);
					const Body = A.Body as Record<string, unknown>;
					if (!Body[key]) continue;
					if (ptol && b.key !== "earth") {
						const eq = (
							A.Equator as (
								body: unknown,
								date: Date,
								obs: unknown,
								ofdate: boolean,
								aberration: boolean,
							) => { ra: number }
						)(Body[key], date, null, true, true);
						lon = eq.ra * 15;
					} else {
						lon = (
							A.EclipticLongitude as (body: unknown, date: Date) => number
						)(Body[key], date);
					}
				}
				b.start = (((lon - 90) % 360) + 360) % 360;
			}
		} catch {
			// keep snapshot defaults
		}
	}

	const win = window as unknown as Record<string, unknown>;
	let seededPtolemaic = -1;
	function seedFor(mode: EarthMode) {
		const A = win.Astronomy as Record<string, unknown> | undefined;
		if (!A) return;
		const want = mode === PTOLEMAIC ? 1 : 0;
		if (want === seededPtolemaic) return;
		applyEphemeris(A, mode);
		seededPtolemaic = want;
	}
	seedFor(getConfig().earthMode);

	// Simulation state.
	let simT = 0;
	let last = performance.now();

	// --- Event wiring (all through `events:` attrs on FCC boundaries / svg) ---

	function bodyEvents(key: string): EventMap {
		const b = BODIES.find((x) => x.key === key);
		const name = b ? b.name : key.toUpperCase();
		const ev: EventMap = {
			pointerenter: () => {
				hovered = { key, name };
			},
			pointerleave: () => {
				hovered = null;
			},
			click: (e) => {
				e.stopPropagation();
				if (dragMoved) {
					dragMoved = false;
					return;
				}
				pinned = pinned?.key === key ? null : { key, name };
			},
		};
		// Orbiting planets and Earth are draggable; the Moon never is. The Sun's
		// drag is on the sun-hit target, not a body disc.
		if (b && !b.moon) {
			addDrag(ev, () => {
				const mode = getConfig().earthMode;
				if (key === "earth") {
					return mode === GALILEAN
						? ({ time: false } as DragKind)
						: { time: true, R: displayedRate(b, KEPLERIAN) };
				}
				return { time: true, R: displayedRate(b, mode) };
			});
			if (key === "earth") {
				ev.dblclick = () => {
					simT = simTimeForNow(bootMs, Date.now());
				};
			}
		}
		return ev;
	}

	function signEvents(i: number): EventMap {
		const ev: EventMap = {
			pointerenter: () => {
				hoveredSign = i;
			},
			pointerleave: () => {
				hoveredSign = null;
			},
			click: (e) => {
				e.stopPropagation();
				if (dragMoved) {
					dragMoved = false;
					return;
				}
				pinned = null;
				pinnedSign = pinnedSign === i ? null : i;
			},
		};
		addDrag(ev, () =>
			getConfig().earthMode === GALILEAN
				? { time: true, R: ZODIAC_DRAG_RATE }
				: { time: false },
		);
		return ev;
	}

	function sunHitEvents(): EventMap {
		const ev: EventMap = {
			pointerenter: () => {
				hovered = { key: "sun", name: "SUN" };
			},
			pointerleave: () => {
				hovered = null;
			},
			click: (e) => {
				e.stopPropagation();
				if (dragMoved) {
					dragMoved = false;
					return;
				}
				pinned = pinned?.key === "sun" ? null : { key: "sun", name: "SUN" };
			},
		};
		addDrag(ev, () =>
			getConfig().earthMode === PTOLEMAIC
				? { time: true, R: displayedRate(EARTH, KEPLERIAN) }
				: null,
		);
		return ev;
	}

	// Merge drag pointer handlers into an event map. Uses pointer capture
	// (permitted inside `events:` handlers) and per-handler current-target.
	function addDrag(ev: EventMap, resolve: () => DragKind | null): void {
		ev.pointerdown = (e) => {
			const pe = e as PointerEvent;
			const kind = resolve();
			if (!kind) return;
			dragMoved = false;
			const cap = e.currentTarget as Element & {
				setPointerCapture(id: number): void;
			};
			cap.setPointerCapture(pe.pointerId);
			const { cx, cy } = center();
			dragging = {
				kind,
				prevAngle: dialAngle(pe.clientX - cx, pe.clientY - cy),
				moved: false,
				acc: 0,
			};
		};
		ev.pointermove = (e) => {
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
		};
		const end = (e: Event) => {
			if (!dragging) return;
			const pe = e as PointerEvent;
			const cap = e.currentTarget as Element & {
				releasePointerCapture(id: number): void;
			};
			try {
				cap.releasePointerCapture(pe.pointerId);
			} catch {
				// capture may already be released (e.g. pointercancel)
			}
			if (dragging.moved) dragMoved = true;
			dragging = null;
		};
		ev.pointerup = end;
		ev.pointercancel = end;
	}

	// Bind the per-boundary events through the view (no raw element listeners).
	view.bindEvents({
		body: bodyEvents,
		sign: signEvents,
		sunHit: sunHitEvents,
	});

	// Dial-root pointer wiring (parallax + clear-pins), applied through Jiffies
	// `up()` (works on the raw page-emitted <svg>, which loses its build-time
	// `.update` graft when the browser re-parses the serialized SSG markup)
	// rather than svg.addEventListener.
	up(svg, {
		events: {
			pointermove: (e: Event) => {
				const pe = e as PointerEvent;
				updateMouse(pe.clientX, pe.clientY);
			},
			pointerleave: () => {
				mouseNX = 0;
				mouseNY = 0;
			},
			pointerdown: () => {
				pinned = null;
				pinnedSign = null;
			},
		},
	});

	// CSS-custom-property color resolver (getComputedStyle-backed; permitted read).
	function colorResolver(key: string): string {
		return (
			getComputedStyle(document.documentElement)
				.getPropertyValue(`--${key}`)
				.trim() || "#888"
		);
	}

	function frame(now: number) {
		const cfg = getConfig();
		let dt = (now - last) / 1000;
		last = now;
		if (dragging) dt = 0;
		else if (dt > 0.1) dt = 0.1;
		simT += dt * cfg.speed;

		// Re-seed boot phases when crossing into/out of the Ptolemaic seed group.
		if (cfg.earthMode !== prevEarthMode) {
			seedFor(cfg.earthMode);
		}

		const r = svg.getBoundingClientRect();
		const input: FrameInput = {
			config: cfg,
			simT,
			bootMs,
			wallNow: new Date(),
			caseOffset,
			prevEarthMode,
			mouse: { nx: mouseNX, ny: mouseNY },
			interaction: {
				hovered: hovered?.key ?? null,
				pinned: pinned?.key ?? null,
				hoveredSign,
				pinnedSign,
				dragging: dragging !== null,
			},
			layout: {
				rect: { left: r.left, top: r.top, width: r.width, height: r.height },
				viewport: { width: window.innerWidth, height: window.innerHeight },
			},
			color: colorResolver,
		};

		const scene = simulate(input);
		view.update(scene);

		// Fold mutable loop state forward.
		caseOffset = scene.next.caseOffset;
		prevEarthMode = scene.next.prevEarthMode;

		requestAnimationFrame(frame);
	}

	requestAnimationFrame(frame);
}
