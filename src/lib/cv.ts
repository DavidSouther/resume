import type { Post } from "./posts.ts";
import type {
	CvSection,
	JobExperience,
	ProjectExperience,
	PublicArtifact,
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
function jobsIn(resume: ResumeData, cvSection: CvSection): JobExperience[] {
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
export function cvMarkdown(resume: ResumeData, posts: PostRef[] = []): string {
	const cv = resume.cv;
	const note = cv?.note ? `<p class="no-print"><em>${cv.note}</em></p>` : "";

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
		...section("Curriculum Development", curriculumBlocks(resume)),
		...section(
			"Professional Appointments",
			jobBlocks(jobsIn(resume, "professional")),
		),
		...section("Mentorship and Advising", excerpts(resume, "mentorship")),
		...section(
			"Publications and Public Scholarship",
			publicationGroups(resume, posts).map(
				(g) => `### ${g.heading}\n\n${g.blocks.join("\n")}`,
			),
		),
		...section(
			"Software and Open Source",
			(resume.experience.projects ?? [])
				.filter((p) => p.details?.cvSection !== "curriculum")
				.map(project),
		),
		...section("Invited Talks and Presentations", talkBlocks(resume, posts)),
		...section(
			"Technical Competencies",
			(cv?.competencies ?? []).map((c) => `**${c.label}** — ${c.items}`),
		),
		cv?.footer ? `*${cv.footer}*` : "",
	].filter(Boolean);

	// Horizontal rules separate sections on screen only; print hides them.
	const out: string[] = note ? [note] : [];
	for (const block of sections) {
		if (block.startsWith("## ") && out.length) out.push("---");
		out.push(block);
	}
	return out.join("\n\n");
}

const MARK = /<span data-cv="(\w+)" data-title="([^"]*)">([\s\S]*?)<\/span>/g;

/** The CV-only tag of artifacts printed under Curriculum Development. */
const CURRICULUM_TAG = "Curriculum";

/**
 * Sentences marked in shared text with
 * `<span data-cv="SECTION" data-title="Title">...</span>`. The span is inline
 * and invisible, so the resume and the CV's own role blocks print the text
 * unchanged; the topical CV sections quote the same words, with the title and
 * the source's name and dates, so no fact is written twice.
 */
function excerpts(resume: ResumeData, section: string): string[] {
	const found = (text: string | undefined, source: string) =>
		[...(text ?? "").matchAll(MARK)]
			.filter((m) => m[1] === section)
			.map(
				(m) =>
					`**${m[2].trim()}** — ${source}  \n${m[3].replace(/\s+/g, " ").trim()}`,
			);
	const jobs = [...resume.experience.jobs]
		.sort((a, b) => latestStart(b).localeCompare(latestStart(a)))
		.flatMap((job) =>
			job.roles.flatMap((r) =>
				(r.challenges ?? []).flatMap((c) =>
					found(
						c.description,
						`${job.organization.name} · ${span(r.startDate, r.finishDate)}`,
					),
				),
			),
		);
	const studies = (resume.knowledge.studies ?? []).flatMap((s) =>
		found(
			s.description,
			`${s.institution?.name ?? s.name} · ${s.startDate.slice(0, 4)} – ${(s.finishDate ?? "").slice(0, 4) || "present"}`,
		),
	);
	return [...jobs, ...studies];
}

/** Excerpts, then flagged projects, then Curriculum-tagged artifacts. */
function curriculumBlocks(resume: ResumeData): string[] {
	return [
		...excerpts(resume, "curriculum"),
		...(resume.experience.projects ?? [])
			.filter((p) => p.details?.cvSection === "curriculum")
			.map(project),
		...resume.experience.publicArtifacts
			.filter((a) => !a.hide && a.tags?.includes(CURRICULUM_TAG))
			.map(artifactText),
	];
}

function talkBlocks(resume: ResumeData, posts: PostRef[]): string[] {
	const byId = new Map(posts.map((p) => [p.id, p]));
	const lectures = (resume.cv?.talks ?? []).map((id) => {
		const post = byId.get(id);
		if (!post) throw new Error(`cv.talks: unknown post id ${id}`);
		return post;
	});
	return [
		...excerpts(resume, "talks"),
		...lectures.filter((p) => p.show).map(postBlock),
	];
}

/** The slice of a post the CV needs; injected so tests need no filesystem. */
export type PostRef = Pick<Post, "id" | "title" | "date" | "summary" | "show">;

function year(date?: string): string {
	return date ? date.slice(0, 4) : "";
}

/** An artifact's title, year and its whole shared description, on one line. */
function artifactText({ details, publishingDate }: PublicArtifact): string {
	const title = details.URL
		? `[${details.name}](${details.URL})`
		: details.name;
	const when = publishingDate ? ` (${year(publishingDate)})` : "";
	const description = (details.description ?? "").replace(/\s+/g, " ").trim();
	return [`${title}${when}.`, description]
		.filter((x) => x.length > 1)
		.join(" ");
}

function artifactBlock(artifact: PublicArtifact): string {
	return `- ${artifactText(artifact)}`;
}

function postBlock(post: PostRef): string {
	const when = post.date ? ` ${year(post.date)}.` : "";
	const summary = post.summary ? ` ${post.summary.trim()}` : "";
	return `- Souther, D. "[${post.title ?? post.id}](/blog/${post.id})."${when}${summary}`;
}

/**
 * The Publications and Public Scholarship groups, each a heading and its list
 * items, in `cv.publications` order. A `tag` group takes the visible artifacts
 * carrying the tag; a `posts` group is rendered from the posts' own front
 * matter, so no essay text lives in the TOML (a post also listed in `cv.talks`
 * is left to that section). Visible artifacts that no group
 * claims print last under "Other Publications", except Curriculum artifacts,
 * which print under Curriculum Development.
 */
function publicationGroups(
	resume: ResumeData,
	posts: PostRef[],
): { heading: string; blocks: string[] }[] {
	const artifacts = resume.experience.publicArtifacts.filter((a) => !a.hide);
	const byId = new Map(posts.map((p) => [p.id, p]));
	// A lecture prints under Invited Talks, so an essay group skips it.
	const talks = new Set(resume.cv?.talks ?? []);
	const claimed = new Set<PublicArtifact>();

	const groups = (resume.cv?.publications ?? []).map((group) => {
		if (group.tag !== undefined) {
			const tagged = artifacts.filter((a) => a.tags?.includes(group.tag));
			for (const a of tagged) claimed.add(a);
			return { heading: group.heading, blocks: tagged.map(artifactBlock) };
		}
		const found = group.posts.map((id) => {
			const post = byId.get(id);
			if (!post) throw new Error(`cv.publications: unknown post id ${id}`);
			return post;
		});
		return {
			heading: group.heading,
			blocks: found.filter((p) => p.show && !talks.has(p.id)).map(postBlock),
		};
	});

	const other = artifacts.filter(
		(a) => !claimed.has(a) && !a.tags?.includes(CURRICULUM_TAG),
	);
	if (other.length)
		groups.push({
			heading: "Other Publications",
			blocks: other.map(artifactBlock),
		});
	return groups.filter((g) => g.blocks.length);
}
