import { toHTML as jiffdown } from "@davidsouther/jiffdown";
import hljs from "highlight.js";
import { rewriteHighlightGutterFences } from "./highlight-gutters.ts";

// Exactly the inverse of jiffdown's `escape`: the fence body arrives escaped,
// and the highlighter re-escapes what it emits.
const UNESCAPES: Record<string, string> = {
	"&amp;": "&",
	"&lt;": "<",
	"&gt;": ">",
	"&quot;": '"',
	"&#39;": "'",
};

export function unescapeHtml(text: string): string {
	return text.replace(
		/&(?:amp|lt|gt|quot|#39);/g,
		(entity) => UNESCAPES[entity] ?? entity,
	);
}

const CODE_FENCE =
	/<pre><code class="language-([^"]+)">([\s\S]*?)<\/code><\/pre>/g;

/**
 * Highlights at build time, so a listing is never briefly unstyled and works
 * with JavaScript off. An unregistered language is left alone: a wrong guess
 * is worse than no colour.
 */
export function highlightFences(html: string): string {
	return html.replace(CODE_FENCE, (whole, lang: string, body: string) => {
		if (!hljs.getLanguage(lang)) return whole;
		const { value } = hljs.highlight(unescapeHtml(body), {
			language: lang,
			ignoreIllegals: true,
		});
		return `<pre><code class="hljs language-${lang}">${value}</code></pre>`;
	});
}

// Mermaid's runtime finds diagrams by `pre.mermaid`; a `language-mermaid` code
// block is never rendered. Idempotent, so it becomes a pass-through once
// jiffdown ships this rewrite itself.
const MERMAID_FENCE =
	/<pre><code class="language-mermaid">([\s\S]*?)<\/code><\/pre>/g;

export function rewriteMermaidFences(html: string): string {
	return html.replace(MERMAID_FENCE, '<pre class="mermaid">$1</pre>');
}

// A trace diagram is read against the listing it traces, so the two become one
// figure. The listing stays a real code block — highlightable and selectable —
// rather than being redrawn inside the diagram. Matches a listing whether or
// not highlighting has annotated it yet.
const CODE_THEN_DIAGRAM =
	/(<pre><code class="(?:hljs )?language-(?!highlight-gutters)[^"]*">(?:(?!<\/code><\/pre>)[\s\S])*?<\/code><\/pre>)\s*(<pre class="mermaid">\s*traceDiagram(?:(?!<\/pre>)[\s\S])*?<\/pre>)/g;
const GUTTER_THEN_DIAGRAM =
	/(<div class="highlight-gutters"(?:(?!<\/code><\/pre><\/div>)[\s\S])*?<\/code><\/pre><\/div>)\s*(<pre class="mermaid">\s*traceDiagram(?:(?!<\/pre>)[\s\S])*?<\/pre>)/g;

export function pairListingsWithDiagrams(html: string): string {
	return html
		.replace(
			GUTTER_THEN_DIAGRAM,
			'<figure class="trace-figure lifetime-composite">$1$2</figure>',
		)
		.replace(CODE_THEN_DIAGRAM, '<figure class="trace-figure">$1$2</figure>');
}

/**
 * Renders post Markdown to HTML. The one Markdown entry point for the site.
 *
 * Order is load-bearing: a mermaid or gutter fence must stop being a fence
 * before the highlighter meets its language, and highlighting must finish
 * before the pairing wraps the listing.
 */
export function toHTML(markdown: string): string {
	return pairListingsWithDiagrams(
		highlightFences(
			rewriteHighlightGutterFences(
				rewriteMermaidFences(jiffdown(markdown) as string),
			),
		),
	);
}
