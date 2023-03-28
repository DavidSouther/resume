import type * as ResumeTypes from "~/resume";

export const Publication = ({
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
