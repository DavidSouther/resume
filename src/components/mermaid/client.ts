// Boots mermaid for a page that carries diagrams, and registers the site's own
// `traceDiagram` type with it.
//
// The URL arrives as a <meta> tag rather than an import for two reasons: the
// module that resolves it uses node:fs, and keeping the specifier a variable
// stops Rollup resolving a CDN URL at build time.

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

// A failure degrades to the pre block, which stays legible as text.
//
// Steppers mount after `bootMermaid` settles, because the timed elements live
// in the SVG mermaid draws. `.finally`, not `.then`: `mermaid.run` rethrows
// the first error it met after drawing the rest, so one unrenderable fence
// must not cost every other figure its control bar. A figure that failed to
// draw carries no `[data-at]` and is skipped.
void bootMermaid()
	.catch((error) => {
		console.error("mermaid failed to render", error);
	})
	.finally(() => {
		mountTraceSteppers(document);
	});
