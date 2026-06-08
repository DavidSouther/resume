import { div, img } from "@davidsouther/jiffies/dom/html.ts";
import type { WikiSummary } from "../../lib/wiki-cache.ts";

// Renders the hero / city-banner background image. The original painted a CSS
// background-image and faded it in with client JS; the static port emits a real
// <img> so the CDN URL lands in `src` and `loading`/`width`/`height` apply.
//
// With a thumbnail: `div.hero-img > img(...)`, the <img> covering the box via the
// `.hero-img` CSS rule (object-fit: cover). With no thumbnail or no summary:
// the empty `div.hero-img` fallback — a cache miss degrades to current behavior.
export function WikiPhoto(attrs: {
	summary: WikiSummary | undefined;
	// Informative for the hero (the place); "" for decorative banners.
	alt?: string;
	class?: string;
}): HTMLElement {
	const { summary, alt = "", class: extra } = attrs;
	const cls = extra ? `hero-img ${extra}` : "hero-img";
	const thumb = summary?.thumbnail;
	if (!thumb) {
		return div({ class: cls });
	}
	return div(
		{ class: cls },
		img({
			src: thumb.source,
			width: thumb.width,
			height: thumb.height,
			loading: "lazy",
			alt,
		}),
	);
}
