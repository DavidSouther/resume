// @vitest-environment jsdom

// Unit guard (Astrolabe FCC refactor, Feature 3 — leaf control FCCs): each leaf
// is dumb and presentational. It renders its UI from its value props and applies
// the single styling effect it owns (a hide-* root class, the full-screen class,
// or a CSS var via the sink). Event handlers arrive in the `events` prop (the
// Jiffies wiring contract) and fire off the user's interaction; the consumer
// reads the value off the event target. See
// .ailly/developer/2026-06-23-A-astrolabe-fcc-refactor/controls-redesign.md.
import { beforeEach, describe, expect, it } from "vitest";
import { MATERIALS } from "../../lib/astrolabe/materials.ts";
import {
	CheckControl,
	ColorPicker,
	MaterialPicker,
	RangeControl,
	type RootStyleSink,
	rootStyleSink,
	SegmentGroup,
} from "./controls-components.ts";

function fire(el: Element, type: string): void {
	el.dispatchEvent(new Event(type, { bubbles: true }));
}

// A sink that records its writes without touching any root — proves the color /
// material controls write THROUGH the sink, not the DOM directly.
function recordingSink(): RootStyleSink & { calls: [string, string][] } {
	const calls: [string, string][] = [];
	return { calls, set: (n, v) => calls.push([n, v]) };
}

describe("CheckControl — owns its hide-* class, fires its change event", () => {
	let root: HTMLElement;
	beforeEach(() => {
		root = document.createElement("div");
	});

	it("adds/removes its hide class from the passed root by checked", () => {
		const el = CheckControl({
			id: "t_orbits",
			checked: true,
			root,
			rootClass: "hide-orbits",
		});
		expect(root.classList.contains("hide-orbits")).toBe(false); // checked ⇒ shown

		el.update({ checked: false });
		expect(root.classList.contains("hide-orbits")).toBe(true);

		el.update({ checked: true });
		expect(root.classList.contains("hide-orbits")).toBe(false);
	});

	it("wires its change handler from `events`; the target carries the value", () => {
		let seen: boolean | null = null;
		const el = CheckControl({
			id: "t_orbits",
			checked: true,
			root,
			rootClass: "hide-orbits",
			events: {
				change: (e) => {
					seen = (e.target as HTMLInputElement).checked;
				},
			},
		});
		(el as unknown as HTMLInputElement).checked = false;
		fire(el, "change");
		expect(seen).toBe(false);
	});

	it("touches no root when it owns no class (rootClass omitted)", () => {
		const el = CheckControl({ id: "parallaxOn", checked: true, root });
		el.update({ checked: false });
		expect(root.classList.length).toBe(0);
	});
});

describe("RangeControl — renders value + readout from [State] nodes", () => {
	it("drives the SAME input + readout across updates (no rebuild)", () => {
		const el = RangeControl({
			id: "parallax",
			value: 0.7,
			label: "0.70",
			min: 0,
			max: 1.5,
			step: 0.05,
		});
		const inp = el.querySelector("input") as HTMLInputElement;
		const out = el.querySelector(".val") as HTMLElement;
		expect(inp.value).toBe("0.7");
		expect(out.textContent).toBe("0.70");

		el.update({ value: 1.2, label: "1.20" });
		// Same nodes, new values (the dirty .value survives because we never rebuild).
		expect(el.querySelector("input")).toBe(inp);
		expect(inp.value).toBe("1.2");
		expect(out.textContent).toBe("1.20");
	});

	it("fires its input event; the target carries the value", () => {
		let seen = "";
		const el = RangeControl({
			id: "g",
			value: 1,
			label: "1",
			min: 0,
			max: 10,
			step: 1,
			events: {
				input: (e) => {
					seen = (e.target as HTMLInputElement).value;
				},
			},
		});
		const inp = el.querySelector("input") as HTMLInputElement;
		inp.value = "5";
		fire(inp, "input");
		expect(seen).toBe("5");
	});
});

