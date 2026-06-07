// @vitest-environment jsdom
import { getByRole } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import type * as ResumeTypes from "../../lib/resume";
import { mount, resetDom } from "../test-dom.ts";
import { Education } from "./studies.ts";

afterEach(resetDom);

const baseStudy: ResumeTypes.Study = {
	studyType: "officialDegree",
	degreeAchieved: true,
	name: "BSc Computer Science",
	startDate: "2004",
};

describe("Education", () => {
	it("renders the study name in em.name", () => {
		const container = mount(Education(baseStudy));

		expect(container.querySelector("em.name")?.textContent).toBe(
			"BSc Computer Science",
		);
	});

	it("marks an unachieved degree no-print", () => {
		const container = mount(Education({ ...baseStudy, degreeAchieved: false }));

		expect(
			container.querySelector("div.education")?.classList.contains("no-print"),
		).toBe(true);
	});

	it("does not mark an achieved degree no-print", () => {
		const container = mount(Education(baseStudy));

		expect(
			container.querySelector("div.education")?.classList.contains("no-print"),
		).toBe(false);
	});

	it("renders the institution organization when present", () => {
		const container = mount(
			Education({ ...baseStudy, institution: { name: "MIT" } }),
		);

		expect(getByRole(container, "heading", { name: "MIT" }).className).toBe(
			"organization",
		);
	});

	it("omits the finish date when absent", () => {
		const container = mount(Education(baseStudy));

		expect(container.querySelector("small.finish")).toBeNull();
	});

	it("renders the finish date when present", () => {
		const container = mount(Education({ ...baseStudy, finishDate: "2008" }));

		expect(container.querySelector("small.finish")?.textContent).toBe("2008");
	});

	it("renders the description text", () => {
		const container = mount(Education({ ...baseStudy, description: "Honors" }));

		expect(container.querySelector("p.details")?.textContent).toBe("Honors");
	});
});
