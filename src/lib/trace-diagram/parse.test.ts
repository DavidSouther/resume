import { describe, expect, it } from "vitest";
import { TraceDb } from "./db.ts";
import { TraceSyntaxError } from "./model.ts";
import { parseTrace } from "./parse.ts";

const struck = (values: { struck: boolean }[]) => values.map((v) => v.struck);

describe("parseTrace", () => {
	it("parses an implicit frame row and strikes superseded values", () => {
		const model = parseTrace(
			["traceDiagram", "  frame gcd", "    a: 1071, 609, 21", "  end"].join(
				"\n",
			),
		);

		expect(model.frames[0].kind).toBe("frame");
		expect(model.frames[0].label).toBe("gcd");
		expect(model.frames[0].rows[0].name).toBe("a");
		expect(struck(model.frames[0].rows[0].values)).toEqual([true, true, false]);
	});

	it("keeps explicit `row` as a compatibility alias", () => {
		const model = parseTrace(
			"traceDiagram\n  frame f\n    row value: 1\n  end",
		);

		expect(model.frames[0].rows[0]).toMatchObject({
			kind: "row",
			name: "value",
		});
	});

	it("reports an implicit row outside a frame with its name and location", () => {
		expect(() => parseTrace("traceDiagram\n  value: 1\n")).toThrowError(
			/Implicit row `value` must be inside a frame or scope.*line 2/,
		);
	});

	it("reports an unknown statement with its line number", () => {
		expect(() => parseTrace("traceDiagram\n  frobnicate wat\n")).toThrowError(
			TraceSyntaxError,
		);
		expect(() => parseTrace("traceDiagram\n  frobnicate wat\n")).toThrowError(
			/line 2/,
		);
	});

	it("rejects text that does not open with the header", () => {
		expect(() => parseTrace("flowchart TD\n")).toThrowError(/traceDiagram/);
	});

	it("keeps a comma inside a strike marker as one value", () => {
		const model = parseTrace(
			"traceDiagram\n  frame f\n    row a: ~[1, 2]~, [3]\n  end",
		);

		const values = model.frames[0].rows[0].values;
		expect(values.map((v) => v.text)).toEqual(["[1, 2]", "[3]"]);
		expect(struck(values)).toEqual([true, false]);
	});

	it("strikes a final value the author marked with ~", () => {
		const model = parseTrace(
			"traceDiagram\n  frame f\n    row a: 1, ~2~\n  end",
		);

		expect(struck(model.frames[0].rows[0].values)).toEqual([true, true]);
	});

	it("reads `ret` with and without a return target", () => {
		const model = parseTrace(
			[
				"traceDiagram",
				"  frame outer",
				"    ret 21",
				"    frame inner",
				"      ret 21 -> ret",
				"      done",
				"    end",
				"  end",
			].join("\n"),
		);

		expect(model.frames[0].rows[0].returnsTo).toBeUndefined();
		const inner = model.frames[0].frames[0];
		expect(inner.rows[0].returnsTo).toBe("ret");
		expect(inner.done).toBe(true);
	});

	it("resolves a Rust-like returned reference to a stack row", () => {
		const model = parseTrace(
			[
				"traceDiagram",
				"  frame main",
				"    my_art:",
				"    frame build_art",
				"      art: Artwork Liberty",
				"      ret &art -> my_art",
				"    end",
				"  end",
			].join("\n"),
		);

		const returned = model.frames[0].frames[0].rows[1].values[0];
		expect(returned).toMatchObject({ text: "&art", pointsToStack: "art" });
	});

	it("keeps address-like references as textual values", () => {
		const model = parseTrace(
			"traceDiagram\n  frame f\n    borrowed: &0x20\n  end",
		);

		// Exact equality, so a new value field must be added here deliberately.
		// The frame takes order 0, its row order 1, and this value order 2.
		expect(model.frames[0].rows[0].values[0]).toEqual({
			text: "&0x20",
			struck: false,
			order: 2,
			sourceLine: 3,
		});
	});

	it("rejects a reference to an undeclared stack row", () => {
		expect(() =>
			parseTrace("traceDiagram\n  frame f\n    ret &missing\n  end"),
		).toThrowError(/stack row `missing` that is not declared above it/);
	});

	it("rejects a forward reference to a stack row", () => {
		expect(() =>
			parseTrace(
				"traceDiagram\n  frame f\n    ret &later\n    later: value\n  end",
			),
		).toThrowError(/stack row `later` that is not declared above it/);
	});

	it("accepts duplicate stack-row names when one precedes the reference", () => {
		const model = parseTrace(
			"traceDiagram\n  frame f\n    value: first\n    value: second\n    ret &value\n  end",
		);

		expect(model.frames[0].rows[2].values[0]).toMatchObject({
			pointsToStack: "value",
		});
	});

	it("reads heap objects with addresses, fields, and pointer fields", () => {
		const model = parseTrace(
			[
				"traceDiagram",
				"  heap blue 0x10",
				"    value: 2, 3",
				"    next -> gold",
				"  end",
				"  heap gold 0x20",
				"    value: 4",
				"  end",
				"  frame f",
				"    row head: @blue",
				"  end",
			].join("\n"),
		);

		expect(model.heap[0]).toMatchObject({ id: "blue", address: "0x10" });
		expect(model.heap[0].fields[0]).toMatchObject({
			name: "value",
			values: [
				{ text: "2", struck: true },
				{ text: "3", struck: false },
			],
		});
		expect(model.heap[0].fields[1]).toMatchObject({
			name: "next",
			values: [],
			pointsTo: "gold",
		});
		expect(model.frames[0].rows[0].values[0]).toMatchObject({
			text: "blue",
			pointsTo: "blue",
		});
	});

	it.each([
		"CornflowerBlue",
		"transparent",
		"#123",
		"#123A",
		"#123aBc",
		"#1234AbCd",
	])("accepts the literal heap colour %s", (color) => {
		const model = parseTrace(
			`traceDiagram\n  heap cell\n    color: ${color}\n  end`,
		);

		expect(model.heap[0].color).toBe(color);
	});

	it.each([
		"nonsense",
		"#12345",
		"#1234567",
	])("rejects the unsupported heap colour %s with its source line", (color) => {
		expect(() =>
			parseTrace(`traceDiagram\n  heap cell\n    color: ${color}\n  end`),
		).toThrowError(
			/`color` must be a CSS named colour or 3, 4, 6, or 8-digit hex.*line 3/,
		);
	});

	it("requires heap pointers to use the arrow form", () => {
		const declared = [
			"traceDiagram",
			"  heap blue",
			"    next: @gold",
			"  end",
			"  heap gold",
			"  end",
		].join("\n");
		const undeclared = [
			"traceDiagram",
			"  heap blue",
			"    next: @ghost, @gold",
			"  end",
		].join("\n");

		expect(() => parseTrace(declared)).toThrowError(
			/Heap field `next` cannot use pointer values.*use `next -> target`.*line 3/,
		);
		expect(() => parseTrace(undeclared)).toThrowError(
			/Heap field `next` cannot use pointer values.*use `next -> target`.*line 3/,
		);
	});

	it("marks a scope distinctly from a frame", () => {
		const model = parseTrace(
			"traceDiagram\n  frame f\n    scope block\n      row t: 3\n      done\n    end\n  end",
		);

		expect(model.frames[0].frames[0].kind).toBe("scope");
	});

	it("keeps a watch row's expression as its name", () => {
		const model = parseTrace(
			"traceDiagram\n  frame f\n    watch arg.list[2]: 7\n  end",
		);

		expect(model.frames[0].rows[0].kind).toBe("watch");
		expect(model.frames[0].rows[0].name).toBe("arg.list[2]");
	});

	it("requires the explicit `watch` marker for watch rows", () => {
		const model = parseTrace(
			"traceDiagram\n  frame f\n    arg.list[2]: 7\n    watch arg.list[3]: 8\n  end",
		);

		expect(model.frames[0].rows.map(({ kind }) => kind)).toEqual([
			"row",
			"watch",
		]);
	});

	it("rejects a pointer to an undeclared heap object", () => {
		expect(() =>
			parseTrace("traceDiagram\n  frame f\n    row a: @ghost\n  end"),
		).toThrowError(/undeclared heap object/);
	});

	it("rejects an unclosed frame, naming the line that opened it", () => {
		expect(() =>
			parseTrace("traceDiagram\n\n  frame f\n    row a: 1\n"),
		).toThrowError(/line 3/);
	});

	it("rejects `done` outside a frame", () => {
		expect(() => parseTrace("traceDiagram\n  done\n")).toThrowError(
			/outside a frame/,
		);
	});

	it("ignores comments and blank lines", () => {
		const model = parseTrace(
			"traceDiagram\n\n  %% a note\n  frame f %% trailing\n    row a: 1\n  end",
		);

		expect(model.frames[0].label).toBe("f");
	});
});

