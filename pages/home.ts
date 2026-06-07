import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
import { renderHome } from "../src/components/home.ts";
import { tomlLoader } from "../src/lib/loader.ts";
import { pageHead } from "../src/lib/page-head.ts";
import { getSortedPosts } from "../src/lib/posts.ts";

export default {
	head: () => pageHead("David Souther — Resume"),
	default: async () => {
		const resume = await tomlLoader();
		const posts = getSortedPosts();
		return renderHome(resume, posts);
	},
} satisfies PageModule;
