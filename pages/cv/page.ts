import { readFileSync } from "node:fs";
import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
import { MD } from "../../src/components/p.ts";
import { pageHead } from "../../src/lib/page-head.ts";

export default {
	head: () => pageHead("David Souther CV"),
	// `cv` scopes the print stylesheet in src/global.css to this page alone;
	// `no-print-href` opts into the repo's existing suppression of the blanket
	// `a::after { content: " (" attr(href) ")" }` print rule, which would
	// otherwise trail a raw URL after every link in the document.
	default: async () =>
		Object.assign(MD(readFileSync("content/cv-suny-downstate.md", "utf-8")), {
			className: "cv no-print-href",
		}),
} satisfies PageModule;
