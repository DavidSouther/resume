"use client";
import Image from "next/image";
import Link from "next/link";
import * as ResumeTypes from "~/lib/resume";

export const Contact = ({
  links = [],
  contact = {},
}: {
  links?: ResumeTypes.Link[];
  contact?: ResumeTypes.Contact;
}) => {
  const contactLinks: ResumeTypes.Link[] = [
    ...(contact.publicProfiles ?? []),
    ...(contact.contactMails?.map(
      (p) =>
        ({
          type: "email",
          URL: `mailto:${p}`,
        } satisfies ResumeTypes.Link),
    ) ?? []),
    ...(contact.phoneNumbers?.map(
      (p) =>
        ({
          type: "tel",
          URL: `tel:+${p.countryCode} ${p.number}`,
        } satisfies ResumeTypes.Link),
    ) ?? []),
  ];
  const allLinks = [...links, ...contactLinks].map((p) => ({
    type: p.URL,
    URL: p.URL,
  }));
  return allLinks && <Links className="contact" links={allLinks} />;
};

export const AboutMe = ({ aboutMe }: { aboutMe: ResumeTypes.AboutMe }) => (
  <>
    <hgroup>
      <h1>
        <Link href="/">
          {aboutMe.profile.name} {aboutMe.profile.surnames ?? ""}
        </Link>
      </h1>
      <h2>{aboutMe.profile.title}</h2>
    </hgroup>
    {aboutMe.profile.avatar && (
      <Avatar avatar={aboutMe.profile.avatar} name={aboutMe.profile.name} />
    )}
    {aboutMe.profile.location && (
      <Location location={aboutMe.profile.location} />
    )}
    <Contact links={aboutMe.relevantLinks} contact={aboutMe.profile.contact} />
  </>
);

const Avatar = ({
  avatar,
  name,
}: {
  avatar: ResumeTypes.Image;
  name: string;
}) => (
  <figure>
    <Image
      height="136"
      width="136"
      alt={`${name} Professional Photo`}
      src={
        (avatar as ResumeTypes.ImageLink).link
          ? (avatar as ResumeTypes.ImageLink).link
          : `data:${(avatar as ResumeTypes.ImageData).mediaType};base64,${
              (avatar as ResumeTypes.ImageData).data
            }`
      }
      style={{
        maxWidth: "100%",
        height: "auto",
      }}
    />
  </figure>
);

const Location = ({ location }: { location: ResumeTypes.Location }) => (
  <p className="location">
    {Object.entries(location).map(([k, v]) => (
      <span key={k} className={`location ${k}`}>
        {v}
      </span>
    ))}
  </p>
);

const Links = ({
  links,
  className = "",
}: {
  links: ResumeTypes.Link[];
  className?: string;
}) => (
  <nav className={className}>
    <ul>
      {links.map((link) => (
        <li key={link.URL}>
          <a href={link.URL} className="no-print">
            <span>{link.type}</span>
          </a>
          <span className="print-only">{link.URL}</span>
        </li>
      ))}
    </ul>
  </nav>
);
