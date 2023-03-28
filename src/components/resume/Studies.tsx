import type * as ResumeTypes from "~/resume";
import { Organization } from "./Organization";

export const Education = ({ study }: { study: ResumeTypes.Study }) => (
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