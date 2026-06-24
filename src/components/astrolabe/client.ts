import { dialSizePx } from "../../lib/astrolabe/math.ts";
import type { SizeMode } from "../../lib/astrolabe/types.ts";
import { startAnimation } from "./animation.ts";
import { initControls } from "./controls.ts";
import { astrolabeView } from "./view.ts";

// Host sizing: writes the <svg> host element's width/height and the
// `--dial-px` custom property on the document root. client.ts is the bootstrap
// module and is out of the Feature-1 no-raw-dom guard scope — these target the
// host element and documentElement, not a dial descendant (see design,
// Deferred decisions).
function sizeDial() {
	const dial = document.getElementById("dial") as unknown as SVGSVGElement;
	const grp = document.getElementById("caseSize");
	const mode = (grp?.dataset.value as SizeMode) ?? "full";
	const s = dialSizePx(mode, window.innerWidth, window.innerHeight);
	dial.style.width = `${s}px`;
	dial.style.height = `${s}px`;
	document.documentElement.style.setProperty("--dial-px", `${s}px`);
}

window.addEventListener("DOMContentLoaded", () => {
	sizeDial();
	window.addEventListener("resize", sizeDial);
	if (window.visualViewport) {
		window.visualViewport.addEventListener("resize", sizeDial);
	}

	const svg = document.getElementById("dial") as unknown as SVGSVGElement;
	const view = astrolabeView(svg);
	const { getConfig } = initControls();
	startAnimation(svg, view, getConfig);
});
