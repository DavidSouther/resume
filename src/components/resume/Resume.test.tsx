// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type * as ResumeTypes from "~/lib/resume";
import { Pub, Resume } from "./Resume";

afterEach(cleanup);

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
		render(<Resume resume={resume} />);

		expect(
			screen.getByRole("heading", { name: "Roles & Positions" }).tagName,
		).toBe("H3");
		expect(screen.getByRole("heading", { name: "Apollo" })).not.toBeNull();
	});

	it("renders an Education card listing each study", () => {
		render(<Resume resume={resume} />);

		expect(screen.getByRole("heading", { name: "Education" })).not.toBeNull();
		expect(screen.getByText("BSc")).not.toBeNull();
	});

	it("renders a Projects card from projects that carry details", () => {
		render(<Resume resume={resume} />);

		expect(screen.getByRole("heading", { name: "Projects" })).not.toBeNull();
		expect(screen.getByRole("link", { name: "Jiffies" })).not.toBeNull();
	});

	it("lists a publication that has a URL and is not hidden", () => {
		render(<Resume resume={resume} />);

		expect(
			screen.getByRole("heading", { name: "Publications" }),
		).not.toBeNull();
		expect(screen.getByRole("link", { name: "Talk A" })).not.toBeNull();
	});

	it("omits hidden publications and publications without a URL", () => {
		render(<Resume resume={resume} />);

		expect(screen.queryByText("Hidden Talk")).toBeNull();
		expect(screen.queryByText("Unlinked Talk")).toBeNull();
	});
});

describe("Pub", () => {
	it("links the name when a URL is present", () => {
		render(<Pub details={{ name: "Paper", URL: "https://p.test" }} />);

		const link = screen.getByRole("link", { name: "Paper" });
		expect(link.getAttribute("href")).toBe("https://p.test");
	});

	it("renders the name as plain text when no URL is present", () => {
		render(<Pub details={{ name: "Paper" }} />);

		expect(screen.queryByRole("link")).toBeNull();
		expect(screen.getByText("Paper").tagName).toBe("SPAN");
	});

	it("renders the publishing date when provided", () => {
		const { container } = render(
			<Pub details={{ name: "Paper", URL: "https://p.test" }} date="2022-05" />,
		);

		expect(container.querySelector("small em")?.textContent).toBe("2022-05");
	});

	it("renders the description as markdown", () => {
		const { container } = render(
			<Pub details={{ name: "Paper", description: "A **bold** claim" }} />,
		);

		expect(container.querySelector("strong")?.textContent).toBe("bold");
	});
});
