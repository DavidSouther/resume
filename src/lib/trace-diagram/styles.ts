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
  `;
}

export default getStyles;
