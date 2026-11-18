import { describe, expect, it } from "vitest";
import { cvMarkdown, jobsIn, monthYear, type PostRef } from "./cv.ts";
import type { CvPublicationGroup, ResumeData } from "./resume";

const resume = {
	settings: { language: "EN", lastUpdate: "2026-01-01" },
	aboutMe: {
		profile: {
			name: "Ada",
			surnames: "Lovelace",
			location: { municipality: "London", region: "England" },
			contact: {
				contactMails: ["ada@example.com"],
				phoneNumbers: [{ countryCode: 1, number: "650.495.5402" }],
				publicProfiles: [{ type: "github", URL: "https://github.com/ada" }],
			},
		},
	},
	experience: {
		jobs: [
			{
				organization: { name: "Analytical Engines" },
				roles: [
					{
						name: "Programmer",
						startDate: "2026-05-18",
						challenges: [{ description: "Wrote the first program." }],
					},
				],
			},
			{
				organization: { name: "Chatham" },
				cvSection: "teaching",
				roles: [
					{
						name: "Lecturer",
						startDate: "2016-01-01",
						challenges: [{ description: "Taught." }],
					},
				],
			},
			{
				organization: { name: "Code Fellows" },
				cvSection: "teaching",
				roles: [
					{
						name: "Instructor",
						startDate: "2018-01-01",
						challenges: [{ description: "Taught bootcamps." }],
					},
				],
			},
			{
				organization: { name: "Old Shop" },
				cvSection: "professional",
				roles: [{ name: "Intern", startDate: "2005-01-01" }],
			},
		],
		projects: [
			{
				type: "openSource",
				details: {
					name: "Ailly",
					description: "Prompt tooling.",
					URL: "https://github.com/DavidSouther/ailly",
				},
				roles: [{ name: "Developer", startDate: "2023-10-04" }],
			},
		],
		publicArtifacts: [],
	},
	knowledge: {
		studies: [
			{
				studyType: "officialDegree",
				degreeAchieved: true,
				name: "B.S. Mathematics",
				startDate: "2007-08-01",
				finishDate: "2011-05-31",
				institution: { name: "Rocky Mountain College" },
			},
		],
	},
	cv: {
		note: "Draft",
		footer: "References available on request.",
		interests: [{ title: "Teaching", body: "Domain experts." }],
		competencies: [{ label: "Languages", items: "Rust" }],
	},
} as unknown as ResumeData;

/** Everything under a `## heading` up to the next `## `. */
function sectionOf(md: string, heading: string): string {
	const start = md.indexOf(`## ${heading}`);
	const next = md.indexOf("\n## ", start + 1);
	return md.slice(start, next < 0 ? undefined : next);
}

