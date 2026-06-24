// @vitest-environment jsdom

// Regression guard (Astrolabe FCC refactor): the dial must update its
// page-emitted static-id elements (twilight cone, guilloche clip, hands,
// clocks) in PRODUCTION, i.e. after the SSG serializes the page to HTML and the
// browser re-parses it. Re-parsing creates brand-new element objects that do
// NOT carry Jiffies' build-time `.update` graft, so any code path that relies on
// `el.update(...)` against a queried page element is a silent no-op in the
// browser. The sibling frame-render test mounts `page.default()` IN MEMORY,
// where the graft survives — so it cannot catch this class of bug. This test
// closes that blind spot by round-tripping the markup through serialize→reparse
// (the production fidelity loss) before wiring the view.
//
// The fix is to apply updates with Jiffies' `up()` (which works on any raw
// element), the same mechanism controls.ts already uses against the document
// root. See .ailly/developer/2026-06-23-A-astrolabe-fcc-refactor/design.md.
import { afterEach, describe, expect, it } from "vitest";
import page from "../../../pages/astrolabe/page.ts";
import { type FrameInput, simulate } from "../../lib/astrolabe/simulate.ts";
import { type Config, GALILEAN } from "../../lib/astrolabe/types.ts";
import { resetDom } from "../test-dom.ts";
import { astrolabeView } from "./view.ts";

afterEach(resetDom);

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

// Render the page, serialize it, and re-parse the HTML into a fresh container.
// Re-parsing is what the browser does to SSG output; it strips the build-time
// `.update` graft from every element, reproducing production fidelity.
function mountRoundTripped(): HTMLElement {
	const built = page.default();
	const html = built.outerHTML;
	const container = document.createElement("div");
	container.innerHTML = html;
	document.body.append(container);
	return container;
}

describe("astrolabe frame: static-id elements update after the SSG round-trip", () => {
	it("drives cone / clip / hands / clocks through the view post-reparse", () => {
		const container = mountRoundTripped();
		const svg = container.querySelector("#dial") as unknown as SVGSVGElement;

		// Sanity: the re-parsed dial elements have lost their `.update` graft, so
		// this really is the production fidelity (not the in-memory shortcut).
		const cone = svg.querySelector("#twilightCone") as Element & {
			update?: unknown;
		};
		expect(cone).not.toBeNull();
		expect(cone.update).toBeUndefined();

		const view = astrolabeView(svg);
		const scene = simulate(frameInput());
		view.update(scene);

		// The hour hand's per-frame transform reaches the page-emitted #handHour.
		expect(svg.querySelector("#handHour")?.getAttribute("transform")).toBe(
			scene.hands.hourTransform,
		);
		expect(svg.querySelector("#handMin")?.getAttribute("transform")).toBe(
			scene.hands.minuteTransform,
		);

		// The twilight cone and guilloche clip paths receive their simulated `d`.
		expect(svg.querySelector("#twilightCone")?.getAttribute("d")).toBe(
			scene.coneD,
		);
		expect(svg.querySelector("#guillocheClipPath")?.getAttribute("d")).toBe(
			scene.guilloche.clipD,
		);

		// The document-overlay clocks show the simulated strings.
		expect(document.getElementById("simClock")?.textContent).toBe(
			scene.simClock,
		);
		expect(document.getElementById("realClock")?.textContent).toBe(
			scene.realClock,
		);
	});
});
