import { Card } from "@davidsouther/jiffies/components/card.ts";
import { a, div, h3, h4, p } from "@davidsouther/jiffies/dom/html.ts";
import type { Post } from "../lib/posts.ts";
import type { ResumeData } from "../lib/resume";
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

	return Layout(
		resume,
		Card({ class: "posts no-print", header: h3("Posts") }, ...postsBody),
		...Resume(resume),
	);
}
