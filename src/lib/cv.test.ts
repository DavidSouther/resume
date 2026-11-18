import { describe, expect, it } from "vitest";
import { cvMarkdown, monthYear } from "./cv.ts";
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
		],
		projects: [],
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
	academic: {
		note: "Draft",
		footer: "References available on request.",
		interests: [{ title: "Teaching", body: "Domain experts." }],
		teaching: [
			{ title: "**Lecturer**", meta: "Chatham · 2016", body: "Taught." },
		],
		curriculum: [],
		mentorship: [],
		software: [],
		service: [],
		publications: [{ heading: "Essays", body: "- one" }],
		talks: [],
		competencies: [{ label: "Languages", items: "Rust" }],
	},
} as unknown as ResumeData;

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
			"## Academic and Teaching Appointments",
			"## Professional Appointments",
			"## Publications and Public Scholarship",
			"## Technical Competencies",
		]);
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

	it("separates a title from its body when there is no meta", () => {
		const md = cvMarkdown({
			...resume,
			academic: {
				...(resume.academic as NonNullable<ResumeData["academic"]>),
				service: [{ title: "**Open source**", body: "Ongoing." }],
			},
		});
		expect(md).toContain("**Open source** — Ongoing.");
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
		expect(md).not.toContain("Curriculum Development");
		expect(md).toContain("*References available on request.*");
	});
});
