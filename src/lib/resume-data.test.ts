import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";
import { getSortedPosts } from "./posts.ts";
import type { ResumeData } from "./resume";

const raw = readFileSync(
	join(import.meta.dirname, "..", "resume.toml"),
	"utf-8",
);
const data = parse(raw) as unknown as ResumeData;
const { jobs, publicArtifacts } = data.experience;

function titlesTagged(tag: string): string[] {
	return publicArtifacts
		.filter((a) => a.tags?.includes(tag))
		.map((a) => a.details.name);
}

describe("src/resume.toml CV markers", () => {
	it("marks exactly the teaching jobs", () => {
		const marked = jobs
			.filter((j) => j.cvSection === "teaching")
			.map((j) => j.organization.name);
		expect(new Set(marked)).toEqual(
			new Set([
				"Code Fellows",
				"Chatham University",
				"Mt Holyoke College & Google",
			]),
		);
	});

	it("uses only known cvSection values", () => {
		for (const job of jobs) {
			expect([undefined, "teaching", "professional"]).toContain(job.cvSection);
		}
	});

	it("never says Smith University", () => {
		expect(raw).not.toContain("Smith University");
	});

	it("tags artifacts into publication groups", () => {
		expect(titlesTagged("Defensive Publication")).toHaveLength(1);
		expect(titlesTagged("Industry Writing")).toEqual([
			expect.stringMatching(/^Cloud Journeys/),
		]);
		expect(titlesTagged("Curriculum")).toEqual(["Technical Whiteboarding"]);
		expect(titlesTagged("Community")).toEqual([
			"Is stat() an expensive system call?",
			"Format Date time in AngularJS",
			"Top 5% at Stack Overflow answers",
			"Top 10% at Stack Overflow answers",
			"Top 20% at Stack Overflow answers",
		]);
	});

	it("lists only posts that exist in cv.publications", () => {
		const known = new Set(getSortedPosts().map((p) => p.id));
		const ids = (data.cv?.publications ?? []).flatMap((g) => g.posts ?? []);
		expect(ids.length).toBeGreaterThan(0);
		for (const id of ids) expect(known, id).toContain(id);
	});

	it("states the Code Fellows NPS as a bound, not a perfect score", () => {
		expect(raw).toContain("above 80 net promoter");
		expect(raw).not.toContain("100 net promoter");
	});

	it("keeps the defensive publication's first-author and full-text link in its shared description", () => {
		const dpub = publicArtifacts.find((a) =>
			a.tags?.includes("Defensive Publication"),
		);
		expect(dpub?.details.description).toContain("first author");
		expect(dpub?.details.description).toContain("Full text (PDF)");
	});

	it("marks excerpts for the Mentorship, Talks and Curriculum sections in shared text", () => {
		for (const section of ["mentorship", "talks", "curriculum"]) {
			expect(raw, section).toMatch(
				new RegExp(`<span data-cv="${section}" data-title="[^"]+">`),
			);
		}
		const opens = raw.match(/<span data-cv=/g)?.length ?? 0;
		expect(raw.match(/<\/span>/g)?.length ?? 0).toBe(opens);
	});

	it("flags the two curriculum projects, and no artifact is also a curriculum group in publications", () => {
		const flagged = data.experience.projects
			.filter((p) => p.details?.cvSection === "curriculum")
			.map((p) => p.details?.name);
		expect(new Set(flagged)).toEqual(
			new Set(["DavidSouther/software_craftsmanship", "nand2tetris/web-ide"]),
		);
		const groups = (data.cv?.publications ?? []).map((g) => g.heading);
		expect(groups).not.toContain("Curriculum");
	});

	it("lists only talk posts that exist", () => {
		const known = new Set(getSortedPosts().map((p) => p.id));
		expect(data.cv?.talks).toEqual(["ilities"]);
		for (const id of data.cv?.talks ?? []) expect(known, id).toContain(id);
	});
});
