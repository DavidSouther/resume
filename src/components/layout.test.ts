// @vitest-environment jsdom

import { p } from "@davidsouther/jiffies/dom/html.ts";
import { getByRole } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import type { ResumeData } from "../lib/resume";
import { Layout } from "./layout.ts";
import { mount, resetDom } from "./test-dom.ts";

afterEach(resetDom);

const resume: ResumeData = {
	settings: { language: "en-US", lastUpdate: "2025-01-24" },
	aboutMe: {
		profile: { name: "David", surnames: "Souther", title: "Engineer" },
	},
	experience: { jobs: [], projects: [], publicArtifacts: [] },
	knowledge: {},
};

describe("Layout", () => {
	it("renders children in the main region", () => {
		const container = mount(Layout(resume, p("page body")));

		expect(container.querySelector("main")?.textContent).toContain("page body");
	});

	it("renders the root container", () => {
		const container = mount(Layout(resume));

		expect(container.querySelector("#root.root")).not.toBeNull();
	});

	it("renders the about-me header from the resume", () => {
		const container = mount(Layout(resume));

		expect(getByRole(container, "heading", { level: 1 }).textContent).toContain(
			"David",
		);
	});

	it("renders a copyright footer with the resume's last-update year", () => {
		const container = mount(Layout(resume));

		expect(container.querySelector("footer.no-print")?.textContent).toContain(
			"2008-2025",
		);
	});

	it("links to the page source", () => {
		const container = mount(Layout(resume));

		expect(
			getByRole(container, "link", { name: "Page Source" }).getAttribute(
				"href",
			),
		).toBe("https://github.com/davidsouther/resume");
	});
});
