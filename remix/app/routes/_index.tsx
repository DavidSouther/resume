import type * as ResumeTypes from "~/resume";

import type { V2_MetaFunction } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";

import resume from "./resume.json";

export const meta: V2_MetaFunction = () => [
  { title: "David Souther - Resume" },
];

export async function loader() {
  return resume;
}

export default function Index() {
  const resume = useLoaderData<ResumeTypes.ResumeData>();

  return (
    <>
      <header>
        {resume ? <AboutMe aboutMe={resume.aboutMe} /> : <h1>Resume</h1>}
      </header>
      {resume ? (
        <main>
          <JobDetails jobs={resume.experience.jobs} />
          <Studies knowledge={resume.knowledge.studies ?? []} />
          <Projects projects={resume.experience.projects} />
          <Publications artifacts={resume.experience.publicArtifacts} />
        </main>
      ) : (
        <main aria-busy={true} />
      )}
      <footer>
        © David Souther 2022
        <cite>
          <a href="https://github.com/davidsouther/resume">Page Source</a>
          <span className="print-only"> github.com/davidsouther/resume</span>
        </cite>
      </footer>
    </>
  );
}

export const AboutMe = ({ aboutMe }: { aboutMe: ResumeTypes.AboutMe }) => (
  <>
    <hgroup>
      <h1>
        {aboutMe.profile.name} {aboutMe.profile.surnames ?? ""}
      </h1>
      <h2>{aboutMe.profile.title}</h2>
    </hgroup>
    {aboutMe.profile.avatar && <Avatar avatar={aboutMe.profile.avatar} />}
    {aboutMe.profile.location && (
      <Location location={aboutMe.profile.location} />
    )}
    {aboutMe.relevantLinks && <Links links={aboutMe.relevantLinks} />}
  </>
);

const Avatar = ({ avatar }: { avatar: ResumeTypes.Image }) => (
  <figure>
    <img
      height="136"
      width="136"
      alt="David Souther Professional Headshot"
      src={
        (avatar as ResumeTypes.ImageLink).link
          ? (avatar as ResumeTypes.ImageLink).link
          : `data:${(avatar as ResumeTypes.ImageData).mediaType};base64,${
              (avatar as ResumeTypes.ImageData).data
            }`
      }
    />
  </figure>
);

const Location = ({ location }: { location: ResumeTypes.Location }) => (
  <div className="location">
    {Object.entries(location).map(([k, v]) => (
      <span key={k} className={`location ${k}`}>
        {v}
      </span>
    ))}
  </div>
);

const Links = ({ links }: { links: ResumeTypes.Link[] }) => (
  <nav>
    <ul>
      {links.map((link) => (
        <li key={link.URL}>
          <a href={link.URL}>
            <span className="no-print">{link.type}</span>
          </a>
        </li>
      ))}
    </ul>
  </nav>
);

const JobDetails = ({ jobs }: { jobs: ResumeTypes.JobExperience[] }) => (
  <article>
    <header>
      <h3>Work Experience</h3>
      {jobs.map((job) => (
        <JobDetail key={JSON.stringify(job)} job={job} />
      ))}
    </header>
  </article>
);

const JobDetail = ({ job }: { job: ResumeTypes.JobExperience }) => (
  <div className="job">
    <Organization org={job.organization} />
    {job.roles.map((role) => (
      <Role key={role.name} role={role} />
    ))}
  </div>
);

const Organization = ({ org }: { org: ResumeTypes.PublicEntityDetails }) => (
  <h4 className="organization">
    {org.URL ? <a href={org.URL}>{org.name}</a> : org.name}
  </h4>
);

const Role = ({ role }: { role: ResumeTypes.Role }) => (
  <div className="role">
    <div className="about">
      <em className="name">{role.name}</em>
      <small className="start date">{role.startDate}</small>
      <small className="finish date">{role.finishDate ?? "Current"}</small>
    </div>
    <div className="details">
      {role.challenges.map(({ description }) => (
        <p key={description} className="justify">
          {description}
        </p>
      ))}
    </div>
    <div className="competences">
      <small>
        {(role.competences ?? []).map(({ name }) => name).join(", ")}
      </small>
    </div>
  </div>
);

const Studies = ({ knowledge }: { knowledge: ResumeTypes.Study[] }) => (
  <article>
    <header>
      <h3>Education</h3>
    </header>
    {knowledge.map((study) => (
      <Education key={study.name} study={study} />
    ))}
  </article>
);

const Education = ({ study }: { study: ResumeTypes.Study }) => (
  <div className="education">
    {study.institution && <Organization org={study.institution} />}
    <div className="about">
      <em className="name">{study.name}</em>
      <small className="start">{study.startDate}</small>
      {study.finishDate && <small className="finish">{study.finishDate}</small>}
    </div>
    <p className="details justify">{study.description ?? ""}</p>
  </div>
);

const Projects = ({
  projects,
}: {
  projects: ResumeTypes.ProjectExperience[];
}) => (
  <article>
    <header>
      <h3>Projects</h3>
    </header>
    {projects.map((project) => (
      <ProjectDetail key={project.details?.name} project={project} />
    ))}
  </article>
);

const Publications = ({
  artifacts,
}: {
  artifacts: ResumeTypes.PublicArtifact[];
}) => (
  <article className="publications">
    <header>
      <h3>publications</h3>
    </header>
    <section>
      {artifacts
        .filter(({ details: { URL } }) => URL != undefined)
        .map((publication) => (
          <Publication
            key={publication.details.name}
            publication={publication}
          />
        ))}
    </section>
  </article>
);

const ProjectDetail = ({
  project: { details },
}: {
  project: ResumeTypes.ProjectExperience;
}) =>
  details ? (
    <div className="project">
      <span>
        {details.URL ? <a href={details.URL}>{details.name}</a> : details.name}
      </span>
      {details.description && <p>{details.description}</p>}
    </div>
  ) : (
    <></>
  );

const Publication = ({
  publication: {
    details: { name, URL },
    publishingDate,
  },
}: {
  publication: ResumeTypes.PublicArtifact;
}) => (
  <p>
    <a href={URL}>{name}</a>
    <span className="print-only">{URL ?? ""}</span>
    <small>
      <em>{publishingDate}</em>
    </small>
  </p>
);
