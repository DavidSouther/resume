const ENTITY_DECODE: Record<string, string> = {
	"&lt;": "<",
	"&gt;": ">",
	"&amp;": "&",
	"&quot;": '"',
	"&#39;": "'",
};

/** Strips tags and decodes a handful of common entities — good enough for a client-side search index, not a general HTML sanitizer. */
export function stripHtml(html: string): string {
	return html
		.replace(/<[^>]+>/g, " ")
		.replace(/&lt;|&gt;|&amp;|&quot;|&#39;/g, (m) => ENTITY_DECODE[m] ?? m)
		.replace(/\s+/g, " ")
		.trim();
}
