import { link, meta, script, title } from "@davidsouther/jiffies/dom/html.ts";

// GA4 measurement ID for davidsouther.com. Embedded inline in every page head.
const GA_MEASUREMENT_ID = "G-6X1Z1L95D8";

// Picks one of the four named themes by the current millisecond, before first
// paint, so there is no flash of the fallback theme. textContent (not src)
// because it must run synchronously inline. Guarded: a page that pre-declares a
// theme on <html> (the SSG htmlAttributes hook, e.g. the trips itinerary's
// data-theme="itinerary") keeps it — the random rotation only fills in when no
// theme is already set, so a pinned identity is never clobbered at first paint.
const THEME_PICKER = `(()=>{const r=document.documentElement;if(r.dataset.theme)return;const t=["rust","teal","indigo","nominal"];r.dataset.theme=t[Date.now()%t.length];})()`;

// Standard GA4 gtag bootstrap, paired with the async loader script below.
const GA_INIT = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}');`;

/**
 * Shared <head> content for every page: title, the jiffies-css v2 bundle and
 * built global.css stylesheets, the millisecond-modulo theme picker, and the
 * GA4 analytics snippet. Returned as a Node[] for the SSG `head` hook.
 */
export function pageHead(pageTitle: string): Node[] {
	// `charset` is not a typed HTMLMetaElement property, so set it directly.
	const charset = meta();
	charset.setAttribute("charset", "utf-8");
	return [
		charset,
		meta({
			name: "viewport",
			content: "width=device-width, initial-scale=1",
		}),
		title(pageTitle),
		link({ rel: "stylesheet", href: "/jiffies-css-v2-bundle.min.css" }),
		link({ rel: "stylesheet", href: "/global.css" }),
		script(THEME_PICKER),
		script({
			async: true,
			src: `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`,
		}),
		script(GA_INIT),
	];
}
