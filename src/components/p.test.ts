// @vitest-environment jsdom
import { getByText, queryByRole } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { A, MD } from "./p.ts";
import { mount, resetDom } from "./test-dom.ts";

afterEach(resetDom);

describe("A", () => {
	it("renders an anchor when href is provided", () => {
		const container = mount(A("/x", "text"));

		const link = container.querySelector("a");
		expect(link?.getAttribute("href")).toBe("/x");
		expect(link?.textContent).toBe("text");
	});

	it("renders a span when href is absent", () => {
		const container = mount(A(undefined, "text"));

		expect(queryByRole(container, "link")).toBeNull();
		expect(getByText(container, "text").tagName).toBe("SPAN");
	});
});

describe("MD", () => {
	it("renders markdown as HTML", () => {
		const container = mount(MD("# Hi"));

		expect(container.querySelector("h1")?.textContent).toBe("Hi");
	});
});
