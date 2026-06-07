import { div, em, p, section, small } from "@davidsouther/jiffies/dom/html.ts";
import type { PublicEntityDetails, ResumeData } from "../../lib/resume";
import { card } from "../card.ts";
import { kids } from "../children.ts";
import { A, MD } from "../p.ts";
import { JobDetail } from "./job-detail.ts";
import { Education } from "./studies.ts";

// The full resume body: roles, education, and an artifacts column of projects
// and (URL-bearing, non-hidden) publications. Returns a Node[] of cards.
export function Resume(resume: ResumeData): Node[] {
	const {
		knowledge,
		experience: { jobs, projects, publicArtifacts },
	} = resume;
	const publications = publicArtifacts.filter(
		({ details: { URL } }) => URL !== undefined,
	);

	return kids(
		jobs ? card("jobs", "Roles & Positions", ...jobs.map(JobDetail)) : null,
		knowledge.studies
			? card("studies", "Education", ...knowledge.studies.map(Education))
			: null,
		projects || publicArtifacts
			? div(
					{ class: "artifacts" },
					...kids(
						projects
							? card(
									"projects",
									"Projects",
									...kids(
										...projects.map(({ details }) =>
											details ? Pub(details) : null,
										),
									),
								)
							: null,
						publicArtifacts
							? card(
									"publications",
									"Publications",
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
					),
				)
			: null,
	);
}

// A single project/publication entry: linked name, optional date, optional
// markdown description.
export function Pub(details: PublicEntityDetails, date?: string): HTMLElement {
	const { name, URL, description } = details;
	return section(
		{ class: "pub" },
		p(A(URL, name), ...kids(date ? small(" ", em(date)) : null)),
		...kids(description ? MD(description) : null),
	);
}
