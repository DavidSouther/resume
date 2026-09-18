// Mermaid hands `getStyles` the resolved theme variables. Every colour must come
// from that object — a literal here would survive a theme switch and break the
// diagram in dark mode.

export interface TraceStyleOptions {
	lineColor?: string;
	textColor?: string;
	errorBkgColor?: string;
	mainBkg?: string;
	nodeBorder?: string;
	tertiaryColor?: string;
}

export function getStyles(options: TraceStyleOptions = {}): string {
	const stroke = options.lineColor ?? "currentColor";
	const ink = options.textColor ?? "currentColor";
	const struck = options.errorBkgColor ?? stroke;
	const border = options.nodeBorder ?? stroke;
	const surface = options.tertiaryColor ?? options.mainBkg ?? "transparent";

	// The accent for the item a step reveals. `--color-primary` is declared on
	// :root by jiffies-css and inherits into the inline SVG, so it follows the
	// site's theme; mermaid's own variables carry no usable foreground accent.
	const accentInk = `var(--color-primary, ${ink})`;
	const accentStroke = `var(--color-primary, ${stroke})`;

	return `
    .trace-diagram { color: ${ink}; }
    .trace-diagram text { fill: ${ink}; }
    .trace-header, .trace-frame-label { font-style: italic; }
    .trace-divider, .trace-rule, .trace-heap-divider, .trace-heap-rule { stroke: ${stroke}; stroke-width: 2; fill: none; }
    .trace-scope { stroke: ${stroke}; stroke-width: 1.5; fill: none; }
    .trace-strike, .trace-frame-done { stroke: ${struck}; stroke-width: 2; fill: none; }
    .trace-value.trace-struck { opacity: 0.75; }
    .trace-return-arrow { stroke: ${stroke}; stroke-width: 1.5; fill: none; }
    .trace-pointer { stroke: ${stroke}; stroke-width: 1.5; fill: none; }
    .trace-pointer.trace-struck { stroke: ${struck}; opacity: 0.6; }
    .trace-arrowhead { fill: ${stroke}; stroke: none; }
    .trace-heap-rect { stroke: ${border}; stroke-width: 1.5; fill: ${surface}; }
    .trace-heap-address { font-size: 0.8em; opacity: 0.8; }
${steppingStyles(accentInk, accentStroke)}  `;
}

/**
 * The presentation of a stepped diagram.
 *
 * Every selector here is keyed on `[data-state]`, which only
 * `src/lib/trace-stepper/stepper.ts` ever writes, and only on a figure it has
 * mounted. A `[data-at]` element with no `data-state` — JavaScript off, before
 * mount, on print, or after a mermaid failure — matches nothing here and draws
 * exactly as the rules above draw it. An untagged diagram carries no `data-at`
 * at all, so none of this can reach it.
 *
 * `[data-at]` is repeated in every selector to lift it over the two-class
 * rules above: without it `.trace-pointer.trace-struck { opacity: 0.6 }` would
 * beat `[data-state="future"]` and leave a struck pointer visible before its
 * step arrives.
 *
 * A future item is invisible, not dim, and keeps its box. The geometry is
 * absolute SVG coordinates, so an opacity change moves nothing else on the
 * page and the item stays in the accessibility tree.
 */
function steppingStyles(accentInk: string, accentStroke: string): string {
	// A generous fallback for an engine with no SVG geometry API. The stepper
	// measures each arrow at mount and writes the real length into
	// `--trace-draw-length`, so this only has to exceed the longest path.
	const drawLength = "var(--trace-draw-length, 600)";
	// The elements a reveal draws rather than fades.
	const drawn = [
		"path.trace-return-arrow",
		"path.trace-pointer",
		"line.trace-strike",
	];
	const drawnWhen = (suffix: string): string =>
		drawn.map((selector) => `${selector}[data-at]${suffix}`).join(", ");

	return `
    [data-at][data-state="future"] { opacity: 0; }
    [data-at][data-state="current"] text, text[data-at][data-state="current"] { fill: ${accentInk}; }
    path[data-at][data-state="current"], line[data-at][data-state="current"] { stroke: ${accentStroke}; }

    @media (prefers-reduced-motion: no-preference) {
      [data-at][data-state]:not([data-motion="none"]) {
        transition: opacity 240ms ease, transform 240ms ease, fill 240ms ease, stroke 240ms ease;
      }
      g.trace-value-item[data-at][data-state] { transform: translate(0, 0); }
      g.trace-value-item[data-at][data-state="future"] { transform: translate(-8px, 0); }
      ${drawnWhen("[data-state]")} {
        stroke-dasharray: ${drawLength};
        stroke-dashoffset: 0;
      }
      ${drawnWhen('[data-state="future"]')} { stroke-dashoffset: ${drawLength}; }
      ${drawnWhen('[data-state]:not([data-motion="none"])')} {
        transition: stroke-dashoffset 380ms ease, stroke 240ms ease, opacity 0s;
      }
    }

    @media (prefers-reduced-motion: reduce) {
      [data-at][data-state] { transition: none; animation: none; transform: none; }
    }

    @media print {
      [data-at][data-state="future"] { opacity: 1; }
      [data-at][data-state]:not([data-motion="none"]) { transition: none; }
      g.trace-value-item[data-at][data-state] { transform: none; }
      ${drawnWhen('[data-state]:not([data-motion="none"])')} {
        transition: none;
        stroke-dasharray: none;
        stroke-dashoffset: 0;
      }
    }
`;
}

export default getStyles;
