import { BODIES } from "../../lib/astrolabe/bodies.ts";

const SVGNS = "http://www.w3.org/2000/svg";
const CX = 500;
const CY = 500;

function svgEl<K extends keyof SVGElementTagNameMap>(
	tag: K,
	attrs: Record<string, string | number>,
): SVGElementTagNameMap[K] {
	const e = document.createElementNS(SVGNS, tag);
	for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
	return e;
}

export type PlanetRefs = Record<string, SVGElement>;

export function buildPlanets(g: SVGGElement): PlanetRefs {
	const refs: PlanetRefs = {};

	for (const b of BODIES) {
		// Moon group uses local origin; placed on Earth each frame
		const ox = b.moon ? 0 : CX;
		const oy = b.moon ? 0 : CY;
		const dx = ox + b.r;

		const group = svgEl("g", { class: `disc disc-${b.key}` });

		group.appendChild(
			svgEl("circle", { class: "orbit-ring", cx: ox, cy: oy, r: b.r }),
		);
		group.appendChild(
			svgEl("line", { class: "spoke", x1: ox, y1: oy, x2: dx, y2: oy }),
		);

		if (b.ring) {
			group.appendChild(
				svgEl("ellipse", {
					class: "saturn-ring",
					cx: dx,
					cy: oy,
					rx: b.dot + 6,
					ry: ((b.dot + 6) * 0.36).toFixed(2),
				}),
			);
		}

		if (b.key === "earth") {
			group.appendChild(
				svgEl("circle", { class: "earth-ring", cx: dx, cy: oy, r: b.dot + 3 }),
			);
		}

		const dot = svgEl("circle", {
			class: "planet",
			cx: dx,
			cy: oy,
			r: b.dot,
			fill: `var(--${b.key})`,
		});
		group.appendChild(dot);

		group.appendChild(
			svgEl("circle", {
				class: "hit",
				cx: dx,
				cy: oy,
				r: Math.max(16, b.dot + 11),
			}),
		);

		g.appendChild(group);
		refs[b.key] = group;
	}

	return refs;
}
