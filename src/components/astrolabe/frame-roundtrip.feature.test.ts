// @vitest-environment jsdom

// Regression guard (Astrolabe FCC refactor): the dial must update its leaf
// elements (twilight cone, guilloche clip, hands, clocks) in PRODUCTION. The SSG
// serializes the page to HTML and the browser re-parses it into brand-new element
// objects that carry no Jiffies `.update` graft and that the render pipeline holds
// no reference to. The client bootstrap closes that gap by building a FRESH stage
// (whose handles DO carry working updates) and adopting it in place of the
// re-parsed server markup. This test reproduces exactly that path: reparse the SSG
// output, run the adopt-swap, then drive the view through the adopted handles —
// proving the live DOM is the held handles, not the inert reparsed nodes. See
// .ailly/developer/2026-06-23-A-astrolabe-fcc-refactor/design.md.
import { afterEach, describe, expect, it } from "vitest";
import page from "../../../pages/astrolabe/page.ts";
import { type FrameInput, simulate } from "../../lib/astrolabe/simulate.ts";
import { type Config, GALILEAN } from "../../lib/astrolabe/types.ts";
import { resetDom } from "../test-dom.ts";
import { buildStage } from "./stage.ts";

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
			dragging: false,
		},
		layout: {
			rect: { left: 0, top: 0, width: 1000, height: 1000 },
			viewport: { width: 1000, height: 1000 },
		},
		color: () => "#888",
	};
}

// Render the page and re-parse the HTML — exactly what the browser does to SSG
// output, producing inert markup that carries no build-time `.update` graft and
// that the render pipeline holds no reference to.
function reparseSSG(): void {
	const html = page.default().outerHTML;
	const container = document.createElement("div");
	container.innerHTML = html;
	document.body.append(container);
}

describe("astrolabe frame: the client adopts a fresh stage over reparsed SSG markup", () => {
	it("drives cone / clip / hands / clocks through the adopted handles", () => {
		// Arrange: the browser's view of SSG output — inert, graft-less markup.
		reparseSSG();
		const reparsed = document.getElementById("dial") as Element & {
			update?: unknown;
		};
		expect(reparsed).not.toBeNull();
		// Really graft-less: a reparsed element never carries Jiffies' `.update`.
		expect(reparsed.update).toBeUndefined();

		// Act: the client bootstrap — build a fresh stage and adopt it in place of
		// the reparsed markup, then drive one frame through the root component
		// (which fans the dial + overlays it owns). No element handle is poked.
		const stage = buildStage();
		document.getElementById("stage-wrap")?.replaceWith(stage.root);
		const scene = simulate(frameInput());
		stage.root.update({ scene });

		// The adopted dial IS the live DOM now (the inert reparsed dial is gone).
		expect(document.getElementById("dial")).toBe(stage.dial);

		// Per-frame values reach the leaf elements — read by selector off the live
		// dial, never through a handle bag.
		const svg = stage.dial;
		expect(svg.querySelector("#handHour")?.getAttribute("transform")).toBe(
			scene.hands.hourTransform,
		);
		expect(svg.querySelector("#handMin")?.getAttribute("transform")).toBe(
			scene.hands.minuteTransform,
		);
		expect(svg.querySelector("#twilightCone")?.getAttribute("d")).toBe(
			scene.coneD,
		);
		expect(svg.querySelector("#guillocheClipPath")?.getAttribute("d")).toBe(
			scene.guilloche.clipD,
		);

		// The overlay clocks show the simulated strings.
		expect(document.getElementById("simClock")?.textContent).toBe(
			scene.simClock,
		);
		expect(document.getElementById("realClock")?.textContent).toBe(
			scene.realClock,
		);
	});
});
