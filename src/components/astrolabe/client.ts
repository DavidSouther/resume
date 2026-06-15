import { startAnimation } from "./animation.ts";
import { initControls } from "./controls.ts";
import { buildPlanets } from "./planets.ts";
import { initTexture } from "./texture.ts";
import { buildZodiac } from "./zodiac.ts";

function sizeDial() {
	const dial = document.getElementById("dial") as unknown as SVGSVGElement;
	const s = Math.max(160, Math.min(window.innerWidth, window.innerHeight) - 28);
	dial.style.width = `${s}px`;
	dial.style.height = `${s}px`;
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
