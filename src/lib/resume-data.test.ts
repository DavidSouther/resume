import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parse } from "smol-toml";
import { describe, expect, it } from "vitest";
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
});
