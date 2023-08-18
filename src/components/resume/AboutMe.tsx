import Image from "next/image";
import Link from "next/link";
import type * as ResumeTypes from "~/resume";

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
    {aboutMe.relevantLinks && <Links links={aboutMe.relevantLinks} />}
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
    />
  </figure>
);

const Location = ({ location }: { location: ResumeTypes.Location }) => (
  <div className="location">
    {Object.entries(location).map(([k, v]) => (
      <span key={k} className={`location ${k}`}>
        {v}
      </span>
    ))}
  </div>
);

const Links = ({ links }: { links: ResumeTypes.Link[] }) => (
  <nav>
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
