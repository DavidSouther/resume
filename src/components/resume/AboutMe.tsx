"use client";
import Image from "next/image";
import Link from "next/link";
import type * as ResumeTypes from "~/lib/resume";

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
			(email) =>
				({
					type: "email",
					URL: `mailto:${email}`,
				}) satisfies ResumeTypes.Link,
		) ?? []),
		...(contact.phoneNumbers?.map(
			(phoneEntry) =>
				({
					type: "tel",
					URL: `tel:+${phoneEntry.countryCode} ${phoneEntry.number}`,
				}) satisfies ResumeTypes.Link,
		) ?? []),
	];
	// Keep each link's semantic `type` ("github", "email", "tel") as the on-screen
	// label; the print-only span already shows the full URL. (A prior map clobbered
	// `type` with `URL`, so the hero rendered raw, overflowing hrefs as labels.)
	const allLinks = [...links, ...contactLinks];
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
		{Object.entries(location).map(([locationKey, locationValue]) => (
			<span key={locationKey} className={`location ${locationKey}`}>
				{locationValue}
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
