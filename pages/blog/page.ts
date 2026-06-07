import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
import { renderBlogList } from "../../src/components/blog-list.ts";
import { pageHead } from "../../src/lib/page-head.ts";
import { getSortedPosts } from "../../src/lib/posts.ts";

export default {
	head: () => pageHead("Blog — David Souther"),
	default: async () => renderBlogList(getSortedPosts()),
} satisfies PageModule;