describe("parseTrace timing notation", () => {
	it("a tag times the value it trails", () => {
		const model = parseTrace(
			"traceDiagram\n frame main @0\n  art: 7 @1\n  done @2\n end\n",
		);

		expect(model.frames[0].tag).toBe(0);
		expect(model.frames[0].rows[0].values[0].tag).toBe(1);
		expect(model.frames[0].rows[0].tag).toBeUndefined();
		expect(model.frames[0].doneAt?.tag).toBe(2);
	});

	it("gives an empty value list's tag to the row itself", () => {
		const model = parseTrace(
			"traceDiagram\n  frame main\n    my_art: @10\n  end",
		);

		expect(model.frames[0].rows[0].values).toEqual([]);
		expect(model.frames[0].rows[0].tag).toBe(10);
	});

	it("keeps a `ret` arrow target when a tag trails it", () => {
		const model = parseTrace(
			[
				"traceDiagram",
				"  frame main",
				"    my_art: @10",
				"    frame build_art @0",
				"      art: Artwork Liberty @1",
				"      ret &art -> my_art @2",
				"    end",
				"  end",
			].join("\n"),
		);

		const ret = model.frames[0].frames[0].rows[1];
		expect(ret.returnsTo).toBe("my_art");
		expect(ret.values[0]).toMatchObject({
			text: "&art",
			pointsToStack: "art",
			tag: 2,
		});
	});

	it("reads a heap pointer value and its step tag as separate tokens", () => {
		const model = parseTrace(
			[
				"traceDiagram",
				"  heap artwork 0x08 @1",
				"    name: Owain",
				"  end",
				"  frame main @0",
				"    art: @artwork @1",
				"  end",
			].join("\n"),
		);

		expect(model.heap[0]).toMatchObject({ address: "0x08", tag: 1 });
		expect(model.heap[0].fields[0].tag).toBeUndefined();
		expect(model.frames[0].rows[0].values[0]).toMatchObject({
			text: "artwork",
			pointsTo: "artwork",
			tag: 1,
		});
	});

	it("tags each value of a list independently", () => {
		const model = parseTrace(
			"traceDiagram\n  frame gcd\n    a: 1071 @5, 609 @6\n  end",
		);

		const values = model.frames[0].rows[0].values;
		expect(values.map((v) => v.text)).toEqual(["1071", "609"]);
		expect(values.map((v) => v.tag)).toEqual([5, 6]);
	});

	it("reads a `steps` statement as the declared execution order", () => {
		const model = parseTrace(
			"traceDiagram\n  steps 9 10 0 1 2 3 11\n  frame main @9\n  end",
		);

		expect(model.declaredSteps).toEqual([9, 10, 0, 1, 2, 3, 11]);
	});

	it("rejects a second `steps` statement with its line", () => {
		expect(() =>
			parseTrace("traceDiagram\n  steps 0 1\n  steps 2 3\n"),
		).toThrowError(/one `steps` statement.*line 3/);
	});

	it("rejects a `steps` statement after the first block, with its line", () => {
		expect(() =>
			parseTrace("traceDiagram\n  frame main\n  end\n  steps 0 1\n"),
		).toThrowError(/`steps` must come before.*line 4/);
	});

	it("leaves an untagged diagram untimed", () => {
		const model = parseTrace(
			[
				"traceDiagram",
				"  heap blue 0x10",
				"    value: 2, 3",
				"  end",
				"  frame f",
				"    a: 1, 2",
				"    done",
				"  end",
			].join("\n"),
		);

		expect(model.declaredSteps).toBeUndefined();
		expect(model.heap[0].tag).toBeUndefined();
		expect(model.heap[0].fields[0].values.map((v) => v.tag)).toEqual([
			undefined,
			undefined,
		]);
		expect(model.frames[0].tag).toBeUndefined();
		expect(model.frames[0].doneAt?.tag).toBeUndefined();
		expect(model.frames[0].rows[0].values.map((v) => v.tag)).toEqual([
			undefined,
			undefined,
		]);
	});

	it("numbers every timed node in document order across heap and frames", () => {
		const model = parseTrace(
			[
				"traceDiagram",
				"  heap blue",
				"    value: 2",
				"  end",
				"  frame f",
				"    a: 1",
				"    done",
				"  end",
			].join("\n"),
		);

		expect(model.heap[0].order).toBe(0);
		expect(model.heap[0].fields[0].order).toBe(1);
		expect(model.heap[0].fields[0].values[0].order).toBe(2);
		expect(model.frames[0].order).toBe(3);
		expect(model.frames[0].rows[0].order).toBe(4);
		expect(model.frames[0].rows[0].values[0].order).toBe(5);
		expect(model.frames[0].doneAt?.order).toBe(6);
	});
});

describe("TraceDb", () => {
	it("holds the model and the common accessors, and clears them", () => {
		const db = new TraceDb();
		db.setModel(parseTrace("traceDiagram\n  title Tracing gcd\n"));

		expect(db.getDiagramTitle()).toBe("Tracing gcd");
		db.setAccDescription("a memory trace");
		expect(db.getAccDescription()).toBe("a memory trace");

		db.clear();
		expect(db.getDiagramTitle()).toBe("");
		expect(db.getModel().frames).toEqual([]);
	});
});
