import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
import { Layout } from "../../src/components/layout.ts";
import { MD } from "../../src/components/p.ts";
import { AboutMe } from "../../src/components/resume/about-me.ts";
import { cvMarkdown } from "../../src/lib/cv.ts";
import { tomlLoader } from "../../src/lib/loader.ts";
import { pageHead } from "../../src/lib/page-head.ts";
import { CV_PDF } from "../../src/lib/pdfs.ts";
import { getSortedPosts } from "../../src/lib/posts.ts";

export default {
	head: () => pageHead("David Souther CV"),
	// The same header as the resume, then the same data arranged for an academic
	// reader by cvMarkdown. `cv` scopes the print stylesheet in src/global.css
	// to this page; `no-print-href` suppresses its blanket `a::after` URL print
	// rule.
	default: async () => {
		const resume = await tomlLoader();
		return Layout(
			{
				lastUpdate: resume.settings.lastUpdate,
				header: AboutMe(resume.aboutMe, { pdf: `/${CV_PDF}` }),
				class: "cv no-print-href",
			},
			MD(cvMarkdown(resume, getSortedPosts())),
		);
	},
} satisfies PageModule;
