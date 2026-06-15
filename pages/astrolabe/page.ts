// The /astrolabe/ route (ships DARK — not in scripts/sitemap.ts, no nav link).
//
// The SSG renders every pages/*.ts it finds, so this module builds the dark
// route into docs/ unlisted. head() spreads the shared pageHead and appends the
// two Google Fonts the watch wants — Cormorant Garamond for the display lettering
// and DM Mono for the readouts; default() renders the F1 shell.
import { link } from "@davidsouther/jiffies/dom/html.ts";
import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
import { Astrolabe } from "../../src/components/astrolabe/astrolabe.ts";
import { pageHead } from "../../src/lib/page-head.ts";

// Cormorant Garamond — the luxury-watch display serif (dial numerals, headings).
const FONT_CORMORANT =
	"https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,400;0,500;0,600;1,400&display=swap";

// DM Mono — the instrument readout face (controls, coordinate readouts).
const FONT_DM_MONO =
	"https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&display=swap";

export default {
	head: (): Node | Node[] => [
		...pageHead("Astrolabe — David Souther"),
		link({ rel: "stylesheet", href: FONT_CORMORANT }),
		link({ rel: "stylesheet", href: FONT_DM_MONO }),
	],
	default: (): Node | Node[] => Astrolabe(),
	// Two client scripts. controls-client.ts re-renders the controls sheet from the
	// URL hash so the F1/F2 #debug panels (material, guilloché, color) toggle live and
	// re-registers F2's live wiring onto the rendered SVG dial. motion-client.ts is
	// F3's entry: it re-registers F3's sections (render-mode + the motion/zodiac #debug
	// panels), instantiates the MotionEngine on the rendered dial, wires the Realtime/
	// Fast button and the mousemove parallax, and starts the rAF loop (paused under
	// prefers-reduced-motion). Both are root-relative specifiers the SSG bundles with
	// Rollup and injects as deferred module scripts.
	clientModules: [
		"/src/components/astrolabe/controls-client.ts",
		"/src/components/astrolabe/motion-client.ts",
	],
} satisfies PageModule;
