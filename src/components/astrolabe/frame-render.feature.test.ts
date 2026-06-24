// @vitest-environment jsdom

// Feature test (Astrolabe FCC refactor, Feature 1 — dial render pipeline): one
// frame of per-frame state is computed by a PURE simulation in lib
// (`simulate(input) -> Scene`, no DOM), and the dial is a tree of Jiffies SVG
// function components updated from the root (`view.update(scene)`) with no DOM
// math in the component. One frame flows simulate -> DOM, and the DOM is a
// faithful projection of the Scene.
//
// Behavior-scoped on purpose: it reads rendered nodes by class/id from the SVG,
// never through a ref object, so the internal component shapes can move freely
// while this still defines "delivered". It drives the no-interaction frame, so it
// needs no requestAnimationFrame and no real layout.
//
// RED today: `src/lib/astrolabe/simulate.ts` and
// `src/components/astrolabe/view.ts` do not exist yet. See
// .ailly/developer/2026-06-23-A-astrolabe-fcc-refactor/design.md.
import { afterEach, describe, expect, it } from "vitest";
import page from "../../../pages/astrolabe/page.ts";
import { BODIES } from "../../lib/astrolabe/bodies.ts";
import { type FrameInput, simulate } from "../../lib/astrolabe/simulate.ts";
import { type Config, GALILEAN } from "../../lib/astrolabe/types.ts";
import { mount, resetDom } from "../test-dom.ts";
import { astrolabeView } from "./view.ts";

afterEach(resetDom);

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

// simulate() stays DOM-free: the CSS-custom-property color lookup is injected as a
// resolver, so gradient-stop colors are computed in the pure layer. A stub keeps
// the frame deterministic and independent of any stylesheet.
function frameInput(): FrameInput {
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
		color: () => "#888",
	};
}

describe("astrolabe frame: pure simulation rendered through the FCC tree", () => {
	it("computes a Scene and projects it faithfully onto the SVG", () => {
		// Arrange: mount the page scaffold and wire the dial component tree.
		mount(page.default());
		const svg = document.getElementById("dial") as unknown as SVGSVGElement;
		const view = astrolabeView(svg);

		// Act: compute one frame purely, then push it into the root view.
		const scene = simulate(frameInput());
		view.update(scene);

		// Assert — the simulation produced a complete Scene: every body has a
		// transform string and its disc is rendered.
		for (const b of BODIES) {
			expect(typeof scene.bodies[b.key]?.transform).toBe("string");
			expect(svg.querySelector(`.disc-${b.key}`)).not.toBeNull();
		}

		// A frame invariant that is absolute, not tautological: the sun-direction
		// sign is always occupied by Earth (the Sun-Earth axis sign is labelled
		// Earth every frame, in every Earth mode).
		expect(scene.sunSign).toBeGreaterThanOrEqual(0);
		expect(scene.sunSign).toBeLessThan(12);
		expect(scene.occupancy[scene.sunSign]).toContain("earth");

		// The simulated clock string carries the expected complication format.
		expect(scene.simClock).toMatch(
			/^\d{1,2} [A-Z]{3} \d{4}\s+·\s+\d{2}:\d{2}$/,
		);

		// Faithful projection (no DOM math in the component): the Mars disc carries
		// exactly the simulated transform.
		expect(svg.querySelector(".disc-mars")?.getAttribute("transform")).toBe(
			scene.bodies.mars.transform,
		);

		// Every zodiac divider path and lit-state matches the simulated zodiac,
		// applied through el.update() rather than recomputed in the view.
		const divs = svg.querySelectorAll("#zdivs .zdiv");
		const wedges = svg.querySelectorAll("#zwedges .zwedge");
		expect(divs).toHaveLength(12);
		expect(wedges).toHaveLength(12);
		for (let i = 0; i < 12; i++) {
			expect(divs[i].getAttribute("d")).toBe(scene.zodiac[i].dividerD);
			expect(wedges[i].classList.contains("active")).toBe(
				scene.zodiac[i].active,
			);
		}

		// The sim-clock overlay shows the simulated string (a document-level FCC
		// owned by the view, updated from the same Scene).
		const simClockEl = document.getElementById("simClock") as HTMLElement;
		expect(simClockEl.textContent).toBe(scene.simClock);
	});
});
