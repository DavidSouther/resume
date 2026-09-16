// The mermaid DiagramDefinition for `traceDiagram`.
//
// Mermaid's guide offers two ways to keep a db from carrying state between
// renders: a getter handing out a fresh instance, or one shared db that mermaid
// resets. This uses the shared db, because mermaid does not tell the parser
// which instance a getter handed it — only jison-based diagrams receive one on
// `parser.yy`. Mermaid calls `db.clear()` before every `parser.parse()`, so the
// reset is what guarantees isolation here.

import { TraceDb } from "./db.ts";
import { parseTrace } from "./parse.ts";
import { drawTrace } from "./render-trace.ts";
import { getStyles } from "./styles.ts";

export const db = new TraceDb();

export const parser = {
	parse(text: string): void {
		db.setModel(parseTrace(text));
	},
};

export const renderer = {
	draw(text: string, id: string): void {
		// getElementById, not a `#id` selector: mermaid's generated ids are not
		// always valid CSS identifiers, and CSS.escape is absent under jsdom.
		const host = document.getElementById(id);
		if (!host) throw new Error(`traceDiagram: no element for id ${id}`);
		// Mermaid has already run the parser, so the model is on the db. Fall back
		// to parsing when `draw` is called on its own, outside a mermaid render.
		const stored = db.getModel();
		const model =
			stored.frames.length || stored.heap.length ? stored : parseTrace(text);
		const drawn = drawTrace(
			model,
			document.createDocumentFragment() as unknown as Element,
		);
		// viewBox only, never a fixed width: a wide trace given `width="1322"`
		// overflows the article column and is clipped rather than scaled. The
		// viewBox plus `max-width:100%` lets the diagram shrink to fit instead.
		const viewBox = drawn.getAttribute("viewBox");
		if (viewBox) host.setAttribute("viewBox", viewBox);
		host.removeAttribute("width");
		host.removeAttribute("height");
		host.setAttribute("preserveAspectRatio", "xMinYMin meet");
		host.setAttribute("style", "max-width:100%;height:auto");
		host.setAttribute("aria-roledescription", "traceDiagram");
		host.append(...drawn.childNodes);
	},
};

export const styles = getStyles;

export const diagram = { parser, db, renderer, styles };
