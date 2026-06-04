// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type * as ResumeTypes from "~/lib/resume";
import { COMPETENCES_LCL, COMPETENCES_MAP, JobDetail } from "./JobDetail";

afterEach(cleanup);

const job: ResumeTypes.JobExperience = {
	organization: { name: "Apollo", URL: "https://apollo.test" },
	roles: [
		{
			name: "Engineer",
			startDate: "2020-01",
			finishDate: "2022-06",
			challenges: [{ description: "Built **things**" }],
			competences: [
				{ name: "react", type: "technology" },
				{ name: "wizardry", type: "practice" },
			],
		},
	],
};

describe("JobDetail", () => {
	it("renders the organization heading", () => {
		render(<JobDetail job={job} />);

		const org = screen.getByRole("heading", { name: "Apollo" });
		expect(org.tagName).toBe("H4");
	});

	it("renders the role name and dates", () => {
		const { container } = render(<JobDetail job={job} />);

		expect(container.querySelector("em.name")?.textContent).toContain(
			"Engineer",
		);
		expect(container.querySelector("small.start")?.textContent).toBe("2020-01");
		expect(container.querySelector("small.finish")?.textContent).toBe(
			"2022-06",
		);
	});

	it("labels an open role's finish date as Current", () => {
		const open: ResumeTypes.JobExperience = {
			organization: { name: "Apollo" },
			roles: [{ name: "Engineer", startDate: "2023-01" }],
		};

		const { container } = render(<JobDetail job={open} />);

		expect(container.querySelector("small.finish")?.textContent).toBe(
			"Current",
		);
	});

	it("marks a pre-2018 role no-print", () => {
		const old: ResumeTypes.JobExperience = {
			organization: { name: "Legacy" },
			roles: [{ name: "Engineer", startDate: "2010", finishDate: "2015" }],
		};

		const { container } = render(<JobDetail job={old} />);

		expect(
			container.querySelector("section.job")?.classList.contains("no-print"),
		).toBe(true);
	});

	it("does not mark a recent role no-print", () => {
		const { container } = render(<JobDetail job={job} />);

		expect(
			container.querySelector("section.job")?.classList.contains("no-print"),
		).toBe(false);
	});

	it("maps a known competence to its label and URL", () => {
		render(<JobDetail job={job} />);

		const react = screen.getByRole("link", { name: "React" });
		expect(react.getAttribute("href")).toBe("https://react.dev/");
	});

	it("renders an unknown competence as plain text with no link", () => {
		render(<JobDetail job={job} />);

		const unknown = screen.getByText("wizardry");
		expect(unknown.tagName).toBe("SPAN");
	});
});

describe("competence lookup tables", () => {
	it("resolves display labels for known keys", () => {
		expect(COMPETENCES_LCL.get("react")).toBe("React");
		expect(COMPETENCES_LCL.get("typescript")).toBe("TypeScript");
	});

	it("resolves reference URLs for known keys", () => {
		expect(COMPETENCES_MAP.get("react")).toBe("https://react.dev/");
		expect(COMPETENCES_MAP.get("kubernetes")).toBe("https://kubernetes.io");
	});
});
