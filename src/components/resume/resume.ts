import { Card } from "@davidsouther/jiffies/components/card.ts";
import type { DenormChildren } from "@davidsouther/jiffies/dom/dom.ts";
import {
	div,
	em,
	h3,
	p,
	section,
	small,
} from "@davidsouther/jiffies/dom/html.ts";
import type { PublicEntityDetails, ResumeData } from "../../lib/resume";
import { A, MD } from "../p.ts";
import { JobDetail } from "./job-detail.ts";
import { Education } from "./studies.ts";

// The full resume body: roles, education, and an artifacts column of projects
// and (URL-bearing, non-hidden) publications. Returns a Node[] of cards.
export function Resume(resume: ResumeData): DenormChildren[] {
	const {
		knowledge,
		experience: { jobs, projects, publicArtifacts },
	} = resume;
	const publications = publicArtifacts.filter(
		({ details: { URL } }) => URL !== undefined,
	);

	return [
		jobs
			? Card(
					{ class: "jobs", header: h3("Roles & Positions") },
					...jobs.map(JobDetail),
				)
			: null,
		knowledge.studies
			? Card(
					{ class: "studies", header: h3("Education") },
					...knowledge.studies.map(Education),
				)
			: null,
		projects || publicArtifacts
			? div(
					{ class: "artifacts" },
					projects
						? Card(
								{ class: "projects", header: h3("Projects") },
								...projects.map(({ details }) =>
									details ? Pub(details) : null,
								),
							)
						: null,
					publicArtifacts
						? Card(
								{ class: "publications", header: h3("Publications") },
								...publications
									.sort((a, b) => {
										const da = new Date(a.publishingDate ?? "1970-01-01");
										const db = new Date(b.publishingDate ?? "1970-01-01");
										return da < db ? 1 : da > db ? -1 : 0;
									})
									.filter(({ hide }) => hide !== true)
									.map((publication) =>
										Pub(publication.details, publication.publishingDate),
									),
							)
						: null,
				)
			: null,
	];
}

// A single project/publication entry: linked name, optional date, optional
// markdown description.
export function Pub(details: PublicEntityDetails, date?: string): HTMLElement {
	const { name, URL, description } = details;
	return section(
		{ class: "pub" },
		p(A(URL, name), date ? small(" ", em(date)) : null),
		description ? MD(description) : null,
	);
}
