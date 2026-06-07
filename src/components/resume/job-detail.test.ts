// @vitest-environment jsdom
import { getByRole, getByText } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import type * as ResumeTypes from "../../lib/resume";
import { mount, resetDom } from "../test-dom.ts";
import { COMPETENCES_LCL, COMPETENCES_MAP, JobDetail } from "./job-detail.ts";

afterEach(resetDom);

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
		const container = mount(JobDetail(job));

		expect(getByRole(container, "heading", { name: "Apollo" }).tagName).toBe(
			"H4",
		);
	});

	it("renders the role name and dates", () => {
		const container = mount(JobDetail(job));

		expect(container.querySelector("em.name")?.textContent).toContain(
			"Engineer",
		);
		expect(container.querySelector("small.start")?.textContent).toBe("2020-01");
		expect(container.querySelector("small.finish")?.textContent).toBe(
			"2022-06",
		);
	});

	it("labels an open role's finish date as Current", () => {
		const container = mount(
			JobDetail({
				organization: { name: "Apollo" },
				roles: [{ name: "Engineer", startDate: "2023-01" }],
			}),
		);

		expect(container.querySelector("small.finish")?.textContent).toBe(
			"Current",
		);
	});

	it("marks a pre-2018 role no-print", () => {
		const container = mount(
			JobDetail({
				organization: { name: "Legacy" },
				roles: [{ name: "Engineer", startDate: "2010", finishDate: "2015" }],
			}),
		);

		expect(
			container.querySelector("section.job")?.classList.contains("no-print"),
		).toBe(true);
	});

	it("does not mark a recent role no-print", () => {
		const container = mount(JobDetail(job));

		expect(
			container.querySelector("section.job")?.classList.contains("no-print"),
		).toBe(false);
	});

	it("maps a known competence to its label and URL", () => {
		const container = mount(JobDetail(job));

		const react = getByRole(container, "link", { name: "React" });
		expect(react.getAttribute("href")).toBe("https://react.dev/");
	});

	it("renders an unknown competence as plain text with no link", () => {
		const container = mount(JobDetail(job));

		expect(getByText(container, "wizardry").tagName).toBe("SPAN");
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
