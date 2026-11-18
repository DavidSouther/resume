import { describe, expect, it } from "vitest";
import { cvMarkdown, jobsIn, monthYear } from "./cv.ts";
import type { ResumeData } from "./resume";

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

	it("leads with contact details from the shared profile", () => {
		expect(md).toMatch(/^# Ada Lovelace/);
		expect(md).toContain("ada@example.com · (650) 495-5402");
		expect(md).toContain("[github.com/ada](https://github.com/ada)");
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
		expect(cvMarkdown(bare)).toMatch(/^# Ada Lovelace/);
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
