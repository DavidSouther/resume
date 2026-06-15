import type { Config } from "../../lib/astrolabe/types.ts";
import type { PlanetRefs } from "./planets.ts";
import type { ZodiacRefs } from "./zodiac.ts";

export function startAnimation(
	_svg: SVGSVGElement,
	_zodiac: ZodiacRefs,
	_planets: PlanetRefs,
	_getConfig: () => Config,
): void {
	throw new Error("not implemented");
}
