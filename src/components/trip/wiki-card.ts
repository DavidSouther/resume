import {
	a,
	figcaption,
	figure,
	h3,
	img,
	p,
} from "@davidsouther/jiffies/dom/html.ts";
import type { WikiSummary } from "../../lib/wiki-cache.ts";

// Renders the per-event Wikipedia summary card (`.wiki`). Returns null when there
// is no summary, so the `summary && WikiCard({ summary })` guard in event.ts
// drops cleanly and the enclosing tag function omits it.
//
// Semantic tags (figure/figcaption/h3/p/a) honor the in-flight semantic refactor;
// `.wiki`/`.wiki-thumb` are this feature's sanctioned style hooks (not in the
// refactor's forbidden presentational-class list). A thumbnail-absent entry
// renders text-only — graceful.
export function WikiCard(attrs: {
	summary: WikiSummary | undefined;
}): HTMLElement | null {
	const { summary } = attrs;
	if (!summary) return null;
	const { title, extract, pageUrl, thumbnail } = summary;
	return figure(
		{ class: "wiki" },
		thumbnail
			? img({
					class: "wiki-thumb",
					src: thumbnail.source,
					width: thumbnail.width,
					height: thumbnail.height,
					loading: "lazy",
					alt: title,
				})
			: null,
		figcaption(
			h3(title),
			p(extract),
			a(
				{ href: pageUrl, rel: "noopener noreferrer", target: "_blank" },
				"Wikipedia →",
			),
		),
	);
}
