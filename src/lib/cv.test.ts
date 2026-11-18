import { describe, expect, it } from "vitest";
import { cvMarkdown, monthYear, type PostRef } from "./cv.ts";
import type { CvPublicationGroup, ResumeData } from "./resume";

const role = (name: string, startDate: string, description?: string) => ({
	name,
	startDate,
	challenges: description ? [{ description }] : undefined,
});

const resume = {
	settings: { language: "EN", lastUpdate: "2026-01-01" },
	aboutMe: { profile: { name: "Ada", surnames: "Lovelace" } },
	experience: {
		jobs: [
			{
				organization: { name: "Analytical Engines" },
				roles: [role("Programmer", "2026-05-18", "Wrote the first program.")],
			},
			{
				organization: { name: "Chatham" },
				cvSection: "teaching",
				roles: [role("Lecturer", "2016-01-01", "Taught.")],
			},
			{
				organization: { name: "Code Fellows" },
				cvSection: "teaching",
				roles: [role("Instructor", "2018-01-01", "Taught bootcamps.")],
			},
			{
				organization: { name: "Old Shop" },
				roles: [role("Intern", "2005-01-01")],
			},
		],
		projects: [
			{
				details: {
					name: "Ailly",
					description: "Prompt tooling.",
					URL: "https://github.com/DavidSouther/ailly",
				},
				roles: [role("Developer", "2023-10-04")],
			},
		],
		publicArtifacts: [],
	},
	knowledge: {
		studies: [
			{
				name: "B.S. Mathematics",
				degreeAchieved: true,
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

const postA: PostRef = {
	id: "a",
	show: true,
	title: "Alpha",
	date: "2024-03-01T00:00:00.000Z",
	summary: "First essay.",
};
const postB: PostRef = { ...postA, id: "b", title: "Beta" };

/** Everything under a `## heading` up to the next `## `. */
function sectionOf(md: string, heading: string): string {
	const start = md.indexOf(`## ${heading}`);
	const next = md.indexOf("\n## ", start + 1);
	return md.slice(start, next < 0 ? undefined : next);
}

/** A copy of the fixture with `change` applied. */
function variant(change: (r: ResumeData) => void): ResumeData {
	const copy = structuredClone(resume);
	change(copy);
	return copy;
}

const mark = (section: string, title: string, text: string) =>
	`<span data-cv="${section}" data-title="${title}">${text}</span>`;

describe("cvMarkdown", () => {
	const md = cvMarkdown(resume);

	it("formats dates as month and year", () => {
		expect(monthYear("2026-05-18")).toBe("May 2026");
		expect(monthYear("2011")).toBe("2011");
	});

	it("orders sections academic-first, with no header of its own and no empty section", () => {
		expect(md.match(/^## .+$/gm)).toEqual([
			"## Research and Teaching Interests",
			"## Education",
			"## Teaching Appointments",
			"## Professional Appointments",
			"## Software and Open Source",
			"## Technical Competencies",
		]);
		expect(md).not.toMatch(/^# /m);
		expect(() => cvMarkdown({ ...resume, cv: undefined })).not.toThrow();
	});

	it("puts each job in exactly one section, newest first; no cvSection means professional", () => {
		const teaching = sectionOf(md, "Teaching Appointments");
		const professional = sectionOf(md, "Professional Appointments");
		expect(teaching.indexOf("Code Fellows")).toBeLessThan(
			teaching.indexOf("Chatham"),
		);
		expect(professional.indexOf("Analytical Engines")).toBeLessThan(
			professional.indexOf("Old Shop"),
		);
		for (const org of ["Code Fellows", "Chatham"]) {
			expect(professional).not.toContain(org);
		}
		for (const org of ["Analytical Engines", "Old Shop"]) {
			expect(teaching).not.toContain(org);
		}
	});

	it("renders shared roles, studies, projects and the CV-only table", () => {
		const unfinished = variant((r) =>
			r.knowledge.studies?.push({
				name: "Ph.D. Education",
				degreeAchieved: false,
				startDate: "2025-09-01",
				institution: { name: "Somewhere" },
			} as never),
		);
		const linked = variant((r) => {
			r.experience.jobs[0].roles[0].name = "[Programmer](https://levels.fyi/x)";
		});
		for (const expected of [
			"**Programmer** — Analytical Engines · May 2026 – present",
			"Wrote the first program.",
			"**B.S. Mathematics** — Rocky Mountain College · 2011",
			"[Ailly](https://github.com/DavidSouther/ailly)",
			"**Teaching.** Domain experts.",
			"**Languages** — Rust",
			'<p class="no-print"><em>Draft</em></p>',
			"*References available on request.*",
		]) {
			expect(md).toContain(expected);
		}
		expect(cvMarkdown(unfinished)).toContain(
			"**Ph.D. Education** — Somewhere · September 2025 – present",
		);
		// A role title that links to a salary page keeps its text only.
		expect(cvMarkdown(linked)).toContain("**Programmer** — Analytical");
		expect(cvMarkdown(linked)).not.toContain("levels.fyi");
	});
});

function artifact(name: string, extra: object = {}) {
	return {
		type: "post",
		publishingDate: "2023-06-23",
		details: {
			name,
			description: `About ${name}.\n\n[Full text (PDF)](https://example.com/${name}.pdf)`,
		},
		...extra,
	};
}

function withPublications(
	groups: CvPublicationGroup[],
	artifacts: object[] = [],
): ResumeData {
	return variant((r) => {
		r.cv = { ...r.cv, publications: groups };
		r.experience.publicArtifacts = artifacts as never;
	});
}

describe("publication groups", () => {
	it("renders a posts group from front matter, in the listed order, skipping hidden posts", () => {
		const md = cvMarkdown(
			withPublications([{ heading: "Essays", posts: ["b", "a", "c"] }]),
			[postA, postB, { ...postA, id: "c", title: "Gamma", show: false }],
		);
		expect(md).toContain("### Essays");
		expect(md.indexOf("Beta")).toBeLessThan(md.indexOf("Alpha"));
		expect(md).toContain('Souther, D. "[Alpha](/blog/a)." 2024. First essay.');
		expect(md).not.toContain("Gamma");
	});

	it("prints a lecture post once: under Invited Talks, not again in an essay group", () => {
		const r = withPublications([{ heading: "Essays", posts: ["a", "b"] }]);
		r.cv = { ...r.cv, talks: ["a"] };
		const md = cvMarkdown(r, [postA, postB]);
		expect(md.split("[Alpha](/blog/a)").length - 1).toBe(1);
		expect(sectionOf(md, "Invited Talks and Presentations")).toContain("Alpha");
		expect(sectionOf(md, "Publications and Public Scholarship")).toContain(
			"Beta",
		);
	});

	it("fails the build on an unknown post id", () => {
		expect(() =>
			cvMarkdown(withPublications([{ heading: "E", posts: ["nope"] }]), [
				postA,
			]),
		).toThrow("cv.publications: unknown post id nope");
	});

	it("lists visible tagged artifacts with link, year and the whole shared description; the rest go last", () => {
		const md = cvMarkdown(
			withPublications(
				[{ heading: "Writing", tag: "Writing" }],
				[
					artifact("Shown", {
						tags: ["Writing"],
						details: {
							name: "Shown",
							URL: "https://example.com/s",
							description:
								"Souther et al. (first author).\n\n[Full text (PDF)](https://example.com/s.pdf)",
						},
					}),
					artifact("Hidden", { tags: ["Writing"], hide: true }),
					artifact("Loose"),
				],
			),
		);
		const group = sectionOf(md, "Publications and Public Scholarship");
		expect(group).toContain("[Shown](https://example.com/s) (2023)");
		expect(group).toContain("(first author)");
		expect(group).toContain("[Full text (PDF)](https://example.com/s.pdf)");
		expect(group).not.toContain("Hidden");
		expect(group.indexOf("Loose")).toBeGreaterThan(
			group.indexOf("### Other Publications"),
		);
	});
});

describe("sections quoted from shared text", () => {
	const marked = variant((r) => {
		r.experience.jobs[0].roles[0].challenges = [
			{
				description: `Led a team. ${mark("mentorship", "Engineering management", "I promoted two engineers.")} Shipped it. ${mark("talks", "Invited talk", "I spoke at a meetup.")}`,
			},
		];
	});
	const md = cvMarkdown(marked);

	it("quotes a marked sentence under the source's name and dates, leaving the role text whole", () => {
		const mentorship = sectionOf(md, "Mentorship and Advising");
		expect(mentorship).toContain(
			"**Engineering management** — Analytical Engines · May 2026 – present  \nI promoted two engineers.",
		);
		expect(mentorship).not.toContain("Shipped it.");
		expect(mentorship).not.toContain("I spoke at a meetup.");
		expect(mentorship).not.toContain("<span");
		expect(sectionOf(md, "Invited Talks and Presentations")).toContain(
			"I spoke at a meetup.",
		);
		expect(sectionOf(md, "Professional Appointments")).toContain("Shipped it.");
	});

	it("quotes a study description with the institution as the source", () => {
		const r = variant((v) => {
			const [study] = v.knowledge.studies ?? [];
			study.description = mark(
				"mentorship",
				"Tutoring",
				"Tutored for three years.",
			);
		});
		expect(sectionOf(cvMarkdown(r), "Mentorship and Advising")).toContain(
			"**Tutoring** — Rocky Mountain College · 2007 – 2011  \nTutored for three years.",
		);
	});

	it("lists lecture posts by id after the excerpts, skipping hidden ones", () => {
		const r = variant((v) => {
			v.cv = { ...v.cv, talks: ["a", "b"] };
		});
		const talks = sectionOf(
			cvMarkdown(r, [postA, { ...postB, show: false }]),
			"Invited Talks and Presentations",
		);
		expect(talks).toContain("[Alpha](/blog/a)");
		expect(talks).not.toContain("Beta");
	});

	it("prints flagged projects and Curriculum-tagged artifacts under Curriculum Development, not Software or Publications", () => {
		const r = variant((v) => {
			v.experience.projects.push({
				details: { name: "Craft Book", cvSection: "curriculum" },
				roles: [role("Developer", "2013-07-01")],
			} as never);
			v.experience.publicArtifacts = [
				artifact("Whiteboarding", { tags: ["Curriculum"] }),
			] as never;
		});
		const out = cvMarkdown(r);
		const curriculum = sectionOf(out, "Curriculum Development");
		expect(curriculum).toContain("Craft Book");
		expect(curriculum).toContain("Whiteboarding");
		expect(sectionOf(out, "Software and Open Source")).not.toContain(
			"Craft Book",
		);
		expect(out).not.toContain("Other Publications");
		expect(out.indexOf("## Curriculum Development")).toBeLessThan(
			out.indexOf("## Professional Appointments"),
		);
	});
});
