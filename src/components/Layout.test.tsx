// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import Layout from "./Layout";

// Layout pulls its header straight from the committed src/app/resume.json, so
// these assertions track that fixture (profile name "David Souther", last
// update 2025). next/head is left unasserted: its children hoist to <head>
// outside the render container and are not a reliable DOM target in jsdom.
afterEach(cleanup);

describe("Layout", () => {
	it("renders children in the main region", () => {
		const { container } = render(
			<Layout title="Home">
				<p>page body</p>
			</Layout>,
		);

		expect(container.querySelector("main")?.textContent).toContain("page body");
	});

	it("renders the root container", () => {
		const { container } = render(<Layout title="Home">x</Layout>);

		expect(container.querySelector("#root.root")).not.toBeNull();
	});

	it("renders the about-me header from resume.json", () => {
		render(<Layout title="Home">x</Layout>);

		expect(screen.getByRole("heading", { level: 1 }).textContent).toContain(
			"David",
		);
	});

	it("renders a copyright footer with the resume's last-update year", () => {
		const { container } = render(<Layout title="Home">x</Layout>);

		expect(container.querySelector("footer.no-print")?.textContent).toContain(
			"2008-2025",
		);
	});

	it("links to the page source", () => {
		render(<Layout title="Home">x</Layout>);

		expect(
			screen.getByRole("link", { name: "Page Source" }).getAttribute("href"),
		).toBe("https://github.com/davidsouther/resume");
	});
});
