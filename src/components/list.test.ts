// @vitest-environment jsdom

import { span } from "@davidsouther/jiffies/dom/html.ts";
import { getAllByRole, getByText } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { IDLinkList, List } from "./list.ts";
import { mount, resetDom } from "./test-dom.ts";

afterEach(resetDom);

describe("List", () => {
	it("renders one li per item", () => {
		const container = mount(
			List([{ id: "a" }, { id: "b" }, { id: "c" }], (t) => t.id),
		);

		expect(container.querySelectorAll("li")).toHaveLength(3);
	});

	it("renders item content through the render callback", () => {
		const container = mount(
			List([{ id: "a", label: "Alpha" }], (t) => span(t.label)),
		);

		expect(getByText(container, "Alpha").tagName).toBe("SPAN");
	});

	it("renders an empty ul for no items", () => {
		const container = mount(List([] as { id: string }[], (t) => t.id));

		expect(container.querySelectorAll("li")).toHaveLength(0);
		expect(container.querySelector("ul")).not.toBeNull();
	});
});

describe("IDLinkList", () => {
	it("renders a link per item from the href and link accessors", () => {
		const container = mount(
			IDLinkList(
				[{ id: "1" }, { id: "2" }],
				(t) => `/p/${t.id}`,
				(t) => `Post ${t.id}`,
			),
		);

		const links = getAllByRole(container, "link");
		expect(links).toHaveLength(2);
		expect(links[0].getAttribute("href")).toBe("/p/1");
		expect(links[0].textContent).toBe("Post 1");
	});
});
