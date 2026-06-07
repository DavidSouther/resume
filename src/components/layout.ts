import {
	a,
	cite,
	div,
	footer,
	header,
	main,
	nav,
	p,
} from "@davidsouther/jiffies/dom/html.ts";
import type { ResumeData } from "../lib/resume";
import { AboutMe } from "./resume/about-me.ts";

// The home page shell: a #root container with the AboutMe header, a <main> for
// page content, and a copyright/source footer. Only the home page uses this;
// blog and trips pages render their content bare (the SSG owns <html>/<body>).
export function Layout(resume: ResumeData, ...children: Node[]): HTMLElement {
	const year = new Date(resume.settings.lastUpdate).getFullYear();
	return div(
		{ id: "root", class: "root" },
		header(...AboutMe(resume.aboutMe)),
		main(...children),
		footer(
			{ class: "no-print" },
			nav(
				p(`© David Souther 2008-${year}`),
				cite(
					a({ href: "https://github.com/davidsouther/resume" }, "Page Source"),
				),
			),
		),
	);
}
