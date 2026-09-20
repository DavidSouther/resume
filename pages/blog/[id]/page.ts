import { meta } from "@davidsouther/jiffies/dom/html.ts";
import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
import { renderBlogPost } from "../../../src/components/blog-post.ts";
import { MERMAID_ESM_URL } from "../../../src/lib/mermaid-bundle.ts";
import { pageHead } from "../../../src/lib/page-head.ts";
import { getPost, getPostPaths } from "../../../src/lib/posts.ts";

export default {
	generateStaticParams: async () => getPostPaths().map((id) => ({ id })),
	head: async (params) => {
		const post = await getPost(params?.id ?? "");
		return [
			...pageHead(`${post.title} — David Souther`),
			// The client module reads the pinned CDN URL from here rather than
			// importing it: the module that resolves the pin uses node:fs.
			meta({ name: "mermaid-src", content: MERMAID_ESM_URL }),
		];
	},
	default: async (params) => renderBlogPost(await getPost(params?.id ?? "")),
	clientModules: ["/src/components/mermaid/client.ts"],
} satisfies PageModule;
