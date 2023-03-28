import { ResumeData } from "~/resume";
import { Card } from "../Card";
import { JobDetail } from "./JobDetail";
import { ProjectDetail } from "./Project";
import { Publication } from "./Publication";
import { Education } from "./Studies";

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
      {projects && (
        <Card className="projects" header="Projects">
          {projects.map((project) => (
            <ProjectDetail key={project.details?.name} project={project} />
          ))}
        </Card>
      )}
      {publicArtifacts && (
        <Card className="publications" header="Publications">
          {publications.map((publication) => (
            <Publication
              key={publication.details.name}
              publication={publication}
            />
          ))}
        </Card>
      )}
    </>
  );
};
