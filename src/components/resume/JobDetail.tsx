"use client";
import type * as ResumeTypes from "~/lib/resume";
import { A, MD } from "../P";
import { Organization } from "./Organization";
import { show } from "~/lib/util";

export const JobDetail = ({ job }: { job: ResumeTypes.JobExperience }) => {
  const hide = show(job.roles.at(-1)?.finishDate) ? "" : "no-print";
  return (
    <section className={`job ${hide}`}>
      <Organization org={job.organization} />
      {job.roles.map((role) => (
        <Role key={role.name} role={role} />
      ))}
    </section>
  );
};

const Role = ({ role }: { role: ResumeTypes.Role }) => (
  <section className="role">
    <h5>
      <em className="name">{role.name}</em>
    </h5>
    <h5 className="about">
      <small className="start date">{role.startDate}</small>
      <small className="finish date">{role.finishDate ?? "Current"}</small>
    </h5>
    {role.challenges && (
      <div className="details">
        {role.challenges.map(({ description }) => (
          <MD key={description}>{description}</MD>
        ))}
      </div>
    )}
    <div className="competences">
      <Competences competences={role.competences} />
    </div>
  </section>
);

export const COMPETENCES_LCL = new Map([
  ["amazon-web-services", "Amazon Web Services (AWS)"],
  ["angular", "Angular"],
  ["angularjs", "AngularJS"],
  ["aws", "Amazon Web Services (AWS)"],
  ["bedrock", "Amazon Bedrock"],
  ["curriculum development", "Curriculum Development"],
  ["front end", "Front End"],
  ["html & css", "HTML & CSS"],
  ["instructing", "Instructor"],
  ["interview training", "Technical Interview Training"],
  ["javascript", "JavaScript"],
  ["k8s", "Kubernetes"],
  ["kubernetes", "Kubernetes"],
  ["llm", "Large Language Models"],
  ["mit-scratch", "MIT Scratch"],
  ["node", "NodeJS"],
  ["nodejs", "NodeJS"],
  ["python", "Python"],
  ["react", "React"],
  ["rust", "Rust"],
  ["technical writing", "Technical Writing"],
  ["typescript", "TypeScript"],
]);

export const COMPETENCES_MAP = new Map([
  ["amazon-web-services", "https://aws.amazon.com"],
  ["angular", "https://angular.io/"],
  ["angularjs", "https://angularjs.org"],
  ["bedrock", "https://aws.amazon.com/bedrock/"],
  ["dart", "http://dart.dev"],
  ["golang", "https://go.dev"],
  ["google-cloud-platform", "https://cloud.google.com/"],
  ["google-compute-engine", "https://cloud.google.com/compute"],
  ["graphql", "https://graphql.org/"],
  ["istio", "https://istio.io"],
  ["kompose", "https://kompose.io/"],
  ["kubernetes", "https://kubernetes.io"],
  ["mit-scratch", "https://scratch.mit.edu"],
  ["node.js", "https://nodejs.org"],
  ["nodejs", "https://nodejs.org"],
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
        <A href={COMPETENCES_MAP.get(name.toLowerCase())}>
          {COMPETENCES_LCL.get(name.toLowerCase()) ?? `${name}`}
        </A>
      </li>
    ))}
  </ul>
);
