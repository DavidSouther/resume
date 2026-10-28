import { describe, expect, it } from "vitest";
import { loadContent } from "./content.ts";
import { narrate } from "./narrate.ts";
import { buildKeyframes, planTransition } from "./plan.ts";
import { loadStages } from "./staffing.ts";

const stages = loadStages();

describe("planTransition", () => {
	it("accounts for every previous cell as moved or dropped", () => {
		for (let i = 1; i < stages.length; i++) {
			const plan = planTransition(stages[i - 1], stages[i]);
			const moved = new Set(plan.moves.map((m) => m.from));
			const all = stages[i - 1].tables.flatMap((t) =>
				t.rows.flat().map((c) => c.id),
			);
			for (const id of all)
				expect(moved.has(id) || plan.dropped.includes(id)).toBe(true);
		}
	});

	it("marks exactly one survivor per derived cell", () => {
		const plan = planTransition(stages[1], stages[2]);
		const survivors = new Map<string, number>();
		for (const m of plan.moves)
			if (m.survivor) survivors.set(m.to, (survivors.get(m.to) ?? 0) + 1);
		expect([...survivors.values()].every((n) => n === 1)).toBe(true);
	});

	it("merges duplicate department names into one cell at 3NF", () => {
		const plan = planTransition(stages[2], stages[3]);
		const dept = stages[3].tables.find((t) => t.name === "Departments");
		const target = dept?.rows[0][1].id ?? "";
		expect(plan.moves.filter((m) => m.to === target).length).toBeGreaterThan(1);
	});

	it("drops Eli's null project cells at 2NF", () => {
		const plan = planTransition(stages[1], stages[2]);
		expect(plan.dropped.length).toBeGreaterThan(0);
	});
});

describe("buildKeyframes", () => {
	it("makes eleven keyframes alternating violates and settled", () => {
		const frames = buildKeyframes(stages);
		expect(frames).toHaveLength(11);
		expect(frames.map((f) => f.kind)).toEqual([
			"settled",
			"violates",
			"settled",
			"violates",
			"settled",
			"violates",
			"settled",
			"violates",
			"settled",
			"violates",
			"settled",
		]);
		expect(frames.map((f) => f.stage)).toEqual([
			0, 0, 1, 1, 2, 2, 3, 3, 4, 4, 5,
		]);
	});
});

describe("narrate", () => {
	const frames = buildKeyframes(stages);

	it("takes title and filled prose from content.md in keyframe order", () => {
		const text = narrate(stages, frames, loadContent());
		expect(text.map((n) => n.id)).toEqual(frames.map((f) => f.id));
		expect(text[1].title).toBe("Toward 1NF");
		expect(text[1].text).toContain("projects, skills, languages");
		expect(text[2].text).toMatch(/Row counts: Staffing \d+/);
		expect(text.some((n) => n.text.includes("{{"))).toBe(false);
	});

	it("rejects content whose steps do not match the keyframes", () => {
		const content = loadContent();
		content.steps.pop();
		expect(() => narrate(stages, frames, content)).toThrow(/post-settled/);
	});
});
