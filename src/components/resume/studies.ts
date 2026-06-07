import { div, em, p, small } from "@davidsouther/jiffies/dom/html.ts";
import type * as ResumeTypes from "../../lib/resume";
import { Organization } from "./organization.ts";

// Renders a single course of study; print-hidden unless a degree was achieved.
export function Education(study: ResumeTypes.Study): HTMLElement {
	const hide = study.degreeAchieved ? "" : "no-print";
	return div(
		{ class: `education ${hide}` },
		study.institution ? Organization(study.institution) : null,
		em({ class: "name" }, study.name),
		div(
			{ class: "about" },
			small({ class: "start" }, study.startDate),
			study.finishDate ? small({ class: "finish" }, study.finishDate) : null,
		),
		p({ class: "details justify" }, study.description ?? ""),
	);
}
