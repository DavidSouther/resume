// The mermaid DiagramDefinition for `traceDiagram`.
//
// One shared db rather than a per-render instance: mermaid does not tell the
// parser which instance a getter handed it. Isolation rests on mermaid calling
// `db.clear()` before every `parser.parse()`.

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
		// Falls back to parsing when `draw` runs outside a mermaid render.
		const stored = db.getModel();
		const model =
			stored.frames.length || stored.heap.length ? stored : parseTrace(text);
		const drawn = drawTrace(
			model,
			document.createDocumentFragment() as unknown as Element,
		);
		// viewBox only, never a fixed width: a width attribute makes a wide trace
		// overflow the article column and clip instead of scaling down.
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
