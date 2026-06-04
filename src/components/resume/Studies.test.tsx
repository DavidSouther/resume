// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import type * as ResumeTypes from "~/lib/resume";
import { Education } from "./Studies";

afterEach(cleanup);

const baseStudy: ResumeTypes.Study = {
	studyType: "officialDegree",
	degreeAchieved: true,
	name: "BSc Computer Science",
	startDate: "2004",
};

describe("Education", () => {
	it("renders the study name in em.name", () => {
		const { container } = render(<Education study={baseStudy} />);

		expect(container.querySelector("em.name")?.textContent).toBe(
			"BSc Computer Science",
		);
	});

	it("marks an unachieved degree no-print", () => {
		const { container } = render(
			<Education study={{ ...baseStudy, degreeAchieved: false }} />,
		);

		const root = container.querySelector("div.education");
		expect(root?.classList.contains("no-print")).toBe(true);
	});

	it("does not mark an achieved degree no-print", () => {
		const { container } = render(<Education study={baseStudy} />);

		const root = container.querySelector("div.education");
		expect(root?.classList.contains("no-print")).toBe(false);
	});

	it("renders the institution organization when present", () => {
		render(
			<Education study={{ ...baseStudy, institution: { name: "MIT" } }} />,
		);

		expect(screen.getByRole("heading", { name: "MIT" }).className).toBe(
			"organization",
		);
	});

	it("omits the finish date when absent", () => {
		const { container } = render(<Education study={baseStudy} />);

		expect(container.querySelector("small.finish")).toBeNull();
	});

	it("renders the finish date when present", () => {
		const { container } = render(
			<Education study={{ ...baseStudy, finishDate: "2008" }} />,
		);

		expect(container.querySelector("small.finish")?.textContent).toBe("2008");
	});

	it("renders the description text", () => {
		const { container } = render(
			<Education study={{ ...baseStudy, description: "Honors" }} />,
		);

		expect(container.querySelector("p.details")?.textContent).toBe("Honors");
	});
});
