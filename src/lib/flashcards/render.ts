import { toHTML } from "@davidsouther/jiffdown";

/**
 * Renders markdown field text to HTML, via this repo's own jiffdown-based
 * renderer (the same one `src/components/p.ts`'s `MD()` uses for prose
 * content elsewhere on the site).
 *
 * NOT currently used for this deck's fields (see browse.ts), and deliberately
 * not wired into the review-mode client bundle at all (see client.ts) —
 * three independent problems, the first two both about Rust syntax
 * colliding with jiffdown's own custom extensions (github.com/jefri/jiffdown,
 * the source of `toHTML`):
 *
 *  - Bare `{tag: content}` parses as jiffdown's inline block directive and
 *    renders as the tag `<tag>content</tag>`. `S { x: y }` — an ordinary
 *    Rust struct-literal fragment — becomes `S <x>y</x>`, silently eating
 *    the braces. Confirmed by hand: `toHTML("S { x: y }")` does exactly
 *    this. Wrapping it in a real markdown code span (backticks, not a raw
 *    `<code>` tag) *does* protect against this one — code spans are
 *    tokenized before jiffdown's inline extensions run.
 *  - But backticks don't fix the next one: a bare `>` followed by `{`
 *    anywhere in the text — not scoped to line-start, not scoped outside
 *    code spans — triggers jiffdown's own `>{block infostring} content`
 *    block directive and mangles everything after it into a bogus
 *    blockquote. No code span or Rust syntax needed to reproduce it:
 *    `toHTML("plain text > {} more")` alone produces
 *    `<blockquote><p>{} more</p></blockquote>`. Rust code is full of
 *    exactly this shape ahead of a block — `-> T { ... }`, `impl<T> S<T> {
 *    ... }` — so for this deck it's the common case, not an edge case.
 *    Between these two, making Rust-code-bearing fields safe for this
 *    renderer would mean escaping every `>` as `&gt;` regardless of
 *    backtick-wrapping — at which point it's the raw-HTML approach already
 *    in place, not markdown.
 *  - Separately: jiffdown pulls in a JSON asset internally
 *    (`known_entities.json`), and the client bundle's Rollup config
 *    (`@davidsouther/jiffies` ssg/bundle.js) has no JSON-import plugin —
 *    bundling this for the browser breaks the build outright. Render
 *    markdown at deck-authoring/publish time (server-side, e.g. from a
 *    one-off script, or manually before committing a deck's data file)
 *    instead of at display time, so published deck data ends up with plain
 *    HTML fields either way — same as this deck's fields already are.
 *
 * Safe to use for markdown prose that needs neither literal `{`/`}` nor a
 * `>` ahead of a `{`; unsafe for anything with real Rust code in running
 * text.
 */
export function renderCardField(text: string): string {
	return toHTML(text) ?? text;
}
