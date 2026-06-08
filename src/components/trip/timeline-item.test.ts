// @vitest-environment jsdom
import { span } from "@davidsouther/jiffies/dom/html.ts";
import { afterEach, describe, expect, it } from "vitest";
import { mount, resetDom } from "../test-dom.ts";
import { TimelineItem } from "./timeline-item.ts";

afterEach(resetDom);

describe("TimelineItem disclosure", () => {
	it("renders an expandable item as a native <details> accordion", () => {
		const container = mount(
			TimelineItem({ icon: "car", row: span("Row text") }, span("Detail")),
		);

		// Expandable items are a jiffies Accordion: li > details > summary + body,
		// with no card/detail wrapper classes and no scripted toggle.
		const details = container.querySelector("li > details");
		expect(details).not.toBeNull();
		const summary = details?.querySelector("summary");
		expect(summary?.textContent).toContain("Row text");
		// The detail follows the summary inside the same <details>, so the browser
		// opens it with no client JS — it is the body, not part of the summary.
		expect(summary?.textContent).not.toContain("Detail");
		expect(details?.textContent).toContain("Detail");
		expect(container.querySelector(".card")).toBeNull();
		expect(container.querySelector(".detail")).toBeNull();
		expect(container.querySelector("li.item")).toBeNull();
	});

	it("uses no scripted toggle: there is no button.row", () => {
		const container = mount(
			TimelineItem({ icon: "car", row: span("Row text") }, span("Detail")),
		);

		expect(container.querySelector("button.row")).toBeNull();
	});

	it("renders a non-expandable item as a flat panel, not a <details>", () => {
		const container = mount(
			TimelineItem({ icon: "car", expandable: false, row: span("Row text") }),
		);

		// Non-expandable items are a jiffies Panel: li > section > main, no details,
		// no hand-built div.card / div.row.
		expect(container.querySelector("details")).toBeNull();
		const panelMain = container.querySelector("li > section > main");
		expect(panelMain).not.toBeNull();
		expect(panelMain?.textContent).toContain("Row text");
		expect(container.querySelector("div.card")).toBeNull();
		expect(container.querySelector("div.row")).toBeNull();
	});
});
