// @vitest-environment jsdom

import { afterEach, describe, expect, it } from "vitest";
import { GOING_TRAIN, MODE_TRAINS } from "../../lib/astrolabe/clockwork.ts";
import { speedToMul } from "../../lib/astrolabe/math.ts";
import { mount, resetDom } from "../test-dom.ts";
import { DEFAULTS } from "./controls-components.ts";
import { buildStage } from "./stage.ts";

afterEach(resetDom);

describe("astrolabe clockwork rear face", () => {
	it("keeps the dial as the front face and renders the active rear gear train", () => {
		const stage = buildStage();

		mount(stage.root);

		expect(document.getElementById("dial")).toBe(stage.dial);
		const caseback = document.getElementById("caseback");
		expect(caseback).not.toBeNull();
		expect(caseback?.getAttribute("aria-label")).toBe(
			"Astrolabe rear clockwork",
		);
		expect(MODE_TRAINS.map(({ id }) => id)).toEqual([
			"ptolemaic",
			"galilean",
			"keplerian",
		]);

		for (const row of GOING_TRAIN) {
			const renderedRow = caseback?.querySelector(`[data-wheel="${row.id}"]`);
			expect(renderedRow, `${row.wheel} should be listed`).not.toBeNull();
		}
		expect(caseback?.textContent).toContain("18,000 BPH");

		const visibleTrains = () =>
			Array.from(caseback?.querySelectorAll("[data-motion-train]") ?? []).map(
				(node) => node.getAttribute("data-motion-train"),
			);

		expect(visibleTrains()).toEqual(["galilean"]);
		expect(caseback?.textContent).toContain("Galilean");
		expect(caseback?.textContent).not.toContain("Ptolemaic");
		expect(caseback?.textContent).not.toContain("Keplerian");

		stage.root.update({
			state: { ...DEFAULTS, earthMode: "keplerian", speedStep: 3 },
		});

		expect(visibleTrains()).toEqual(["keplerian"]);
		expect(caseback?.textContent).toContain("Keplerian");
		expect(caseback?.textContent).not.toContain("Galilean");
		expect(caseback?.getAttribute("data-speed")).toBe(String(speedToMul(3)));

		for (const train of MODE_TRAINS) {
			const orbitalRows = train.rows.filter((row) => row.kind === "orbital");
			const arbors = orbitalRows.map((row) => row.arbor);
			expect(new Set(arbors).size).toBe(arbors.length);
		}

		const galilean = MODE_TRAINS.find((train) => train.id === "galilean");
		expect(
			galilean?.rows.find((row) => row.disk === "Mars")?.relativeRate,
		).toBeLessThan(0);

		const flip = document.getElementById("flipCase");
		expect(flip).not.toBeNull();
		expect(flip?.getAttribute("aria-pressed")).toBe("false");

		flip?.dispatchEvent(new MouseEvent("click", { bubbles: true }));

		expect(stage.root.classList.contains("case-flipped")).toBe(true);
		expect(flip?.getAttribute("aria-pressed")).toBe("true");
		expect(caseback?.getAttribute("data-flipped")).toBe("true");
		expect(caseback?.getAttribute("style")).toContain("--gear-duration");
		expect(caseback?.querySelectorAll(".clock-gear")).toHaveLength(
			GOING_TRAIN.length,
		);
	});
});
