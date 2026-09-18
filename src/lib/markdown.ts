import { toHTML as jiffdown } from "@davidsouther/jiffdown";
import hljs from "highlight.js";
import { rewriteHighlightGutterFences } from "./highlight-gutters.ts";
import { resolveStepsFromSource } from "./trace-diagram/steps.ts";

// Syntax highlighting runs at build time, not in the browser: the markup is
// already in the HTML, so a listing is never briefly unstyled and a reader with
// JavaScript off still gets it. `SPECIFICATION.md` pairs this with mermaid as
// the two things code and diagrams should be annotated for.
//
// jiffdown escaped the fence body, so it is unescaped for the highlighter and
// re-escaped by it. Only the five entities jiffdown's `escape` produces are
// reversed, which is exactly the inverse of that function.
const UNESCAPES: Record<string, string> = {
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": '"',
	"&#39;": "'",
};

function unescapeHtml(text: string): string {
	return text.replace(
		/&(?:amp|lt|gt|quot|#39);/g,
		(entity) => UNESCAPES[entity] ?? entity,
	);
}

const CODE_FENCE =
	/<pre><code class="language-([^"]+)">([\s\S]*?)<\/code><\/pre>/g;

export function highlightFences(html: string): string {
	return html.replace(CODE_FENCE, (whole, lang: string, body: string) => {
		// An unregistered language is left exactly as it was: a wrong guess is
		// worse than no colour, and `mermaid` must never be highlighted.
		if (!hljs.getLanguage(lang)) return whole;
		const { value } = hljs.highlight(unescapeHtml(body), {
			language: lang,
			ignoreIllegals: true,
		});
		return `<pre><code class="hljs language-${lang}">${value}</code></pre>`;
	});
}

// A ```mermaid fence must reach the page as `<pre class="mermaid">`: mermaid's
// browser runtime finds diagrams by that class, and a default
// `<pre><code class="language-mermaid">` block is never rendered.
//
// jiffdown now carries this rewrite as a marked renderer extension, but this
// repository consumes it from the registry, so the behaviour only arrives with
// the next jiffdown release. This rewrite bridges that gap and is idempotent:
// once the release is installed jiffdown emits the container directly, the
// pattern below matches nothing, and this becomes a pass-through.
const MERMAID_FENCE =
	/<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g;

export function rewriteMermaidFences(html: string): string {
	return html.replace(MERMAID_FENCE, '<pre class="mermaid">$1</pre>');
}

// A trace diagram is read against the listing it traces, so a code fence
// immediately followed by a mermaid fence becomes one figure the stylesheet can
// lay out side by side. The listing stays a real code block — highlightable, and
// selectable as text — rather than being redrawn inside the diagram.
// Matches a listing whether or not highlighting has already annotated it.
const CODE_THEN_DIAGRAM =
	/(<pre><code class="(?:hljs )?language-(?!highlight-gutters)[^"]*">(?:(?!<\/code><\/pre>)[\s\S])*?<\/code><\/pre>)\s*(<pre class="mermaid">\s*traceDiagram(?:(?!<\/pre>)[\s\S])*?<\/pre>)/g;
const GUTTER_THEN_DIAGRAM =
	/(<div class="highlight-gutters"(?:(?!<\/code><\/pre><\/div>)[\s\S])*?<\/code><\/pre><\/div>)\s*(<pre class="mermaid">\s*traceDiagram(?:(?!<\/pre>)[\s\S])*?<\/pre>)/g;

// The step sequence reaches the client on the figure, written here at build
// time rather than by the client renderer. `drawTrace` draws into a detached
// fragment whose root attributes `src/components/mermaid/diagram.ts` does not
// copy onto mermaid's host element, so an attribute written there would be
// dropped; the figure element is authored here, the parse is pure, and the
// attribute ships in the HTML.
//
// This calls the same `resolveStepsFromSource` the renderer resolves with, so a
// build-time ordinal and a client ordinal cannot drift.
const MERMAID_BODY = /^<pre class="mermaid">([\s\S]*)<\/pre>$/;

function traceLines(diagram: string): string {
	const body = MERMAID_BODY.exec(diagram)?.[1];
	if (body === undefined) return "";
	try {
		const sequence = resolveStepsFromSource(unescapeHtml(body));
		// An untimed diagram gets no attribute at all, so its figure is
		// byte-identical to the one this function emitted before timing existed.
		if (sequence.length === 0) return "";
		return ` data-trace-lines="${sequence.join(" ")}"`;
	} catch {
		// A diagram that fails to parse yields today's unstepped figure rather
		// than breaking the build, which is the existing degradation rule.
		return "";
	}
}

export function pairListingsWithDiagrams(html: string): string {
	return html
		.replace(
			GUTTER_THEN_DIAGRAM,
			(_whole, listing: string, diagram: string) =>
				`<figure class="trace-figure lifetime-composite"${traceLines(diagram)}>${listing}${diagram}</figure>`,
		)
		.replace(
			CODE_THEN_DIAGRAM,
			(_whole, listing: string, diagram: string) =>
				`<figure class="trace-figure"${traceLines(diagram)}>${listing}${diagram}</figure>`,
		);
}

/** Renders post Markdown to HTML. The one Markdown entry point for the site. */
export function toHTML(markdown: string): string {
	// Order is load-bearing: the mermaid rewrite must remove `language-mermaid`
	// before highlighting sees it, and highlighting must annotate the listing
	// before the pairing wraps it.
	return pairListingsWithDiagrams(
		highlightFences(
			rewriteHighlightGutterFences(
				rewriteMermaidFences(jiffdown(markdown) as string),
			),
		),
	);
}
