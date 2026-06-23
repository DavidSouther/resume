import { circle, ellipse, g, line } from "@davidsouther/jiffies/dom/svg.ts";
import { BODIES } from "../../lib/astrolabe/bodies.ts";

const CX = 500;
const CY = 500;

import type { BodyName } from "../../lib/astrolabe/types.ts";

export type PlanetRefs = Record<BodyName, Element>;

export function buildPlanets(grp: SVGGElement): PlanetRefs {
	const refs = {} as PlanetRefs;

	for (const b of BODIES.values()) {
		// Moon group uses local origin; placed on Earth each frame
		const ox = b.moon ? 0 : CX;
		const oy = b.moon ? 0 : CY;
		const dx = ox + b.r;

		const group = g({ class: `disc disc-${b.key}` });

		group.appendChild(circle({ class: "orbit-ring", cx: ox, cy: oy, r: b.r }));
		group.appendChild(line({ class: "spoke", x1: ox, y1: oy, x2: dx, y2: oy }));

		if (b.ring) {
			group.appendChild(
				ellipse({
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
				circle({ class: "earth-ring", cx: dx, cy: oy, r: b.dot + 3 }),
			);
		}

		group.appendChild(
			circle({
				class: "planet",
				cx: dx,
				cy: oy,
				r: b.dot,
				fill: `var(--${b.key})`,
			}),
		);

		group.appendChild(
			circle({
				class: "hit",
				cx: dx,
				cy: oy,
				r: Math.max(16, b.dot + 11),
			}),
		);

		grp.appendChild(group);
		refs[b.key] = group;
	}

	return refs;
}
