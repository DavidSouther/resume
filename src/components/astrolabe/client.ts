import { dialSizePx } from "../../lib/astrolabe/math.ts";
import type { SizeMode } from "../../lib/astrolabe/types.ts";
import { startAnimation } from "./animation.ts";
import { initControls } from "./controls.ts";
import { buildPlanets } from "./planets.ts";
import { initTexture } from "./texture.ts";
import { buildZodiac } from "./zodiac.ts";

function sizeDial() {
	const dial = document.getElementById("dial") as unknown as SVGSVGElement;
	const grp = document.getElementById("caseSize");
	const mode = (grp?.dataset.value as SizeMode) ?? "full";
	const s = dialSizePx(mode, window.innerWidth, window.innerHeight);
	dial.style.width = `${s}px`;
	dial.style.height = `${s}px`;
	// The strap mock sizes itself to the dial via this custom property.
	document.documentElement.style.setProperty("--dial-px", `${s}px`);
}

window.addEventListener("DOMContentLoaded", () => {
	sizeDial();
	window.addEventListener("resize", sizeDial);
	if (window.visualViewport) {
		window.visualViewport.addEventListener("resize", sizeDial);
	}

	const zodiac = buildZodiac(
		document.getElementById("zodiac") as unknown as SVGGElement,
	);
	const planets = buildPlanets(
		document.getElementById("discs") as unknown as SVGGElement,
	);
	initTexture(document.getElementById("dial") as unknown as SVGSVGElement);
	const { getConfig } = initControls();
	startAnimation(
		document.getElementById("dial") as unknown as SVGSVGElement,
		zodiac,
		planets,
		getConfig,
	);
});