describe("SegmentGroup — marks active, reflects data-value, fires click", () => {
	const items = [
		{ value: "a", label: "A" },
		{ value: "b", label: "B" },
	];

	it("marks the active button and reflects the group data-value", () => {
		const el = SegmentGroup({ id: "g", items, value: "a" });
		const btns = el.querySelectorAll("button");
		expect(el.getAttribute("data-value")).toBe("a");
		expect(btns[0].classList.contains("active")).toBe(true);
		expect(btns[1].classList.contains("active")).toBe(false);

		el.update({ value: "b" });
		expect(el.getAttribute("data-value")).toBe("b");
		expect(el.querySelectorAll("button")[1].classList.contains("active")).toBe(
			true,
		);
	});

	it("fires click; the clicked button is the target carrying data-value", () => {
		let seen = "";
		const el = SegmentGroup({
			id: "g",
			items,
			value: "a",
			events: {
				click: (e) => {
					seen = (e.target as HTMLElement).getAttribute("data-value") ?? "";
				},
			},
		});
		(el.querySelectorAll("button")[1] as HTMLElement).click();
		expect(seen).toBe("b");
	});

	it("owns an optional root class at its matching value (caseSize full-screen)", () => {
		const root = document.createElement("div");
		const el = SegmentGroup({
			id: "caseSize",
			items: [
				{ value: "full", label: "Full" },
				{ value: "48", label: "48mm" },
			],
			value: "full",
			root,
			rootClass: "full-screen",
			rootClassValue: "full",
		});
		expect(root.classList.contains("full-screen")).toBe(true);

		el.update({ value: "48" });
		expect(root.classList.contains("full-screen")).toBe(false);
	});
});

describe("MaterialPicker — marks active swatch, fires click", () => {
	it("marks the active swatch and fires the clicked swatch's data-material", () => {
		let seen = "";
		const el = MaterialPicker({
			materials: MATERIALS,
			value: "platinum",
			events: {
				click: (e) => {
					seen = (e.target as HTMLElement).getAttribute("data-material") ?? "";
				},
			},
		});
		const active = el.querySelector(".material-swatch.active") as HTMLElement;
		expect(active.getAttribute("data-material")).toBe("platinum");

		const gold = Array.from(
			el.querySelectorAll<HTMLElement>(".material-swatch"),
		).find((s) => s.getAttribute("data-material") === "gold") as HTMLElement;
		gold.click();
		expect(seen).toBe("gold");

		el.update({ value: "gold" });
		expect(
			(el.querySelector(".material-swatch.active") as HTMLElement).getAttribute(
				"data-material",
			),
		).toBe("gold");
	});
});

describe("ColorPicker — writes its var through the sink, fires input", () => {
	it("writes value through the sink on render, not the root directly", () => {
		const sink = recordingSink();
		ColorPicker({ value: "#112233", varName: "--mars", def: "#000000", sink });
		expect(sink.calls).toContainEqual(["--mars", "#112233"]);
	});

	it("fires its input event; the target carries the new value", () => {
		let seen = "";
		const el = ColorPicker({
			value: "#000000",
			varName: "--mars",
			def: "#000000",
			sink: recordingSink(),
			events: {
				input: (e) => {
					seen = (e.target as HTMLInputElement).value;
				},
			},
		});
		(el as unknown as HTMLInputElement).value = "#123456";
		fire(el, "input");
		expect(seen).toBe("#123456");
	});
});

describe("rootStyleSink — merges vars, flushes whole cssText once", () => {
	it("merges successive vars onto the root", () => {
		const root = document.createElement("div");
		const sink = rootStyleSink(root);
		sink.set("--mars", "#abc");
		sink.set("--sun", "#def");
		expect(root.style.getPropertyValue("--mars")).toBe("#abc");
		expect(root.style.getPropertyValue("--sun")).toBe("#def");
	});

	it("re-emits --dial-px (owned by client.ts) across a flush", () => {
		const root = document.createElement("div");
		root.style.setProperty("--dial-px", "640px");
		const sink = rootStyleSink(root);
		sink.set("--mars", "#abc");
		expect(root.style.getPropertyValue("--dial-px")).toBe("640px");
		expect(root.style.getPropertyValue("--mars")).toBe("#abc");
	});
});
