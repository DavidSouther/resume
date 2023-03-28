import type * as ResumeTypes from "~/resume";

export const ProjectDetail = ({
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
