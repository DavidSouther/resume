import type { CvEntry, ResumeData, Role } from "./resume";

const MONTHS = [
	"January",
	"February",
	"March",
	"April",
	"May",
	"June",
	"July",
	"August",
	"September",
	"October",
	"November",
	"December",
];

/** "2026-05-18" becomes "May 2026"; a bare year stays a year. */
export function monthYear(date: string): string {
	const [year, month] = date.split("-");
	const name = MONTHS[Number(month) - 1];
	return name ? `${name} ${year}` : year;
}

function span(start: string, finish?: string): string {
	return `${monthYear(start)} – ${finish ? monthYear(finish) : "present"}`;
}

function phone({ number }: { number: string }): string {
	const d = number.replace(/\D/g, "");
	return d.length === 10
		? `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`
		: number;
}

function entry({ title, meta, body }: CvEntry): string {
	return `${title}${meta ? ` — ${meta}  ` : ""}\n${body.trim()}`;
}

function section(heading: string, blocks: string[]): string[] {
	return blocks.length ? [`## ${heading}`, ...blocks] : [];
}

function role(org: string, r: Role): string {
	const dates = span(r.startDate, r.finishDate);
	const body = (r.challenges ?? []).map((c) => c.description.trim());
	return [`**${r.name}** — ${org} · ${dates}  `, ...body].join("\n");
}

/**
 * Arranges the resume's data for an academic reader: scholarship and teaching
 * ahead of industry roles. Roles, education, and contact come from the shared
 * resume sections; the rest from `academic`. The Markdown renders through the
 * same jiffdown path the print stylesheet was tuned against.
 */
export function cvMarkdown(resume: ResumeData): string {
	const { profile } = resume.aboutMe;
	const ac = resume.academic;
	const { location, contact } = profile;
	const where = [location?.municipality, location?.region]
		.filter(Boolean)
		.join(", ");
	const github = contact?.publicProfiles?.find((p) => p.type === "github");
	const links = [
		ac?.website && `[${ac.website.replace(/^https?:\/\//, "")}](${ac.website})`,
		github && `[${github.URL.replace(/^https?:\/\//, "")}](${github.URL})`,
	].filter(Boolean);

	const header = [
		`# ${profile.name} ${profile.surnames ?? ""}`.trim(),
		[
			where,
			[
				contact?.contactMails?.[0],
				contact?.phoneNumbers?.[0] && phone(contact.phoneNumbers[0]),
			]
				.filter(Boolean)
				.join(" · "),
			links.join(" · "),
		]
			.filter(Boolean)
			.join("  \n"),
		ac?.note ? `<p class="no-print"><em>${ac.note}</em></p>` : "",
	].filter(Boolean);

	const education = (resume.knowledge.studies ?? []).map((s) => {
		const when = s.degreeAchieved
			? (s.finishDate ?? s.startDate).slice(0, 4)
			: `${monthYear(s.startDate)} – present`;
		return `**${s.name}** — ${s.institution?.name ?? ""} · ${when}  \n${(s.description ?? "").trim()}`;
	});

	const jobs = resume.experience.jobs.flatMap((j) =>
		j.roles.map((r) => role(j.organization.name, r)),
	);

	const sections = [
		...section(
			"Research and Teaching Interests",
			(ac?.interests ?? []).map((i) => `**${i.title}.** ${i.body.trim()}`),
		),
		...section("Education", education),
		...section(
			"Academic and Teaching Appointments",
			(ac?.teaching ?? []).map(entry),
		),
		...section("Curriculum Development", (ac?.curriculum ?? []).map(entry)),
		...section("Professional Appointments", jobs),
		...section("Mentorship and Advising", (ac?.mentorship ?? []).map(entry)),
		...section(
			"Publications and Public Scholarship",
			(ac?.publications ?? []).map(
				(p) => `### ${p.heading}\n\n${p.body.trim()}`,
			),
		),
		...section("Software and Open Source", (ac?.software ?? []).map(entry)),
		...section(
			"Invited Talks and Presentations",
			(ac?.talks ?? []).map((t) => t.body.trim()),
		),
		...section("Service", (ac?.service ?? []).map(entry)),
		...section(
			"Technical Competencies",
			(ac?.competencies ?? []).map((c) => `**${c.label}** — ${c.items}`),
		),
		ac?.footer ? `*${ac.footer}*` : "",
	].filter(Boolean);

	// Rules between sections, as the hand-written CV had; print hides them.
	const out: string[] = [...header];
	for (const block of sections) {
		if (block.startsWith("## ")) out.push("---");
		out.push(block);
	}
	return out.join("\n\n");
}
