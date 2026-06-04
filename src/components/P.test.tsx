// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { A, MD } from "./P";

// globals are off (see vitest.config.ts), so Testing Library's auto-cleanup is
// not registered; unmount between tests explicitly. No jest-dom matchers are
// installed, so assertions read plain DOM properties.
afterEach(cleanup);

describe("A", () => {
	it("renders an anchor when href is provided", () => {
		render(<A href="/x">text</A>);

		const link = screen.getByRole("link");
		expect(link.getAttribute("href")).toBe("/x");
		expect(link.textContent).toBe("text");
	});

	it("renders a span when href is absent", () => {
		render(<A>text</A>);

		expect(screen.queryByRole("link")).toBeNull();
		expect(screen.getByText("text").tagName).toBe("SPAN");
	});
});

describe("MD", () => {
	it("renders markdown as HTML", () => {
		render(<MD># Hi</MD>);

		expect(screen.getByRole("heading", { name: "Hi" }).textContent).toBe("Hi");
	});
});
