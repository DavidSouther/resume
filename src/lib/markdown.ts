import { toHTML as jiffdown } from "@davidsouther/jiffdown";
import hljs from "highlight.js";

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
	/(<pre><code class="(?:hljs )?language-[^"]*">[\s\S]*?<\/code><\/pre>)\s*(<pre class="mermaid">[\s\S]*?<\/pre>)/g;

export function pairListingsWithDiagrams(html: string): string {
	return html.replace(
		CODE_THEN_DIAGRAM,
		'<figure class="trace-figure">$1$2</figure>',
	);
}

/** Renders post Markdown to HTML. The one Markdown entry point for the site. */
export function toHTML(markdown: string): string {
	// Order is load-bearing: the mermaid rewrite must remove `language-mermaid`
	// before highlighting sees it, and highlighting must annotate the listing
	// before the pairing wraps it.
	return pairListingsWithDiagrams(
		highlightFences(rewriteMermaidFences(jiffdown(markdown) as string)),
	);
}
