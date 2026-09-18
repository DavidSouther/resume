import { describe, expect, it } from "vitest";
import { TraceSyntaxError } from "./model.ts";
import { parseTrace } from "./parse.ts";
import { resolveSteps, resolveStepsFromSource } from "./steps.ts";

/** The seventh figure of the Rust tracing post: a callee written above its caller. */
const BUILD_ART = [
	"traceDiagram",
	"  title Static check of a returned local reference",
	"  steps 9 10 0 1 2 3 11",
	"  frame main @9",
	"    my_art: @10",
	"    frame build_art @0",
	"      art: Artwork Liberty @1",
	"      ret &art -> my_art @2",
	"      watch return: rejected @2",
	"      done @3",
	"    end",
	"  end",
].join("\n");

describe("resolveSteps", () => {
	it("an explicit sequence orders a callee before the lines above it", () => {
		const model = parseTrace(BUILD_ART);

		const sequence = resolveSteps(model);

		expect(sequence).toEqual([9, 10, 0, 1, 2, 3, 11]);
		const main = model.frames[0];
		const build = main.frames[0];
		expect(main.step).toBe(1);
		expect(main.rows[0].step).toBe(2);
		expect(build.step).toBe(3);
		expect(build.rows[0].values[0].step).toBe(4);
		expect(build.doneAt?.step).toBe(6);
	});

	it("leaves an untagged diagram untimed and returns an empty sequence", () => {
		const model = parseTrace(
			"traceDiagram\n  frame main\n    a: 7\n    done\n  end",
		);

		const sequence = resolveSteps(model);

		expect(sequence).toEqual([]);
		expect(model.frames[0].step).toBeUndefined();
		expect(model.frames[0].rows[0].step).toBeUndefined();
		expect(model.frames[0].rows[0].values[0].step).toBeUndefined();
		expect(model.frames[0].doneAt?.step).toBeUndefined();
	});

	it("defaults the sequence to the ascending unique tagged lines", () => {
		const model = parseTrace(
			[
				"traceDiagram",
				"  frame main @0",
				"    a: 7 @2",
				"    b: 8 @1",
				"    done @2",
				"  end",
			].join("\n"),
		);

		const sequence = resolveSteps(model);

		expect(sequence).toEqual([0, 1, 2]);
		const main = model.frames[0];
		expect(main.step).toBe(1);
		expect(main.rows[0].values[0].step).toBe(3);
		expect(main.rows[1].values[0].step).toBe(2);
		expect(main.doneAt?.step).toBe(3);
	});

	it("gives one step to two nodes that carry the same unrepeated tag", () => {
		const model = parseTrace(
			"traceDiagram\n  frame main @0\n    a: 1 @1\n    b: 2 @1\n  end",
		);

		resolveSteps(model);

		expect(model.frames[0].rows[0].values[0].step).toBe(2);
		expect(model.frames[0].rows[1].values[0].step).toBe(2);
	});

	it("gives successive occurrences of a repeated line to successive statements", () => {
		const model = parseTrace(
			[
				"traceDiagram",
				"  steps 4 5 6 5",
				"  heap blue @5",
				"  end",
				"  frame f @4",
				"    done @5",
				"  end",
			].join("\n"),
		);

		resolveSteps(model);

		expect(model.heap[0].step).toBe(2);
		expect(model.frames[0].step).toBe(1);
		expect(model.frames[0].doneAt?.step).toBe(4);
	});

	it("clamps a surplus tag to the last occurrence rather than throwing", () => {
		const model = parseTrace(
			[
				"traceDiagram",
				"  steps 5 5",
				"  frame f @5",
				"    a: 1 @5",
				"    done @5",
				"  end",
			].join("\n"),
		);

		resolveSteps(model);

		expect(model.frames[0].step).toBe(1);
		expect(model.frames[0].rows[0].values[0].step).toBe(2);
		expect(model.frames[0].doneAt?.step).toBe(2);
	});

	it("gives an untagged node the step of the nearest preceding tagged node", () => {
		const model = parseTrace(
			[
				"traceDiagram",
				"  heap blue @1",
				"    value: 2",
				"  end",
				"  frame f @0",
				"    a: 7",
				"  end",
			].join("\n"),
		);

		resolveSteps(model);

		expect(model.heap[0].step).toBe(2);
		expect(model.heap[0].fields[0].step).toBe(2);
		expect(model.heap[0].fields[0].values[0].step).toBe(2);
		expect(model.frames[0].step).toBe(1);
		expect(model.frames[0].rows[0].step).toBe(1);
		expect(model.frames[0].rows[0].values[0].step).toBe(1);
	});

	it("rejects a tag the explicit sequence never executes, naming its line", () => {
		const model = parseTrace(
			"traceDiagram\n  steps 0 1\n  frame f @0\n    a: 1 @7\n  end",
		);

		expect(() => resolveSteps(model)).toThrowError(TraceSyntaxError);
		expect(() => resolveSteps(model)).toThrowError(/`@7`.*line 4/);
	});
});

describe("resolveStepsFromSource", () => {
	it("parses and resolves in one pass, for the build-time figure writer", () => {
		expect(resolveStepsFromSource(BUILD_ART)).toEqual([9, 10, 0, 1, 2, 3, 11]);
	});

	it("returns an empty sequence for an untimed diagram", () => {
		expect(
			resolveStepsFromSource("traceDiagram\n  frame main\n    a: 7\n  end"),
		).toEqual([]);
	});
});
