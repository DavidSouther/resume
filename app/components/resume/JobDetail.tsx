import type * as ResumeTypes from "~/resume";
import { P } from "../P";
import { Organization } from "./Organization";

export const JobDetail = ({ job }: { job: ResumeTypes.JobExperience }) => (
  <section className="job">
    <Organization org={job.organization} />
    {job.roles.map((role) => (
      <Role key={role.name} role={role} />
    ))}
  </section>
);

const Role = ({ role }: { role: ResumeTypes.Role }) => (
  <section className="role">
    <h4 className="about">
      <em className="name">{role.name}</em>
      <small className="start date">{role.startDate}</small>
      <small className="finish date">{role.finishDate ?? "Current"}</small>
    </h4>
    <div className="details">
      {role.challenges.map(({ description }) => (
        <P key={description}>{description}</P>
      ))}
    </div>
    <div className="competences">
      <small>
        {(role.competences ?? []).map(({ name }) => name).join(", ")}
      </small>
    </div>
  </section>
);
