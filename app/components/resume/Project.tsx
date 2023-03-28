import type * as ResumeTypes from "~/resume";
import { P } from "../P";

export const ProjectDetail = ({
  project: { details },
}: {
  project: ResumeTypes.ProjectExperience;
}) =>
  details ? (
    <section className="project">
      <h4>
        {details.URL ? <a href={details.URL}>{details.name}</a> : details.name}
      </h4>
      {details.description && <P>{details.description}</P>}
    </section>
  ) : (
    <></>
  );
