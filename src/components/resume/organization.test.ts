// @vitest-environment jsdom
import { getByRole } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import type * as ResumeTypes from "../../lib/resume";
import { mount, resetDom } from "../test-dom.ts";
import { Organization } from "./organization.ts";

afterEach(resetDom);

describe("Organization", () => {
	it("renders the org name inside an h4.organization", () => {
		const org: ResumeTypes.PublicEntityDetails = { name: "Acme" };

		const container = mount(Organization(org));

		const heading = getByRole(container, "heading", { name: "Acme" });
		expect(heading.tagName).toBe("H4");
		expect(heading.className).toBe("organization");
	});

	it("links the name when URL is present", () => {
		const org: ResumeTypes.PublicEntityDetails = {
			name: "Acme",
			URL: "https://acme.test",
		};

		const container = mount(Organization(org));

		const link = getByRole(container, "link");
		expect(link.getAttribute("href")).toBe("https://acme.test");
		expect(link.textContent).toBe("Acme");
	});
});
