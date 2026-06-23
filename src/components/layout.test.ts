// @vitest-environment jsdom

import { h1, p } from "@davidsouther/jiffies/dom/html.ts";
import { getByRole } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { Layout } from "./layout.ts";
import { mount, resetDom } from "./test-dom.ts";

afterEach(resetDom);

describe("Layout", () => {
	it("renders children in the main region", () => {
		const container = mount(
			Layout({ lastUpdate: "2025-01-24", header: [] }, p("page body")),
		);

		expect(container.querySelector("main")?.textContent).toContain("page body");
	});

	it("renders the root container", () => {
		const container = mount(Layout({ lastUpdate: "2025-01-24", header: [] }));

		expect(container.querySelector("#root.root")).not.toBeNull();
	});

	it("renders the provided header children", () => {
		const container = mount(
			Layout({ lastUpdate: "2025-01-24", header: [h1("David")] }),
		);

		expect(getByRole(container, "heading", { level: 1 }).textContent).toContain(
			"David",
		);
	});

	it("applies an extra class to the root alongside .root", () => {
		const container = mount(
			Layout({ lastUpdate: "2025-01-24", header: [], class: "Custom" }),
		);

		expect(container.querySelector("#root.root.Custom")).not.toBeNull();
	});

	it("renders a copyright footer with the given last-update year", () => {
		const container = mount(Layout({ lastUpdate: "2025-01-24", header: [] }));

		expect(container.querySelector("footer.no-print")?.textContent).toContain(
			"2008-2025",
		);
	});

	it("links to the page source", () => {
		const container = mount(Layout({ lastUpdate: "2025-01-24", header: [] }));

		expect(
			getByRole(container, "link", { name: "Page Source" }).getAttribute(
				"href",
			),
		).toBe("https://github.com/davidsouther/resume");
	});
});
