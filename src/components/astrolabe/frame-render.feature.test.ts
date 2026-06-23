// @vitest-environment jsdom

// Feature test for the Astrolabe animation refactor: per-frame state is computed
// by a PURE simulation in lib (`simulateFrame -> FrameState`), and the dial is a
// tree of SVG function components rooted at `astrolabeView`, updated from the root
// (`view.update(state)`) with no per-frame DOM math in the component. One frame's
// worth of state flows sim -> DOM, and the DOM is a faithful projection of it.
//
// Deliberately behavior-scoped: it pins the two new seams and one frame-invariant
// absolute fact, reading rendered nodes by class/id from the SVG rather than
// through any ref object, so internal component shapes can move freely while this
// still defines "delivered". It drives the no-interaction frame, so it needs no
// requestAnimationFrame and no real layout.
//
// Red until Steps 2 + 3 land (`src/lib/astrolabe/simulation.ts` and
// `src/components/astrolabe/view.ts` do not exist yet). See
// .ailly/developer/2026-06-17-B-astrolabe-refactor/design.md.
import { afterEach, describe, expect, it } from "vitest";
import page from "../../../pages/astrolabe/page.ts";
import { BODIES } from "../../lib/astrolabe/bodies.ts";
import { simulateFrame } from "../../lib/astrolabe/simulation.ts";
import { type Config, GALILEAN } from "../../lib/astrolabe/types.ts";
import { mount, resetDom } from "../test-dom.ts";
import { astrolabeView } from "./view.ts";

afterEach(() => {
	resetDom();
});

// A fixed, deterministic frame at the default Galilean config with parallax off
// (so body transforms do not depend on a mouse position) and no hover/pin/drag
// (so the layout-dependent tooltip and sign-card paths stay inert in jsdom).
const BOOT_MS = Date.UTC(2026, 0, 1, 12, 0, 0);
const CONFIG: Config = {
	speed: 0,
	sizeMode: "full",
	earthMode: GALILEAN,
	parallaxOn: false,
	parallax: 0.7,
	occ: true,
	twilight: true,
	guilloche: true,
	guillocheN: 120,
	hands: true,
};

function frameInput() {
	return {
		config: CONFIG,
		simT: 0,
		bootMs: BOOT_MS,
		wallNow: new Date(BOOT_MS),
		caseOffset: 0,
		prevEarthMode: GALILEAN,
		mouse: { nx: 0, ny: 0 },
		interaction: {
			hovered: null,
			pinned: null,
			hoveredSign: null,
			pinnedSign: null,
			dragging: false,
		},
		layout: {
			rect: { left: 0, top: 0, width: 1000, height: 1000 },
			viewport: { width: 1000, height: 1000 },
		},
	};
}

describe("astrolabe frame: pure simulation rendered through the component tree", () => {
	it("computes a FrameState and projects it faithfully onto the SVG", () => {
		// Arrange: mount the page scaffold and build the dynamic component tree.
		mount(page.default());
		const svg = document.getElementById("dial") as unknown as SVGSVGElement;
		const view = astrolabeView(svg);

		// Act: compute one frame's state purely, then push it into the root view.
		const state = simulateFrame(frameInput());
		view.update(state);

		// Assert — the simulation produced a complete FrameState: every celestial
		// body has a transform, and the rendered disc exists for each.
		for (const b of BODIES.values()) {
			expect(typeof state.bodies[b.key]?.transform).toBe("string");
			const disc = svg.querySelector(`.disc-${b.key}`);
			expect(disc).not.toBeNull();
		}

		// A frame invariant that is absolute, not tautological: the sun-direction
		// sign is always occupied by Earth (the Sun-Earth axis sign is labelled
		// Earth every frame, in every Earth mode).
		expect(state.sunSign).toBeGreaterThanOrEqual(0);
		expect(state.sunSign).toBeLessThan(12);
		expect(state.occupancy[state.sunSign]).toContain("earth");

		// The simulated clock string carries the expected complication format.
		expect(state.simClock).toMatch(
			/^\d{1,2} [A-Z]{3} \d{4}\s+·\s+\d{2}:\d{2}$/,
		);

		// Assert — the render is a faithful projection of the state (no DOM math in
		// the component): the Mars disc carries exactly the simulated transform.
		expect(svg.querySelector(".disc-mars")?.getAttribute("transform")).toBe(
			state.bodies.mars.transform,
		);

		// Every zodiac divider path and lit-state matches the simulated zodiac,
		// applied through the component's el.update() rather than recomputed here.
		const divs = svg.querySelectorAll("#zdivs .zdiv");
		const wedges = svg.querySelectorAll("#zwedges .zwedge");
		expect(divs).toHaveLength(12);
		expect(wedges).toHaveLength(12);
		for (let i = 0; i < 12; i++) {
			expect(divs[i].getAttribute("d")).toBe(state.zodiac[i].dividerD);
			expect(wedges[i].classList.contains("active")).toBe(
				state.zodiac[i].active,
			);
		}

		// The sim clock element shows the simulated string.
		const simClockEl = document.getElementById("simClock") as HTMLElement;
		expect(simClockEl.textContent).toBe(state.simClock);
	});
});
