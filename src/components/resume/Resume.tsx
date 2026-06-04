import type { PublicEntityDetails, ResumeData } from "~/lib/resume";
import { Card } from "../Card";
import { A, MD } from "../P";
import { JobDetail } from "./JobDetail";
import { Education } from "./Studies";

export const Resume = ({ resume }: { resume: ResumeData }) => {
	const {
		knowledge,
		experience: { jobs, projects, publicArtifacts },
	} = resume;
	const publications = publicArtifacts.filter(
		({ details: { URL } }) => URL !== undefined,
	);

	return (
		<>
			{jobs && (
				<Card className="jobs" header="Roles & Positions">
					{resume.experience.jobs.map((job) => (
						<JobDetail key={JSON.stringify(job)} job={job} />
					))}
				</Card>
			)}

			{knowledge.studies && (
				<Card className="studies" header="Education">
					{knowledge.studies.map((study) => (
						<Education key={study.name} study={study} />
					))}
				</Card>
			)}
			{(projects || publicArtifacts) && (
				<div className="artifacts">
					{projects && (
						<Card className="projects" header="Projects">
							{projects.map(({ details }) =>
								details ? <Pub key={details.name} details={details} /> : null,
							)}
						</Card>
					)}
					{publicArtifacts && (
						<Card className="publications" header="Publications">
							{publications
								.sort((a, b) => {
									const da = new Date(a.publishingDate ?? "1970-01-01");
									const db = new Date(b.publishingDate ?? "1970-01-01");
									return da < db ? 1 : da > db ? -1 : 0;
								})
								.filter(({ hide }) => hide !== true)
								.map((publication) => (
									<Pub
										key={publication.details.name}
										details={publication.details}
										date={publication.publishingDate}
									/>
								))}
						</Card>
					)}
				</div>
			)}
		</>
	);
};

export const Pub = ({
	details: { name, URL, description },
	date: publishingDate,
}: {
	details: PublicEntityDetails;
	date?: string;
}) => (
	<>
		<section className="pub">
			<p>
				<A href={URL}>{name}</A>
				{publishingDate && (
					<small>
						{" "}
						<em>{publishingDate}</em>
					</small>
				)}
			</p>
			{description && <MD>{description}</MD>}
		</section>
	</>
);
