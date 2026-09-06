import { readFileSync } from "node:fs";
import { link, meta, script, title } from "@davidsouther/jiffies/dom/html.ts";

// GA4 measurement ID for davidsouther.com. Embedded inline in every page head.
const GA_MEASUREMENT_ID = "G-6X1Z1L95D8";

// Picks one of the four named themes by the current millisecond, before first
// paint, so there is no flash of the fallback theme. textContent (not src)
// because it must run synchronously inline. Guarded: a page that pre-declares a
// theme on <html> (via the SSG htmlAttributes hook) keeps it — the random
// rotation only fills in when no theme is already set, so a pinned identity is
// never clobbered at first paint.
const THEME_PICKER = `(()=>{const r=document.documentElement;if(r.dataset.theme)return;const t=["rust","teal","indigo","nominal"];r.dataset.theme=t[Date.now()%t.length];})()`;

// Standard GA4 gtag bootstrap, paired with the async loader script below.
const GA_INIT = `window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${GA_MEASUREMENT_ID}');`;

// The jiffies-css bundle, linked from unpkg pinned at the published version.
// Both the version and the filename come from the installed devDependency's
// own package.json (name/version/unpkg), not a literal here, so bumping
// `@davidsouther/jiffies-css` (package.json + npm install) is the only step
// needed to move the pin — including across a filename change like the
// jiffies-css-v2-bundle.* -> jiffies-css-bundle.* rename. Pinning the full
// resolved path (not a bare `@davidsouther/jiffies-css` unpkg URL) avoids a
// redirect per load and locks the exact bundle this build was tested against.
const JIFFIES_CSS_PACKAGE = JSON.parse(
	readFileSync(
		new URL(import.meta.resolve("@davidsouther/jiffies-css/package.json")),
		"utf-8",
	),
) as { name: string; version: string; unpkg: string };
const JIFFIES_CSS_BUNDLE = `https://unpkg.com/${JIFFIES_CSS_PACKAGE.name}@${JIFFIES_CSS_PACKAGE.version}/${JIFFIES_CSS_PACKAGE.unpkg}`;

/**
 * Shared <head> content for every page: title, the unpkg jiffies-css bundle
 * and built global.css stylesheets, the millisecond-modulo theme picker, and the
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
		link({ rel: "stylesheet", href: JIFFIES_CSS_BUNDLE }),
		link({ rel: "stylesheet", href: "/global.css" }),
		script(THEME_PICKER),
		script({
			async: true,
			src: `https://www.googletagmanager.com/gtag/js?id=${GA_MEASUREMENT_ID}`,
		}),
		script(GA_INIT),
	];
}
