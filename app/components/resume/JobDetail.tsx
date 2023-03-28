import type * as ResumeTypes from "~/resume";
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
  </section>
);
