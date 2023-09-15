import type * as ResumeTypes from "~/lib/resume";

export const Organization = ({
  org,
}: {
  org: ResumeTypes.PublicEntityDetails;
}) => (
  <h4 className="organization">
    {org.URL ? <a href={org.URL}>{org.name}</a> : org.name}
  </h4>
);
