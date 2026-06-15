import { assertExists } from "@davidsouther/jiffies/assert.ts";
import { pt } from "../../lib/astrolabe/math.ts";

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

export function initTexture(svg: SVGSVGElement): void {
	const defs = assertExists(svg.querySelector("defs"), "#dial defs missing");

	const sheen = svgEl("radialGradient", {
		id: "dialSheen",
		gradientUnits: "userSpaceOnUse",
		cx: CX,
		cy: 452,
		r: 470,
	});
	const stop0 = svgEl("stop", { offset: "0%" });
	stop0.setAttribute("stop-color", "#9FB2DE");
	stop0.setAttribute("stop-opacity", "0.17");
	const stop1 = svgEl("stop", { offset: "55%" });
	stop1.setAttribute("stop-color", "#9FB2DE");
	stop1.setAttribute("stop-opacity", "0.05");
	const stop2 = svgEl("stop", { offset: "100%" });
	stop2.setAttribute("stop-color", "#9FB2DE");
	stop2.setAttribute("stop-opacity", "0");
	sheen.appendChild(stop0);
	sheen.appendChild(stop1);
	sheen.appendChild(stop2);
	defs.appendChild(sheen);

	// Populate the pre-existing #texture group created by buildDial()
	const tex = assertExists(
		svg.querySelector<SVGGElement>("#texture"),
		"#texture missing",
	);
	tex.appendChild(
		svgEl("circle", { cx: CX, cy: CY, r: 468, fill: "url(#dialSheen)" }),
	);
	for (let i = 0; i < 120; i++) {
		const ang = (i / 120) * 360;
		const a = pt(ang, 40);
		const b = pt(ang, 468);
		tex.appendChild(
			svgEl("line", {
				class: "tline",
				x1: a.x,
				y1: a.y,
				x2: b.x,
				y2: b.y,
				"stroke-width": 0.7,
				"stroke-opacity": (0.07).toFixed(3),
			}),
		);
	}

	// Populate the pre-existing #sparkles group
	const palette = ["#EAF0FF", "#EAF0FF", "#EAF0FF", "#F3DFA6", "#BFD2F2"];
	const sp = assertExists(
		svg.querySelector<SVGGElement>("#sparkles"),
		"#sparkles missing",
	);
	for (let k = 0; k < 160; k++) {
		const th = (k / 160) * Math.PI * 2;
		const rr = Math.sqrt((k + 0.5) / 160) * 456;
		const c = svgEl("circle", {
			class: "sparkle",
			cx: (CX + rr * Math.cos(th)).toFixed(1),
			cy: (CY + rr * Math.sin(th)).toFixed(1),
			r: (1.4 + ((k * 7) % 28) / 10).toFixed(2),
			fill: palette[k % palette.length],
		});
		c.style.setProperty("--o1", (0.6 + ((k * 3) % 40) / 100).toFixed(2));
		c.style.setProperty("--o0", (0.12 + ((k * 5) % 18) / 100).toFixed(2));
		c.style.setProperty("--d", `${(2.5 + ((k * 11) % 45) / 10).toFixed(2)}s`);
		c.style.setProperty("--dl", `${((k * 13) % 50) / 10}s`);
		sp.appendChild(c);
	}
}
