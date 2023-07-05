import { ResumeData } from "~/resume";
import { Card } from "../Card";
import { JobDetail } from "./JobDetail";
import { Education } from "./Studies";
import { A, P } from "../P";

export const Resume = ({ resume }: { resume: ResumeData }) => {
  const {
    knowledge,
    experience: { jobs, projects, publicArtifacts },
  } = resume;
  const publications = publicArtifacts.filter(
    ({ details: { URL } }) => URL != undefined
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
              {projects
                .filter((p) => p.details)
                .map((project) => (
                  <Pub key={project.details?.name} details={project.details} />
                ))}
            </Card>
          )}
          {publicArtifacts && (
            <Card className="publications" header="Publications">
              {publications
                .sort((a, b) => {
                  let da = new Date(a.publishingDate ?? "1970-01-01");
                  let db = new Date(b.publishingDate ?? "1970-01-01");
                  return da < db ? 1 : da > db ? -1 : 0;
                })
                .filter(({ hide }) => hide != true)
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
  details: ResumeTypes.PublicArtifact.details;
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
      {description && <P>{description}</P>}
    </section>
  </>
);
