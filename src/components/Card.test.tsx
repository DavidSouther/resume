// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { Card } from "./Card";

// globals are off (see vitest.config.ts), so unmount between tests explicitly.
// No jest-dom matchers are installed, so assertions read plain DOM properties.
afterEach(cleanup);

describe("Card", () => {
	it("renders children inside the article's main", () => {
		const { container } = render(<Card>body content</Card>);

		const article = container.querySelector("article");
		expect(article?.querySelector("main")?.textContent).toBe("body content");
	});

	it("applies the className to the article", () => {
		const { container } = render(<Card className="jobs">x</Card>);

		expect(container.querySelector("article")?.className).toBe("jobs");
	});

	it("renders the header inside an h3 when provided", () => {
		render(<Card header="Roles">x</Card>);

		const heading = screen.getByRole("heading", { name: "Roles" });
		expect(heading.tagName).toBe("H3");
	});

	it("omits the header element when no header is given", () => {
		const { container } = render(<Card>x</Card>);

		expect(container.querySelector("header")).toBeNull();
	});

	it("renders the footer when provided", () => {
		const { container } = render(<Card footer="foot note">x</Card>);

		expect(container.querySelector("footer")?.textContent).toBe("foot note");
	});

	it("omits the footer when none is given", () => {
		const { container } = render(<Card>x</Card>);

		expect(container.querySelector("footer")).toBeNull();
	});
});
