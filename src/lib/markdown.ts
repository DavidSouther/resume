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

/**
 * Renders post Markdown to HTML. The one Markdown entry point for the site.
 *
 * Order is load-bearing: a gutter fence must stop being a fence before the
 * highlighter meets `highlight-gutters` as a language.
 */
export function toHTML(markdown: string): string {
	return highlightFences(
		rewriteHighlightGutterFences(jiffdown(markdown) as string),
	);
}
