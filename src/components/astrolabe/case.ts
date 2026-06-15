// The portrait watch case figure (Contract 1 framing, prebaked finish).
//
// Wraps the passed dial container in an HTML <figure>: strap-top / platinum case /
// strap-bottom. The strap and bezel decoration is CSS-painted on plain <div>
// carriers (cordovan + tonal stitch on the strap; a platinum ring + lacquer well
// on the bezel) reading the material tokens directly, so the #debug material
// section retints the platinum, cordovan, and stitch live via setProperty.
//
// The carrier is intentionally NOT an <svg>: the populated dial (dial.ts) is the
// single queryable <svg> in the Astrolabe tree (the F2 thesis contract), and the
// F1 design names the decoration carrier a build judgment, not a contract — only
// the look (tokens, live retint) is fixed. The finish is painted by the
// `.astrolabe-*` classes (global.css), which read the material tokens; this module
// only assembles the structure.
import { div, figure } from "@davidsouther/jiffies/dom/html.ts";

function strap(position: "top" | "bottom"): Element {
	return div({ class: `astrolabe-strap astrolabe-strap-${position}` });
}

/** Portrait <figure>: strap-top / platinum case wrapping the passed dial / strap-bottom. */
export function WatchCase(dial: Element): Element {
	return figure(
		{ class: "astrolabe-case" },
		strap("top"),
		div(
			{ class: "astrolabe-bezel" },
			div({ class: "astrolabe-bezel-ring" }),
			dial,
		),
		strap("bottom"),
	);
}
