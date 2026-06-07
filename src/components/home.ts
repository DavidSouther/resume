import { a, div, h4, p } from "@davidsouther/jiffies/dom/html.ts";
import type { Post } from "../lib/posts.ts";
import type { ResumeData } from "../lib/resume";
import { card } from "./card.ts";
import { Layout } from "./layout.ts";
import { Resume } from "./resume/resume.ts";

// The landing page: a "Posts" card (title + summary grid) above the full
// resume, all inside the AboutMe Layout shell.
export function renderHome(resume: ResumeData, posts: Post[]): HTMLElement {
	const postsBody = posts.flatMap(({ id, title, summary }) => [
		div(
			{ style: { gridArea: "title" } },
			h4(a({ href: `/blog/${id}` }, title ?? id)),
		),
		p({ style: { gridArea: "summary" } }, summary ?? ""),
	]);
	const postsCard = card("posts no-print", "Posts", ...postsBody);
	return Layout(resume, postsCard, ...Resume(resume));
}
