// @vitest-environment jsdom
import { span } from "@davidsouther/jiffies/dom/html.ts";
import { afterEach, describe, expect, it } from "vitest";
import { mount, resetDom } from "../test-dom.ts";
import { TimelineItem } from "./timeline-item.ts";

afterEach(resetDom);

describe("TimelineItem disclosure", () => {
	it("renders an expandable item as a native <details> accordion", () => {
		const container = mount(
			TimelineItem("car", true, undefined, span("Row text"), span("Detail")),
		);

		const details = container.querySelector("li.item details.card");
		expect(details).not.toBeNull();
		// The summary is the disclosure header; the detail follows it inside the
		// same <details>, so the browser opens it with no client JS.
		expect(details?.querySelector("summary")).not.toBeNull();
		expect(details?.querySelector(".detail")?.textContent).toContain("Detail");
	});

	it("uses no scripted toggle: there is no button.row", () => {
		const container = mount(
			TimelineItem("car", true, undefined, span("Row text"), span("Detail")),
		);

		expect(container.querySelector("button.row")).toBeNull();
	});

	it("renders a non-expandable item as a plain row, not a <details>", () => {
		const container = mount(
			TimelineItem("car", false, undefined, span("Row text")),
		);

		expect(container.querySelector("details")).toBeNull();
		expect(container.querySelector("li.item .card .row")).not.toBeNull();
	});
});
