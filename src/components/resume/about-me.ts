import type { DenormChildren } from "@davidsouther/jiffies/dom/dom.ts";
import {
	a,
	figure,
	h1,
	h2,
	hgroup,
	img,
	li,
	nav,
	p,
	span,
	ul,
} from "@davidsouther/jiffies/dom/html.ts";
import type * as ResumeTypes from "../../lib/resume";

// The resume header block: name/title hgroup, avatar, location, and contacts.
// Returns a Node[] so the caller can spread it directly into a <header>.
export function AboutMe(aboutMe: ResumeTypes.AboutMe): DenormChildren[] {
	return [
		hgroup(
			h1(
				a(
					{ href: "/" },
					`${aboutMe.profile.name} ${aboutMe.profile.surnames ?? ""}`,
				),
			),
			h2(aboutMe.profile.title ?? ""),
		),
		aboutMe.profile.avatar
			? Avatar(aboutMe.profile.avatar, aboutMe.profile.name)
			: null,
		aboutMe.profile.location ? Location(aboutMe.profile.location) : null,
		Contact(aboutMe.relevantLinks, aboutMe.profile.contact),
	];
}

// Combines explicit links with contact emails/phones into a single Links nav.
export function Contact(
	links: ResumeTypes.Link[] = [],
	contact: ResumeTypes.ContactMeans = {},
): HTMLElement {
	const contactLinks: ResumeTypes.Link[] = [
		...(contact.publicProfiles ?? []),
		...(contact.contactMails?.map((email) => ({
			type: "email",
			URL: `mailto:${email}`,
		})) ?? []),
		...(contact.phoneNumbers?.map((phoneEntry) => ({
			type: "tel",
			URL: `tel:+${phoneEntry.countryCode} ${phoneEntry.number}`,
		})) ?? []),
	];
	return Links([...links, ...contactLinks], "contact");
}

function Avatar(avatar: ResumeTypes.Image, name: string): HTMLElement {
	const src = (avatar as ResumeTypes.ImageLink).link
		? (avatar as ResumeTypes.ImageLink).link
		: `data:${(avatar as ResumeTypes.ImageData).mediaType};base64,${(avatar as ResumeTypes.ImageData).data}`;
	return figure(
		img({
			height: "136",
			width: "136",
			alt: `${name} Professional Photo`,
			src,
			style: { maxWidth: "100%", height: "auto" },
		}),
	);
}

function Location(location: ResumeTypes.Location): HTMLElement {
	return p(
		{ class: "location" },
		...Object.entries(location).map(([locationKey, locationValue]) =>
			span({ class: `location ${locationKey}` }, String(locationValue)),
		),
	);
}

// On-screen the semantic type ("github", "email", "tel") is the label; the
// print-only span carries the full URL.
function Links(links: ResumeTypes.Link[], className = ""): HTMLElement {
	return nav(
		{ class: className },
		ul(
			...links.map((link) =>
				li(
					a({ href: link.URL, class: "no-print" }, span(link.type)),
					span({ class: "print-only" }, link.URL),
				),
			),
		),
	);
}
