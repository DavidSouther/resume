// @vitest-environment jsdom
import { getByRole, queryByText } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import type * as ResumeTypes from "../../lib/resume";
import { mount, resetDom } from "../test-dom.ts";
import { Pub, Resume } from "./resume.ts";

afterEach(resetDom);

// A full ResumeData with one of each section. Publications deliberately include
// an entry with no URL and a hidden entry, to exercise both filters in Resume.
const resume: ResumeTypes.ResumeData = {
	settings: { language: "EN", lastUpdate: "2025-01-01" },
	aboutMe: { profile: { name: "David" } },
	experience: {
		jobs: [
			{
				organization: { name: "Apollo" },
				roles: [{ name: "Engineer", startDate: "2020" }],
			},
		],
		projects: [
			{ details: { name: "Jiffies", URL: "https://x.test" }, roles: [] },
		],
		publicArtifacts: [
			{
				details: { name: "Talk A", URL: "https://a.test" },
				publishingDate: "2021",
			},
			{ details: { name: "Hidden Talk", URL: "https://b.test" }, hide: true },
			{ details: { name: "Unlinked Talk" } },
		],
	},
	knowledge: {
		studies: [
			{
				studyType: "officialDegree",
				degreeAchieved: true,
				name: "BSc",
				startDate: "2004",
			},
		],
	},
};

describe("Resume", () => {
	it("renders a Roles & Positions card listing each job's organization", () => {
		const container = mount(Resume(resume));

		expect(
			getByRole(container, "heading", { name: "Roles & Positions" }).tagName,
		).toBe("H3");
		expect(getByRole(container, "heading", { name: "Apollo" })).not.toBeNull();
	});

	it("renders an Education card listing each study", () => {
		const container = mount(Resume(resume));

		expect(
			getByRole(container, "heading", { name: "Education" }),
		).not.toBeNull();
		expect(queryByText(container, "BSc")).not.toBeNull();
	});

	it("renders a Projects card from projects that carry details", () => {
		const container = mount(Resume(resume));

		expect(
			getByRole(container, "heading", { name: "Projects" }),
		).not.toBeNull();
		expect(getByRole(container, "link", { name: "Jiffies" })).not.toBeNull();
	});

	it("lists a publication that has a URL and is not hidden", () => {
		const container = mount(Resume(resume));

		expect(
			getByRole(container, "heading", { name: "Publications" }),
		).not.toBeNull();
		expect(getByRole(container, "link", { name: "Talk A" })).not.toBeNull();
	});

	it("omits hidden publications and publications without a URL", () => {
		const container = mount(Resume(resume));

		expect(queryByText(container, "Hidden Talk")).toBeNull();
		expect(queryByText(container, "Unlinked Talk")).toBeNull();
	});
});

describe("Pub", () => {
	it("links the name when a URL is present", () => {
		const container = mount(Pub({ name: "Paper", URL: "https://p.test" }));

		expect(
			getByRole(container, "link", { name: "Paper" }).getAttribute("href"),
		).toBe("https://p.test");
	});

	it("renders the name as plain text when no URL is present", () => {
		const container = mount(Pub({ name: "Paper" }));

		expect(container.querySelector("a")).toBeNull();
		expect(container.querySelector("span")?.textContent).toBe("Paper");
	});

	it("renders the publishing date when provided", () => {
		const container = mount(
			Pub({ name: "Paper", URL: "https://p.test" }, "2022-05"),
		);

		expect(container.querySelector("small em")?.textContent).toBe("2022-05");
	});

	it("renders the description as markdown", () => {
		const container = mount(
			Pub({ name: "Paper", description: "A **bold** claim" }),
		);

		expect(container.querySelector("strong")?.textContent).toBe("bold");
	});
});
