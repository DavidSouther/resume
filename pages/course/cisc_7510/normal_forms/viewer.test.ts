// @vitest-environment jsdom
import { screen } from "@testing-library/dom";
import { afterEach, describe, expect, it } from "vitest";
import { mount, resetDom } from "../../../../src/components/test-dom.ts";
import { buildKeyframes } from "./plan.ts";
import { loadStages } from "./staffing.ts";
import { renderControls, renderStage, setMarked } from "./viewer.ts";

afterEach(resetDom);
const stages = loadStages();

describe("renderStage", () => {
	it("renders the raw table with an id on every cell and NULL markers", () => {
		const c = mount(renderStage(stages[0]));
		expect(c.querySelectorAll("td[data-cell-id]")).toHaveLength(40);
		expect(c.querySelectorAll('td[data-null="true"]')).toHaveLength(4);
	});

	it("flags violating columns on the header and every cell below", () => {
		const c = mount(renderStage(stages[0], stages[1].violates));
		expect(c.querySelectorAll("th.violates")).toHaveLength(3);
		expect(c.querySelectorAll("td.violates")).toHaveLength(15);
	});

	it("renders one figure per table", () => {
		const c = mount(renderStage(stages[4]));
		expect(c.querySelectorAll("figure.nf-table")).toHaveLength(6);
	});
});

describe("renderControls", () => {
	it("has back, next, and a jump button per form", () => {
		mount(renderControls(buildKeyframes(stages)));
		expect(screen.getByRole("button", { name: "Back" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "Next" })).toBeTruthy();
		expect(screen.getByRole("button", { name: "3NF" })).toBeTruthy();
		expect(screen.getAllByRole("button")).toHaveLength(8);
	});

	it("names the nav with a real aria-label attribute", () => {
		const c = mount(renderControls(buildKeyframes(stages)));
		expect(c.querySelector("nav")?.getAttribute("aria-label")).toBe(
			"Normal form stepper",
		);
	});
});

describe("renderControls layout", () => {
	it("puts a flex spacer after Back and another before Next", () => {
		const c = mount(renderControls(buildKeyframes(stages)));
		const kids = [...(c.querySelector("nav")?.children ?? [])];
		expect(kids[0].hasAttribute("data-nf-prev")).toBe(true);
		expect(kids[1].classList.contains("nf-spacer")).toBe(true);
		expect(kids.at(-2)?.classList.contains("nf-spacer")).toBe(true);
		expect(kids.at(-1)?.hasAttribute("data-nf-next")).toBe(true);
	});
});

describe("setMarked", () => {
	it("flags and clears marked columns without replacing cells", () => {
		const c = mount(renderStage(stages[0]));
		const cell = c.querySelector("td");
		setMarked(c, stages[1].violates);
		expect(c.querySelectorAll("th.violates")).toHaveLength(3);
		expect(c.querySelectorAll("td.violates")).toHaveLength(15);
		setMarked(c, []);
		expect(c.querySelectorAll(".violates")).toHaveLength(0);
		expect(c.querySelector("td")).toBe(cell);
	});
});
