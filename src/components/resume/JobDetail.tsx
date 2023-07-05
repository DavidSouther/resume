import type * as ResumeTypes from "~/resume";
import { A, P } from "../P";
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
    {role.challenges && (
      <div className="details">
        {role.challenges.map(({ description }) => (
          <P key={description}>{description}</P>
        ))}
      </div>
    )}
    <div className="competences">
      <Competences competences={role.competences} />
    </div>
  </section>
);

export const COMPETENCES_MAP = new Map([
  ["AngularJS", "https://angularjs.org"],
  ["Dart", "http://dart.dev"],
  ["GraphQL", "https://graphql.org/"],
  ["Istio", "https://istio.io"],
  ["Kompose", "https://kompose.io/"],
  ["Kubernetes", "https://kubernetes.io"],
  ["amazon-web-services", "https://aws.amazon.com"],
  ["angular", "https://angular.io/"],
  ["golang", "https://go.dev"],
  ["google-cloud-platform", "https://cloud.google.com/"],
  ["google-compute-engine", "https://cloud.google.com/compute"],
  ["node.js", "https://nodejs.org"],
  ["python", "https://www.python.org"],
  ["react", "https://react.dev/"],
  ["redis", "redis.io"],
  ["rust", "https://rust-lang.org"],
  ["socket.io", "https://socket.io"],
  ["typescript", "https://www.typescriptlang.org/"],
]);

const Competences = ({
  competences = [],
}: {
  competences?: ResumeTypes.Competence[];
}) => (
  <ul>
    {competences.map(({ name }) => (
      <li key={name}>
        <A href={COMPETENCES_MAP.get(name.toLowerCase())}>{name}</A>
      </li>
    ))}
  </ul>
);
