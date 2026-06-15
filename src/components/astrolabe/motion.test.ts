// @vitest-environment jsdom
//
// Functional suite for the tickable motion engine (F3, Step 5). One functional
// test class (the parsimony ceiling): SimulatedClock maps elapsed real time by
// the speed factor and stays continuous across setSpeed; MotionEngine.tick
// re-applies the [data-body] transforms and refreshes zodiac occupancy for a
// simulated date, and honors the render mode (geocentric pins Earth on +x;
// orbital releases it).
//
// rAF-driven start()/stop() cadence is browser-verified (design §Summary), not
// asserted here — tick is kept pure of rAF so it is unit-testable in jsdom. The
// "moved" checks are derived by inequality, not exact coordinates; occupancy is
// asserted against the same pure occupantsBySign over the rendered positions.
import { afterEach, describe, expect, it } from "vitest";
import { occupantsBySign, ZODIAC_SIGNS } from "../../lib/astro-zodiac.ts";
import { mount, resetDom } from "../test-dom.ts";
import { Astrolabe } from "./astrolabe.ts";
import { ephemerisPositions } from "./ephemeris.ts";
import { MotionEngine, SimulatedClock } from "./motion.ts";
import { RENDER_MODE_ATTR } from "./render-mode.ts";

afterEach(resetDom);

/** Milliseconds in roughly one calendar year (the SPEED_FACTOR.fast anchor). */
const YEAR_MS = 31_557_600_000;

/** The translate() string on a body group, or "" when the body sits at center. */
function bodyTransform(root: ParentNode, body: string): string {
	const group = root.querySelector(`[data-body="${body}"]`);
	return group?.getAttribute("transform") ?? "";
}

/** The lit-sign id set on a rendered band, sorted for order-stable comparison. */
function litSigns(root: ParentNode): string[] {
	return ZODIAC_SIGNS.filter((sign) =>
		root
			.querySelector(`[data-sign="${sign.id}"]`)
			?.hasAttribute("data-occupied"),
	)
		.map((sign) => sign.id)
		.sort();
}

/** The expected lit-sign set from the pure occupancy math, sorted. */
function expectedLitSigns(date: Date): string[] {
	const occupants = occupantsBySign(ephemerisPositions(date));
	return ZODIAC_SIGNS.filter(
		(sign) => (occupants.get(sign.id) ?? []).length > 0,
	)
		.map((sign) => sign.id)
		.sort();
}

describe("MotionEngine drives the dial from a SimulatedClock", () => {
	it("maps elapsed real time by the speed factor", () => {
		const d0 = new Date("2026-06-14T00:00:00.000Z");
		const realtime = new SimulatedClock(d0, "realtime");
		const fast = new SimulatedClock(d0, "fast");

		// Realtime tracks the wall clock 1:1: 60 s elapsed advances 60 s.
		expect(realtime.simulatedAt(60_000).getTime()).toBe(d0.getTime() + 60_000);
		// Fast ≈ one year per real minute: 60 s elapsed advances ~1 year.
		expect(fast.simulatedAt(60_000).getTime()).toBeCloseTo(
			d0.getTime() + YEAR_MS,
			-6,
		);
	});

	it("keeps simulated time continuous across a setSpeed change", () => {
		const d0 = new Date("2026-06-14T00:00:00.000Z");
		const clock = new SimulatedClock(d0, "realtime");

		// Read the simulated time at 10 real seconds (the switch instant), then
		// flip to fast: re-anchoring must not jump the simulated time AT that
		// instant — only the rate going forward changes.
		const atSwitch = clock.simulatedAt(10_000).getTime();
		clock.setSpeed("fast");
		expect(clock.simulatedAt(10_000).getTime()).toBe(atSwitch);

		// One more real second after the switch now advances at the fast rate:
		// the next second adds ~1/60 of a year, not 1 second.
		const afterOneSecond = clock.simulatedAt(11_000).getTime();
		expect(afterOneSecond - atSwitch).toBeGreaterThan(YEAR_MS / 100);
	});

	it("re-applies body transforms and refreshes occupancy for a future date", () => {
		const container = mount(Astrolabe());
		const engine = new MotionEngine(
			container,
			new SimulatedClock(new Date(), "realtime"),
		);
		const future = new Date("2027-12-25T00:00:00.000Z");

		const before = bodyTransform(container, "mars");
		engine.tick(future);
		const after = bodyTransform(container, "mars");

		// Mars moved (inequality, not exact coordinates).
		expect(after).not.toBe(before);
		// The lit-sign set matches the pure occupancy math for the simulated date.
		expect(litSigns(container)).toEqual(expectedLitSigns(future));
	});

	it("pins Earth on +x in geocentric mode and releases it in orbital mode", () => {
		const container = mount(Astrolabe());
		const root = container.querySelector(".astrolabe") as Element;
		const engine = new MotionEngine(
			container,
			new SimulatedClock(new Date(), "realtime"),
		);
		const date = new Date("2027-12-25T00:00:00.000Z");

		// Geocentric (default): Earth stays pinned on the +x ray (y == 0).
		engine.tick(date);
		const geocentric = bodyTransform(container, "earth");
		expect(geocentric).toMatch(/translate\(\s*[\d.]+\s*,\s*0\s*\)/);

		// Orbital: Earth is released off +x (its transform changes).
		root.setAttribute(RENDER_MODE_ATTR, "orbital");
		engine.tick(date);
		const orbital = bodyTransform(container, "earth");
		expect(orbital).not.toBe(geocentric);
	});

	it("tick is no-op-safe when the dial bodies and band are absent", () => {
		const bare = mount(document.createElement("div"));
		const engine = new MotionEngine(
			bare,
			new SimulatedClock(new Date(), "realtime"),
		);

		expect(() => engine.tick(new Date())).not.toThrow();
	});

	it("stop after start cancels cleanly without throwing on a double stop", () => {
		const container = mount(Astrolabe());
		const engine = new MotionEngine(
			container,
			new SimulatedClock(new Date(), "realtime"),
		);

		engine.start();
		expect(() => {
			engine.stop();
			engine.stop();
		}).not.toThrow();
	});
});
