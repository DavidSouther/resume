// @vitest-environment jsdom
import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { IDLinkList, List } from "./List";

afterEach(cleanup);

describe("List", () => {
	it("renders one li per item", () => {
		const items = [{ id: "a" }, { id: "b" }, { id: "c" }];

		const { container } = render(<List items={items} item={(t) => t.id} />);

		expect(container.querySelectorAll("li")).toHaveLength(3);
	});

	it("renders item content through the render prop", () => {
		const items = [{ id: "a", label: "Alpha" }];

		render(<List items={items} item={(t) => <span>{t.label}</span>} />);

		expect(screen.getByText("Alpha").tagName).toBe("SPAN");
	});

	it("renders nothing but an empty ul for no items", () => {
		const items: { id: string }[] = [];

		const { container } = render(<List items={items} item={(t) => t.id} />);

		expect(container.querySelectorAll("li")).toHaveLength(0);
		expect(container.querySelector("ul")).not.toBeNull();
	});
});

describe("IDLinkList", () => {
	it("renders a link per item from the href and link accessors", () => {
		const items = [{ id: "1" }, { id: "2" }];

		render(
			<IDLinkList
				items={items}
				href={(t) => `/p/${t.id}`}
				link={(t) => `Post ${t.id}`}
			/>,
		);

		const links = screen.getAllByRole("link");
		expect(links).toHaveLength(2);
		expect(links[0].getAttribute("href")).toBe("/p/1");
		expect(links[0].textContent).toBe("Post 1");
	});
});
