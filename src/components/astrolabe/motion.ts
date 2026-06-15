// The tickable motion engine (CONSUMES Contract 1). rAF lives in start()/stop().
//
// SimulatedClock maps real elapsed time to a simulated Date via SPEED_FACTOR,
// re-anchoring on a speed change so simulated time stays continuous. MotionEngine
// re-queries the [data-body] groups each tick, re-applies their transforms from
// ephemerisPositions(simulated) (reading currentRenderMode to apply/drop the
// Earth-pin), and refreshes the zodiac occupancy. tick is kept pure of rAF so it
// is unit-testable in jsdom; start()/stop() wrap it in requestAnimationFrame.
import type { BodyPosition } from "../../lib/astro-math.ts";
import { geocentricTransform } from "../../lib/astro-math.ts";
import { ephemerisPositions } from "./ephemeris.ts";
import { currentRenderMode } from "./render-mode.ts";
import { SPEED_FACTOR, type Speed } from "./speed-toggle.ts";
import { refreshOccupancy } from "./zodiac.ts";

/**
 * Real-time → simulated-time mapping with a speed factor. Pure; no timers.
 *
 * `simulatedAt(realElapsedMs)` returns `start + realElapsedMs · factor`, where
 * factor is SPEED_FACTOR for the current speed. The clock remembers the last
 * elapsed reading so `setSpeed` can re-anchor at that instant: the simulated
 * time does NOT jump at the switch, only the forward rate changes.
 */
export class SimulatedClock {
	private start: Date;
	private speed: Speed;
	/** The last elapsed reading passed to simulatedAt — the setSpeed anchor. */
	private lastElapsedMs = 0;

	constructor(start: Date, speed: Speed) {
		this.start = start;
		this.speed = speed;
	}

	/**
	 * Re-anchor the clock to a new speed, keeping simulated time continuous at the
	 * last elapsed reading. Shifts `start` so that `simulatedAt(lastElapsedMs)` is
	 * unchanged while every later reading advances at the new rate.
	 */
	setSpeed(speed: Speed): void {
		const oldFactor = SPEED_FACTOR[this.speed];
		const newFactor = SPEED_FACTOR[speed];
		// start' = start + E·(Fold − Fnew) keeps sim(E) fixed at E = lastElapsedMs
		// while sim(t) = start' + t·Fnew advances at the new rate for t > E.
		this.start = new Date(
			this.start.getTime() + this.lastElapsedMs * (oldFactor - newFactor),
		);
		this.speed = speed;
	}

	/** Simulated Date for an elapsed real-millisecond reading. */
	simulatedAt(realElapsedMs: number): Date {
		this.lastElapsedMs = realElapsedMs;
		return new Date(
			this.start.getTime() + realElapsedMs * SPEED_FACTOR[this.speed],
		);
	}
}

/**
 * Re-applies body transforms + zodiac occupancy from a simulated date.
 *
 * The engine resolves the watch shell, the zodiac band, and each tick's bodies
 * from the root it was constructed with — re-querying every frame so it survives
 * a re-rendered dial. It is no-op-safe when the dial is absent (an engine built
 * against a bare node simply finds nothing to move).
 */
export class MotionEngine {
	private readonly root: ParentNode;
	private readonly clock: SimulatedClock;
	private frame: number | null = null;
	private startTime = 0;

	constructor(root: ParentNode, clock: SimulatedClock) {
		this.root = root;
		this.clock = clock;
	}

	/** Pure per-frame update: re-query [data-body], re-apply transforms, refresh occupancy. */
	tick(simulated: Date): void {
		const positions = ephemerisPositions(simulated);
		const orbital = currentRenderMode(this.root) === "orbital";
		const sunAngle = positions.find((p) => p.body === "sun")?.angle ?? 0;

		for (const position of positions) {
			const group = this.root.querySelector(`[data-body="${position.body}"]`);
			if (!group) {
				continue;
			}
			const { x, y } = this.placement(position, orbital, sunAngle);
			if (x !== 0 || y !== 0) {
				group.setAttribute("transform", `translate(${x},${y})`);
			} else {
				group.removeAttribute("transform");
			}
		}

		const band = this.root.querySelector("[data-zodiac-band]");
		if (band) {
			refreshOccupancy(band, positions);
		}
	}

	/** Begin the requestAnimationFrame loop driving tick. */
	start(): void {
		if (this.frame !== null) {
			return;
		}
		this.startTime = performance.now();
		const loop = (now: number): void => {
			this.tick(this.clock.simulatedAt(now - this.startTime));
			this.frame = requestAnimationFrame(loop);
		};
		this.frame = requestAnimationFrame(loop);
	}

	/** Cancel the requestAnimationFrame loop. Safe to call when already stopped. */
	stop(): void {
		if (this.frame !== null) {
			cancelAnimationFrame(this.frame);
			this.frame = null;
		}
	}

	/**
	 * The on-dial (x, y) for a body under the current render mode. Geocentric uses
	 * the position as computed (Earth pinned on +x). Orbital releases Earth onto
	 * its heliocentric direction — opposite the Sun's geocentric direction — so it
	 * leaves the +x ray; the other bodies are unchanged (full orbital correctness
	 * is browser-verified, design §Summary).
	 */
	private placement(
		position: BodyPosition,
		orbital: boolean,
		sunAngle: number,
	): { x: number; y: number } {
		if (orbital && position.body === "earth") {
			return geocentricTransform(sunAngle + Math.PI, position.radius);
		}
		return { x: position.x, y: position.y };
	}
}
