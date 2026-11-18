import type { Post } from "./posts.ts";
import type {
	CvSection,
	JobExperience,
	ProjectExperience,
	ResumeData,
	Role,
} from "./resume";

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

function section(heading: string, blocks: string[]): string[] {
	return blocks.length ? [`## ${heading}`, ...blocks] : [];
}

/** Role names may link to a salary page on the resume; the CV keeps the text only. */
function plainTitle(name: string): string {
	return name.replace(/\[([^\]]+)\]\([^)]*\)/g, "$1");
}

function role(org: string, r: Role): string {
	const dates = span(r.startDate, r.finishDate);
	const body = (r.challenges ?? []).map((c) => c.description.trim());
	return [`**${plainTitle(r.name)}** — ${org} · ${dates}  `, ...body].join(
		"\n",
	);
}

/** Newest role start in a job; jobs sort by it, descending. */
function latestStart(job: JobExperience): string {
	return job.roles
		.map((r) => r.startDate)
		.reduce((a, b) => (a > b ? a : b), "");
}

/** Jobs printed under one CV section, newest first. */
export function jobsIn(
	resume: ResumeData,
	cvSection: CvSection,
): JobExperience[] {
	return resume.experience.jobs
		.filter((j) => (j.cvSection ?? "professional") === cvSection)
		.sort((a, b) => latestStart(b).localeCompare(latestStart(a)));
}

function jobBlocks(jobs: JobExperience[]): string[] {
	return jobs.flatMap((j) => j.roles.map((r) => role(j.organization.name, r)));
}

function project({ details, roles }: ProjectExperience): string {
	const name = details?.name ?? "";
	const title = details?.URL ? `[${name}](${details.URL})` : name;
	const start = roles.map((r) => r.startDate).sort()[0];
	const since = start ? ` · since ${monthYear(start)}` : "";
	return [`**${title}**${since}  `, (details?.description ?? "").trim()].join(
		"\n",
	);
}

/**
 * Arranges the resume's data for an academic reader: interests and teaching
 * ahead of industry roles. Every job, study and project comes from the shared
 * resume sections, each in exactly one place (a job's `cvSection` picks teaching
 * or professional); only the interests, competencies, note and footer come from
 * the CV-only `cv` table. Sections with no entries are omitted, and `cv.note`
 * becomes a paragraph the print stylesheet hides. Render the result with
 * `MD()`: the print stylesheet targets its markup.
 */
export function cvMarkdown(resume: ResumeData): string {
	const { profile } = resume.aboutMe;
	const cv = resume.cv;
	const { location, contact } = profile;
	const where = [location?.municipality, location?.region]
		.filter(Boolean)
		.join(", ");
	const github = contact?.publicProfiles?.find((p) => p.type === "github");
	const links = [
		cv?.website && `[${cv.website.replace(/^https?:\/\//, "")}](${cv.website})`,
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
		cv?.note ? `<p class="no-print"><em>${cv.note}</em></p>` : "",
	].filter(Boolean);

	const education = (resume.knowledge.studies ?? []).map((s) => {
		const when = s.degreeAchieved
			? (s.finishDate ?? s.startDate).slice(0, 4)
			: `${monthYear(s.startDate)} – present`;
		return `**${s.name}** — ${s.institution?.name ?? ""} · ${when}  \n${(s.description ?? "").trim()}`;
	});

	const sections = [
		...section(
			"Research and Teaching Interests",
			(cv?.interests ?? []).map((i) => `**${i.title}.** ${i.body.trim()}`),
		),
		...section("Education", education),
		...section("Teaching Appointments", jobBlocks(jobsIn(resume, "teaching"))),
		...section(
			"Professional Appointments",
			jobBlocks(jobsIn(resume, "professional")),
		),
		...section(
			"Software and Open Source",
			(resume.experience.projects ?? []).map(project),
		),
		...section(
			"Technical Competencies",
			(cv?.competencies ?? []).map((c) => `**${c.label}** — ${c.items}`),
		),
		cv?.footer ? `*${cv.footer}*` : "",
	].filter(Boolean);

	// Horizontal rules separate sections on screen only; print hides them.
	const out: string[] = [...header];
	for (const block of sections) {
		if (block.startsWith("## ")) out.push("---");
		out.push(block);
	}
	return out.join("\n\n");
}

/** The slice of a post the CV needs; injected so tests need no filesystem. */
export type PostRef = Pick<Post, "id" | "title" | "date" | "summary" | "show">;

/** The Publications and Public Scholarship groups, each a heading and its blocks. */
export function publicationGroups(
	_resume: ResumeData,
	_posts: PostRef[],
): { heading: string; blocks: string[] }[] {
	throw new Error("not implemented");
}
