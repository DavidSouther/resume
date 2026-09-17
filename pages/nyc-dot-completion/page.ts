import { style } from "@davidsouther/jiffies/dom/html.ts";
import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
import { NycDotCompletion } from "../../src/components/nyc-dot-completion.ts";
import { NYC_DOT_CSS } from "../../src/lib/nyc-dot-css.ts";
import { pageHead } from "../../src/lib/page-head.ts";

export default {
	head: () => [
		...pageHead("NYC DOT Project Completion: Adams vs. Mamdani"),
		style({}, NYC_DOT_CSS),
	],
	default: () => NycDotCompletion(),
} satisfies PageModule;
