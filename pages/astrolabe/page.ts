import { script, style } from "@davidsouther/jiffies/dom/html.ts";
import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
import { buildStage } from "../../src/components/astrolabe/stage.ts";
import { ASTROLABE_CSS } from "../../src/lib/astrolabe/css.ts";
import { pageHead } from "../../src/lib/page-head.ts";

const ASTRONOMY_CDN =
	"https://cdn.jsdelivr.net/npm/astronomy-engine@2.1.19/astronomy.browser.js";

// The page is a thin SSG wrapper: the entire interactive subtree (dial + controls
// + overlays) is built by `buildStage()`, the same function the client runs to
// obtain live handles. SSG renders the stage root for first paint; the client
// rebuilds it and wires behavior onto the handles, never querying the document.
export default {
	head: () => [
		...pageHead("Astrolabe"),
		style({}, ASTROLABE_CSS),
		script({ src: ASTRONOMY_CDN, crossOrigin: "anonymous" }),
	],
	default: () => buildStage().root,
	clientModules: ["/src/components/astrolabe/client.ts"],
} satisfies PageModule;
