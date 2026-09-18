// Boots mermaid for a page that carries diagrams, and registers the site's own
// `traceDiagram` type with it.
//
// The mermaid URL arrives as a <meta name="mermaid-src"> rendered by the page
// head, not as an import: `src/lib/mermaid-bundle.ts` reads it from the
// installed package with node:fs and so cannot be bundled for the browser.
// Reading it from the DOM also keeps the import specifier a variable, which is
// what stops the SSG's Rollup pass from trying to resolve a CDN URL at build
// time and leaves it a genuine runtime import.

import { traceDiagram } from "../../lib/trace-diagram/detector.ts";
import { mountTraceSteppers } from "../../lib/trace-stepper/stepper.ts";

interface MermaidApi {
	initialize(config: Record<string, unknown>): void;
	registerExternalDiagrams(diagrams: unknown[]): Promise<void>;
	run(options: { querySelector: string }): Promise<void>;
}

export async function bootMermaid(): Promise<boolean> {
	// A page with no diagrams pays nothing: mermaid is never fetched.
	if (!document.querySelector("pre.mermaid")) return false;

	const src = document
		.querySelector('meta[name="mermaid-src"]')
		?.getAttribute("content");
	if (!src) return false;

	const module = (await import(/* @vite-ignore */ src)) as {
		default: MermaidApi;
	};
	const mermaid = module.default;

	mermaid.initialize({ startOnLoad: false, securityLevel: "strict" });
	await mermaid.registerExternalDiagrams([traceDiagram]);
	await mermaid.run({ querySelector: "pre.mermaid" });
	return true;
}

// The diagram source stays legible as text if any of this fails, so a failure
// degrades to the pre block rather than to an empty figure.
//
// The steppers mount only after `bootMermaid` settles: the timed elements live
// in the SVG mermaid draws, so before that there is nothing to step. A figure
// whose diagram failed to draw carries no `[data-at]` and is skipped, which is
// what keeps a failed render from growing a control bar it cannot drive.
//
// It mounts whether mermaid resolved or rejected. `mermaid.run` rethrows the
// first error it met after drawing the rest, so one unrenderable fence on the
// page must not cost every other figure its control bar.
void bootMermaid()
	.catch((error) => {
		console.error("mermaid failed to render", error);
	})
	.finally(() => {
		mountTraceSteppers(document);
	});
