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
const { jobs, projects, publicArtifacts } = data.experience;

// These guard the shared data the CV reads. What each section prints is
// covered against fixtures in cv.test.ts and end to end in
// pages/cv/resume-and-cv.feature.test.ts.
describe("src/resume.toml, as the CV reads it", () => {
	it("marks exactly the teaching jobs, with known section values", () => {
		const teaching = jobs
			.filter((j) => j.cvSection === "teaching")
			.map((j) => j.organization.name);
		expect(new Set(teaching)).toEqual(
			new Set([
				"Code Fellows",
				"Chatham University",
				"Mt Holyoke College & Google",
			]),
		);
		for (const job of jobs) {
			expect([undefined, "teaching", "professional"]).toContain(job.cvSection);
		}
	});

	it("gives every publication tag group at least one artifact, and every post id a post", () => {
		const groups = data.cv?.publications ?? [];
		for (const { heading, tag } of groups.filter((g) => g.tag !== undefined)) {
			expect(
				publicArtifacts.some((a) => a.tags?.includes(tag as string)),
				`group "${heading}" has no artifacts`,
			).toBe(true);
		}
		const known = new Set(getSortedPosts().map((p) => p.id));
		const ids = [
			...groups.flatMap((g) => g.posts ?? []),
			...(data.cv?.talks ?? []),
		];
		expect(ids.length).toBeGreaterThan(0);
		for (const id of ids) expect(known, id).toContain(id);
	});

	it("marks balanced excerpts for each quoted section, and Curriculum artifacts and projects live only there", () => {
		for (const section of ["mentorship", "talks", "curriculum"]) {
			expect(raw, section).toContain(`<span data-cv="${section}"`);
		}
		const opens = raw.match(/<span data-cv=/g)?.length ?? 0;
		expect(raw.match(/<\/span>/g)?.length ?? 0).toBe(opens);
		expect(projects.some((p) => p.details?.cvSection === "curriculum")).toBe(
			true,
		);
		expect(data.cv?.publications?.map((g) => g.heading)).not.toContain(
			"Curriculum",
		);
	});

	it("keeps the facts the author settled", () => {
		expect(raw).not.toContain("Smith University");
		expect(raw).toContain("above 80 net promoter");
		expect(raw).not.toContain("100 net promoter");
		const dpub = publicArtifacts.find((a) =>
			a.tags?.includes("Defensive Publication"),
		)?.details.description;
		expect(dpub).toContain("first author");
		expect(dpub).toContain("Full text (PDF)");
	});
});
