import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
import { MD } from "../../src/components/p.ts";
import { cvMarkdown } from "../../src/lib/cv.ts";
import { tomlLoader } from "../../src/lib/loader.ts";
import { pageHead } from "../../src/lib/page-head.ts";
import { getSortedPosts } from "../../src/lib/posts.ts";

export default {
	head: () => pageHead("David Souther CV"),
	// Same data as the resume (src/resume.toml), arranged for an academic reader
	// by cvMarkdown. `cv` scopes the print stylesheet in src/global.css to this
	// page; `no-print-href` suppresses its blanket `a::after` URL print rule.
	default: async () =>
		Object.assign(MD(cvMarkdown(await tomlLoader(), getSortedPosts())), {
			className: "cv no-print-href",
		}),
} satisfies PageModule;
