// Astrolabe bootstrap. Builds the stage from the same `buildStage()` the SSG used,
// swaps it in for the server-rendered markup so every interactive node is a live
// handle the pipeline holds (never queried), then wires the render seam, controls
// drawer, and animation loop from those handles. This is the one module permitted
// the page-lifecycle DOM touchpoints — the single mount swap, the `<svg>` host
// sizing, and the window/visualViewport listeners — and is excluded from the
// no-raw-dom guard accordingly (see design, Deferred decisions).
import { dialSizePx } from "../../lib/astrolabe/math.ts";
import { startAnimation } from "./animation.ts";
import { initControls } from "./controls-components.ts";
import { buildStage } from "./stage.ts";

window.addEventListener("DOMContentLoaded", () => {
	const stage = buildStage();
	// Adopt the freshly-built stage in place of the server-rendered one: the new
	// tree carries the same ids/classes (identical markup), so first paint is
	// unchanged, but every node is now one the pipeline holds a reference to.
	document.getElementById("stage-wrap")?.replaceWith(stage.root);

	const svg = stage.dial;

	const { getConfig } = initControls(stage.root);

	// Host sizing: writes the <svg> host element's width/height and the `--dial-px`
	// custom property on the document root. Reads the case-size selection from the
	// controller's config (the single source of truth) rather than a DOM handle.
	// These host-element/documentElement style writes are the sanctioned
	// page-lifecycle wiring kept in the bootstrap.
	function sizeDial() {
		const s = dialSizePx(
			getConfig().sizeMode,
			window.innerWidth,
			window.innerHeight,
		);
		svg.style.width = `${s}px`;
		svg.style.height = `${s}px`;
		document.documentElement.style.setProperty("--dial-px", `${s}px`);
	}

	sizeDial();
	window.addEventListener("resize", sizeDial);
	if (window.visualViewport) {
		window.visualViewport.addEventListener("resize", sizeDial);
	}

	startAnimation(stage.root, svg, getConfig);
});
