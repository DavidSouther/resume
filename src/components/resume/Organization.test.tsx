// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Organization } from "~/components/resume/Organization";
import type * as ResumeTypes from "~/lib/resume";

// Both imports above resolve through the ~/ alias. If vite-tsconfig-paths
// (Step 1) were missing, this suite would fail at import resolution — the
// intended signal that the alias is wired.
afterEach(cleanup);

describe("Organization", () => {
	it("renders the org name inside an h4.organization", () => {
		const org: ResumeTypes.PublicEntityDetails = { name: "Acme" };

		render(<Organization org={org} />);

		const heading = screen.getByRole("heading", { name: "Acme" });
		expect(heading.tagName).toBe("H4");
		expect(heading.className).toBe("organization");
	});

	it("links the name when URL is present", () => {
		const org: ResumeTypes.PublicEntityDetails = {
			name: "Acme",
			URL: "https://acme.test",
		};

		render(<Organization org={org} />);

		const link = screen.getByRole("link");
		expect(link.getAttribute("href")).toBe("https://acme.test");
		expect(link.textContent).toBe("Acme");
	});
});
