// Boots mermaid for a page that carries diagrams, and registers the site's own
// `traceDiagram` type with it.
//
// The URL arrives as a <meta> tag rather than an import for two reasons: the
// module that resolves it uses node:fs, and keeping the specifier a variable
// stops Rollup resolving a CDN URL at build time.

import { traceDiagram } from "../../lib/trace-diagram/detector.ts";

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
void bootMermaid().catch((error) => {
	console.error("mermaid failed to render", error);
});
