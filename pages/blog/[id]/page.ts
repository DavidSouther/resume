import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
import { renderBlogPost } from "../../../src/components/blog-post.ts";
import { pageHead } from "../../../src/lib/page-head.ts";
import { getPost, getPostPaths } from "../../../src/lib/posts.ts";

export default {
	generateStaticParams: async () => getPostPaths().map((id) => ({ id })),
	head: async (params) => {
		const post = await getPost(params?.id ?? "");
		return pageHead(`${post.title} — David Souther`);
	},
	default: async (params) => renderBlogPost(await getPost(params?.id ?? "")),
} satisfies PageModule;
