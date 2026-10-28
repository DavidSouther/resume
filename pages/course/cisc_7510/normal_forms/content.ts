// Loads the narration from content.md: a Markdown document whose `# ` heading
// is the page title, whose preamble is the intro, and whose `## Title {#id}`
// headings each start one step. Step order is file order.

import { readFileSync } from "node:fs";
import { join } from "node:path";
import inline from "@davidsouther/jiffdown/src/inline.mjs";
import { Marked } from "marked";

export interface Step {
	id: string;
	title: string;
	/** Markdown, possibly containing `{{placeholder}}` markers. */
	body: string;
}

export interface Content {
	title: string;
	intro: string;
	steps: Step[];
}

// jiffdown's inline syntax is `{info:content}`, so `## {#id:Title}` lexes to an
// `inline` token whose `info.id` is the step ID and whose `text` is the title.
const marked = new Marked();
marked.use(inline);

interface InlineToken {
	type: "inline";
	text: string;
	info: { id?: string };
}

const isInline = (t: unknown): t is InlineToken =>
	(t as { type?: string }).type === "inline";

/**
 * Walks the top-level tokens of the lexer jiffdown renders with, so code
 * fences and other blocks are never mistaken for headings, and reads each
 * step's ID and title from the heading's parsed inline token. Each other
 * token's `raw` source is kept as the body, which jiffdown renders later.
 */
export function parseContent(markdown: string): Content {
	let title = "";
	const intro: string[] = [];
	const steps: { id?: string; title: string; raw: string[] }[] = [];
	for (const token of marked.lexer(markdown)) {
		if (token.type === "heading" && token.depth === 1 && !steps.length) {
			title = token.text.trim();
		} else if (token.type === "heading" && token.depth === 2) {
			const named = ((token.tokens ?? []) as unknown[]).find(isInline);
			steps.push({
				id: named?.info.id,
				title: (named?.text ?? token.text).trim(),
				raw: [],
			});
		} else {
			(steps.length ? steps[steps.length - 1].raw : intro).push(token.raw);
		}
	}
	const seen = new Set<string>();
	return {
		title,
		intro: intro.join("").trim(),
		steps: steps.map((s) => {
			if (!s.id)
				throw new Error(
					`Step heading "${s.title}" needs an ID, e.g. "## {#my-id:${s.title}}".`,
				);
			if (seen.has(s.id)) throw new Error(`Duplicate step ID "${s.id}".`);
			seen.add(s.id);
			return { id: s.id, title: s.title, body: s.raw.join("").trim() };
		}),
	};
}

export function fillPlaceholders(
	text: string,
	values: Record<string, string>,
): string {
	return text.replace(/\{\{(\w+)\}\}/g, (_, name: string) => {
		if (!(name in values))
			throw new Error(`Unknown placeholder "{{${name}}}".`);
		return values[name];
	});
}

/** Content IDs must equal the dataset's keyframe IDs, in order. */
export function checkOrder(steps: Step[], expected: string[]): void {
	const ids = steps.map((s) => s.id);
	const missing = expected.filter((id) => !ids.includes(id));
	const extra = ids.filter((id) => !expected.includes(id));
	if (missing.length || extra.length)
		throw new Error(
			`content.md steps do not match the dataset. Missing: ${missing.join(", ") || "none"}. Extra: ${extra.join(", ") || "none"}.`,
		);
	if (ids.join() !== expected.join())
		throw new Error(
			`content.md steps are out of order. Expected: ${expected.join(", ")}.`,
		);
}

export function loadContent(): Content {
	return parseContent(
		readFileSync(join(import.meta.dirname, "content.md"), "utf-8"),
	);
}