describe("cvMarkdown", () => {
	const md = cvMarkdown(resume);
	const headings = md.match(/^## .+$/gm);

	it("formats dates as month and year", () => {
		expect(monthYear("2026-05-18")).toBe("May 2026");
		expect(monthYear("2011")).toBe("2011");
	});

	it("leaves the header to the page, which shares the resume's", () => {
		expect(md).not.toMatch(/^# /m);
		expect(md).not.toContain("ada@example.com");
	});

	it("orders scholarship and teaching ahead of professional roles", () => {
		expect(headings).toEqual([
			"## Research and Teaching Interests",
			"## Education",
			"## Teaching Appointments",
			"## Professional Appointments",
			"## Software and Open Source",
			"## Technical Competencies",
		]);
	});

	it("puts each job in exactly one section", () => {
		const teaching = sectionOf(md, "Teaching Appointments");
		const professional = sectionOf(md, "Professional Appointments");
		expect(teaching).toContain("Code Fellows");
		expect(teaching).toContain("Chatham");
		expect(teaching).not.toContain("Analytical Engines");
		expect(professional).toContain("Analytical Engines");
		expect(professional).toContain("Old Shop");
		expect(professional).not.toContain("Code Fellows");
		expect(md.split("Code Fellows").length - 1).toBe(1);
	});

	it("treats a job with no cvSection as professional", () => {
		expect(
			jobsIn(resume, "professional").map((j) => j.organization.name),
		).toContain("Analytical Engines");
		expect(
			jobsIn(resume, "teaching").map((j) => j.organization.name),
		).not.toContain("Analytical Engines");
	});

	it("lists each section newest first", () => {
		expect(jobsIn(resume, "teaching").map((j) => j.organization.name)).toEqual([
			"Code Fellows",
			"Chatham",
		]);
		expect(
			jobsIn(resume, "professional").map((j) => j.organization.name),
		).toEqual(["Analytical Engines", "Old Shop"]);
	});

	it("lists interests, projects and unfinished studies", () => {
		expect(md).toContain("**Teaching.** Domain experts.");
		expect(md).toContain("[Ailly](https://github.com/DavidSouther/ailly)");
		expect(md).toContain("Prompt tooling.");
		const unfinished = structuredClone(resume);
		unfinished.knowledge.studies?.push({
			studyType: "officialDegree",
			degreeAchieved: false,
			name: "Ph.D. Education",
			startDate: "2025-09-01",
			institution: { name: "Somewhere" },
		});
		expect(cvMarkdown(unfinished)).toContain(
			"**Ph.D. Education** — Somewhere · September 2025 – present",
		);
	});

	it("does not throw without a cv table", () => {
		const bare = structuredClone(resume);
		bare.cv = undefined;
		expect(() => cvMarkdown(bare)).not.toThrow();
	});

	it("takes roles and education from the resume sections", () => {
		expect(md).toContain(
			"**Programmer** — Analytical Engines · May 2026 – present",
		);
		expect(md).toContain("Wrote the first program.");
		expect(md).toContain(
			"**B.S. Mathematics** — Rocky Mountain College · 2011",
		);
	});

	it("drops salary-page links from role titles", () => {
		const linked = structuredClone(resume);
		linked.experience.jobs[0].roles[0].name =
			"[Programmer](https://www.levels.fyi/x)";
		expect(cvMarkdown(linked)).toContain("**Programmer** — Analytical Engines");
		expect(cvMarkdown(linked)).not.toContain("levels.fyi");
	});

	it("keeps the draft note out of print and omits empty sections", () => {
		expect(md).toContain('<p class="no-print"><em>Draft</em></p>');
		expect(md).not.toContain("Publications");
		expect(md).toContain("*References available on request.*");
	});
});

const postA: PostRef = {
	id: "a",
	show: true,
	title: "Alpha",
	date: "2024-03-01T00:00:00.000Z",
	summary: "First essay.",
};
const postB: PostRef = {
	id: "b",
	show: true,
	title: "Beta",
	date: "2025-07-01T00:00:00.000Z",
	summary: "Second essay.",
};

function artifact(name: string, extra: object = {}) {
	return {
		type: "post",
		publishingDate: "2023-06-23",
		details: { name, description: `About ${name}.\n\nMore detail.` },
		...extra,
	};
}

function withPublications(
	groups: CvPublicationGroup[],
	artifacts: object[] = [],
): ResumeData {
	const copy = structuredClone(resume);
	copy.cv = { ...copy.cv, publications: groups };
	copy.experience.publicArtifacts = artifacts as never;
	return copy;
}

describe("publication groups", () => {
	it("renders a posts group from front matter, in the listed order", () => {
		const md = cvMarkdown(
			withPublications([{ heading: "Essays", posts: ["b", "a"] }]),
			[postA, postB],
		);
		expect(md).toContain("### Essays");
		expect(md.indexOf("Beta")).toBeLessThan(md.indexOf("Alpha"));
		expect(md).toContain('Souther, D. "[Alpha](/blog/a)." 2024. First essay.');
	});

	it("takes a tag group from tagged, visible artifacts only", () => {
		const md = cvMarkdown(
			withPublications(
				[{ heading: "Writing", tag: "Writing" }],
				[
					artifact("Shown", { tags: ["Writing"] }),
					artifact("Hidden", { tags: ["Writing"], hide: true }),
					artifact("Other tag", { tags: ["Else"] }),
				],
			),
		);
		const group = sectionOf(md, "Publications and Public Scholarship");
		expect(group).toContain("Shown");
		expect(group).toContain("About Shown.");
		expect(group).toContain("More detail.");
		expect(group).not.toContain("Hidden");
		expect(group.indexOf("Other tag")).toBeGreaterThan(
			group.indexOf("### Other Publications"),
		);
	});

	it("links an artifact's title to its URL and shows its year", () => {
		const md = cvMarkdown(
			withPublications(
				[{ heading: "Writing", tag: "Writing" }],
				[
					artifact("Linked", {
						tags: ["Writing"],
						details: { name: "Linked", URL: "https://example.com/x" },
					}),
				],
			),
		);
		expect(md).toContain("[Linked](https://example.com/x) (2023)");
	});

	it("collects artifacts in no group under Other Publications", () => {
		const md = cvMarkdown(
			withPublications(
				[{ heading: "Writing", tag: "Writing" }],
				[artifact("Tagged", { tags: ["Writing"] }), artifact("Loose")],
			),
		);
		expect(md).toContain("### Other Publications");
		const other = md.slice(md.indexOf("### Other Publications"));
		expect(other).toContain("Loose");
		expect(other).not.toContain("Tagged");
	});

	it("fails the build on an unknown post id", () => {
		expect(() =>
			cvMarkdown(withPublications([{ heading: "Essays", posts: ["nope"] }]), [
				postA,
			]),
		).toThrow("cv.publications: unknown post id nope");
	});

	it("skips a hidden post without failing", () => {
		const md = cvMarkdown(
			withPublications([{ heading: "Essays", posts: ["a", "b"] }]),
			[postA, { ...postB, show: false }],
		);
		expect(md).toContain("Alpha");
		expect(md).not.toContain("Beta");
	});
});

/** A resume whose Programmer role carries marked excerpts. */
function withExcerpts(description: string): ResumeData {
	const r = structuredClone(resume);
	r.experience.jobs[0].roles[0].challenges = [{ description }];
	return r;
}

describe("excerpts from shared role text", () => {
	const marked = withExcerpts(
		`Led a team. <span data-cv="mentorship" data-title="Engineering management">I promoted two engineers.</span> Shipped it. <span data-cv="talks" data-title="Invited talk">I spoke at a meetup.</span>`,
	);
	const md = cvMarkdown(marked);

	it("pulls a marked sentence into the topical section under the source's name and dates", () => {
		const mentorship = sectionOf(md, "Mentorship and Advising");
		expect(mentorship).toContain(
			"**Engineering management** — Analytical Engines · May 2026 – present",
		);
		expect(mentorship).toContain("I promoted two engineers.");
		expect(mentorship).not.toContain("Shipped it.");
		expect(sectionOf(md, "Invited Talks and Presentations")).toContain(
			"I spoke at a meetup.",
		);
	});

	it("keeps the whole role text in its own section, and no marker markup in any excerpt", () => {
		expect(sectionOf(md, "Professional Appointments")).toContain("Shipped it.");
		expect(sectionOf(md, "Mentorship and Advising")).not.toContain("<span");
	});

	it("excerpts from a study description with the institution as source", () => {
		const r = structuredClone(resume);
		r.knowledge.studies = [
			{
				...(r.knowledge.studies?.[0] as NonNullable<
					typeof r.knowledge.studies
				>[0]),
				description: `<span data-cv="mentorship" data-title="Undergraduate tutoring">Tutored for three years.</span> Studied.`,
			},
		];
		expect(sectionOf(cvMarkdown(r), "Mentorship and Advising")).toContain(
			"**Undergraduate tutoring** — Rocky Mountain College · 2007 – 2011  \nTutored for three years.",
		);
	});

	it("omits a section nothing is marked for", () => {
		expect(cvMarkdown(resume)).not.toContain("## Mentorship and Advising");
	});

	it("lists talk posts by id after the excerpts", () => {
		const r = withExcerpts("Plain.");
		r.cv = { ...(r.cv as NonNullable<typeof r.cv>), talks: ["a"] };
		const talks = sectionOf(
			cvMarkdown(r, [postA]),
			"Invited Talks and Presentations",
		);
		expect(talks).toContain("[Alpha](/blog/a)");
	});
});

describe("curriculum development", () => {
	it("collects flagged projects and Curriculum-tagged artifacts, and keeps flagged projects out of Software", () => {
		const r = structuredClone(resume);
		r.experience.projects.push({
			type: "openSource",
			details: {
				name: "Craft Book",
				description: "An introductory book.",
				cvSection: "curriculum",
			},
			roles: [{ name: "Developer", startDate: "2013-07-01" }],
		});
		r.experience.publicArtifacts = [
			artifact("Whiteboarding", { tags: ["Curriculum"] }),
		] as unknown as ResumeData["experience"]["publicArtifacts"];
		const md = cvMarkdown(r);
		const curriculum = sectionOf(md, "Curriculum Development");
		expect(curriculum).toContain("Craft Book");
		expect(curriculum).toContain("Whiteboarding");
		const software = sectionOf(md, "Software and Open Source");
		expect(software).toContain("Ailly");
		expect(software).not.toContain("Craft Book");
		expect(md.indexOf("## Curriculum Development")).toBeLessThan(
			md.indexOf("## Professional Appointments"),
		);
	});
});

describe("publication entries", () => {
	it("keep every paragraph of the shared description, so a defensive publication keeps its full-text link", () => {
		const md = cvMarkdown(
			withPublications(
				[{ heading: "Defensive Publication", tag: "Dpub" }],
				[
					artifact("Graphs", {
						tags: ["Dpub"],
						details: {
							name: "Graphs",
							description:
								"Souther et al. (first author). Hulls.\n\nTechnical Disclosure Commons.\n[Full text (PDF)](https://example.com/x.pdf)",
						},
					}),
				],
			),
		);
		expect(md).toContain("(first author)");
		expect(md).toContain("[Full text (PDF)](https://example.com/x.pdf)");
	});
});
