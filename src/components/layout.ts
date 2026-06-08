import type { DenormChildren } from "@davidsouther/jiffies/dom/dom.ts";
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

export function Layout(
	{
		lastUpdate,
		header: headerChildren,
		class: clazz,
	}: { lastUpdate: string; header: DenormChildren[]; class?: string },
	...children: DenormChildren[]
): HTMLElement {
	const year = new Date(lastUpdate).getFullYear();
	return div(
		{ id: "root", class: clazz ? `root ${clazz}` : "root" },
		header(...headerChildren),
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
