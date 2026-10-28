// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { Viewer } from "./client.ts";
import { mountNormalForms } from "./client.ts";
import { buildKeyframes } from "./plan.ts";
import { loadStaffingCsv, loadStages } from "./staffing.ts";
import { renderControls, renderStage } from "./viewer.ts";

const stages = loadStages();
const frames = buildKeyframes(stages);

beforeEach(() => {
	document.body.innerHTML = "";
	const fig = document.createElement("figure");
	fig.id = "nf-figure";
	const canvas = document.createElement("div");
	canvas.className = "nf-canvas";
	canvas.append(renderStage(stages[0]));
	fig.append(renderControls(frames), canvas);
	document.body.append(fig);
	const data = document.createElement("script");
	data.id = "nf-data";
	data.type = "text/csv";
	data.textContent = loadStaffingCsv();
	document.body.append(data);
	for (const _ of frames) {
		const s = document.createElement("section");
		s.className = "nf-step";
		document.body.append(s);
	}
	Element.prototype.scrollIntoView = () => {};
});
let mounted: Viewer | undefined;
afterEach(() => {
	mounted?.destroy();
	document.body.innerHTML = "";
});
const mountIt = (): Viewer => {
	mounted = mountNormalForms(
		document.getElementById("nf-figure") as HTMLElement,
	);
	return mounted;
};

const tableNames = (): string[] =>
	[...document.querySelectorAll("figure.nf-table")].map(
		(f) => f.getAttribute("data-table") ?? "",
	);

describe("mountNormalForms", () => {
	it("starts on the raw table", () => {
		const v = mountIt();
		expect(v.current()).toBe(0);
		expect(tableNames()).toEqual(["Staffing"]);
	});

	it("Next twice reaches 1NF settled; violators are marked in between", () => {
		const root = document.getElementById("nf-figure") as HTMLElement;
		mountIt();
		(document.querySelector("[data-nf-next]") as HTMLElement).click();
		expect(document.querySelectorAll("th.violates")).toHaveLength(3);
		(document.querySelector("[data-nf-next]") as HTMLElement).click();
		expect(document.querySelectorAll("th.violates")).toHaveLength(0);
		expect(document.querySelectorAll("tbody tr")).toHaveLength(13);
		expect(root.dataset.keyframe).toBe("2");
	});

	it("arrow keys step forward and back, clamped to the ends", () => {
		const v = mountIt();
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowLeft" }));
		expect(v.current()).toBe(0);
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowDown" }));
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowRight" }));
		expect(v.current()).toBe(2);
		document.dispatchEvent(new KeyboardEvent("keydown", { key: "ArrowUp" }));
		expect(v.current()).toBe(1);
	});

	it("disables Back at the first keyframe and Next at the last", () => {
		const v = mountIt();
		const prev = document.querySelector("[data-nf-prev]") as HTMLButtonElement;
		const next = document.querySelector("[data-nf-next]") as HTMLButtonElement;
		expect(prev.disabled).toBe(true);
		expect(next.disabled).toBe(false);
		v.goTo(frames.length - 1);
		expect(prev.disabled).toBe(false);
		expect(next.disabled).toBe(true);
	});

	it("does not prevent default when ArrowLeft cannot move", () => {
		mountIt();
		const e = new KeyboardEvent("keydown", {
			key: "ArrowLeft",
			cancelable: true,
		});
		document.dispatchEvent(e);
		expect(e.defaultPrevented).toBe(false);
		const f = new KeyboardEvent("keydown", {
			key: "ArrowRight",
			cancelable: true,
		});
		document.dispatchEvent(f);
		expect(f.defaultPrevented).toBe(true);
	});

	it("form buttons jump straight to a settled stage", () => {
		const v = mountIt();
		(document.querySelector('[data-nf-jump="6"]') as HTMLElement).click();
		expect(v.current()).toBe(6);
		expect(tableNames()).toContain("Departments");
		expect(tableNames()).not.toContain("EmployeeDetails");
	});

	it("retints in place within a stage and steps back to a violates frame", () => {
		const v = mountIt();
		v.goTo(2);
		const cell = document.querySelector("td");
		v.goTo(3);
		expect(document.querySelector("td")).toBe(cell);
		expect(document.querySelectorAll("th.violates").length).toBeGreaterThan(0);
		v.goTo(4);
		v.goTo(3);
		expect(v.current()).toBe(3);
		expect(document.querySelectorAll("th.violates").length).toBeGreaterThan(0);
		expect(tableNames()).toEqual(["Staffing"]);
	});
});
