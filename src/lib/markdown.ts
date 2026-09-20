import { toHTML as jiffdown } from "@davidsouther/jiffdown";
import hljs from "highlight.js";
import { rewriteHighlightGutterFences } from "./highlight-gutters.ts";
import { resolveStepsFromSource } from "./trace-diagram/steps.ts";

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

// The step sequence ships on the figure, written here rather than by the
// renderer: mermaid does not copy a drawn SVG's root attributes onto its host.
// Resolved with the same function the renderer uses, so the two cannot drift.
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

// A gutter fence already emits per-line elements; a plain fence emits one run
// of text, so a plain listing paired with a *timed* diagram is split here.
// Converting those posts to gutter fences instead would have restacked a
// side-by-side figure for a gutter with no lanes to draw.
//
// Only a timed pair is split, so untimed figures keep the markup they have.
const LISTING_BODY = /^(<pre><code class="[^"]*">)([\s\S]*)(<\/code><\/pre>)$/;

/**
 * Splits highlighted markup at its newlines, re-opening across the break every
 * element still open. Each line must be well-formed on its own, because each
 * becomes a separate wrapper element.
 *
 * The stack closes by recorded tag name rather than by depth, so markup that is
 * not the `<span>` highlight.js emits today cannot silently produce mismatched
 * tags.
 */
export function splitHighlightedLines(body: string): string[] {
	const closers = (stack: readonly string[]): string =>
		stack
			.map((tag) => `</${tag.slice(1).split(/[\s/>]/)[0]}>`)
			.reverse()
			.join("");

	const lines: string[] = [];
	const open: string[] = [];
	let current = "";
	let last = 0;
	for (const match of body.matchAll(/<\/?[^>]+>|\n/g)) {
		const at = match.index;
		current += body.slice(last, at);
		last = at + match[0].length;
		if (match[0] === "\n") {
			lines.push(current + closers(open));
			current = open.join("");
		} else if (match[0].startsWith("</")) {
			open.pop();
			current += match[0];
		} else {
			open.push(match[0]);
			current += match[0];
		}
	}
	current += body.slice(last);
	lines.push(current + closers(open));
	// A fence body ends with the newline before its closing fence, which
	// terminates the last line rather than starting an empty one.
	if (lines.at(-1) === "") lines.pop();
	return lines;
}

/**
 * Wraps each line of a plain code listing in `.trace-listing-line[data-line]`,
 * the element `src/lib/trace-stepper/stepper.ts` spotlights. The newline itself
 * is dropped: each wrapper is a block, so the break it used to make is now the
 * block's own, and the listing keeps its height.
 */
function wrapListingLines(listing: string): string {
	const parts = LISTING_BODY.exec(listing);
	if (!parts) return listing;
	const [, opening, body, closing] = parts;
	const lines = splitHighlightedLines(body)
		.map(
			(line, at) =>
				`<span class="trace-listing-line" data-line="${at}">${line}</span>`,
		)
		.join("");
	return `${opening}${lines}${closing}`;
}

export function pairListingsWithDiagrams(html: string): string {
	return html
		.replace(
			GUTTER_THEN_DIAGRAM,
			(_whole, listing: string, diagram: string) =>
				`<figure class="trace-figure lifetime-composite"${traceLines(diagram)}>${listing}${diagram}</figure>`,
		)
		.replace(CODE_THEN_DIAGRAM, (_whole, listing: string, diagram: string) => {
			const lines = traceLines(diagram);
			const spotted = lines === "" ? listing : wrapListingLines(listing);
			return `<figure class="trace-figure"${lines}>${spotted}${diagram}</figure>`;
		});
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
