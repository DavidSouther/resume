import { startAnimation } from "./animation.ts";
import { initControls } from "./controls.ts";
import { buildPlanets } from "./planets.ts";
import { initTexture } from "./texture.ts";
import { buildZodiac } from "./zodiac.ts";

window.addEventListener("DOMContentLoaded", () => {
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
