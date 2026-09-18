// A hand-written, line-oriented parser for the `traceDiagram` syntax.
//
// Mermaid recommends Chevrotain for diagrams that live in its own tree, where a
// shared build regenerates grammars. An out-of-tree plugin owes mermaid only a
// `parse(text)` that drives the db and throws errors carrying a position, and
// this syntax is line-oriented enough that a generator would add a dependency
// without buying structure.

import {
	type Frame,
	type HeapObject,
	type Row,
	type RowKind,
	type TraceModel,
	TraceSyntaxError,
	type TraceValue,
} from "./model.ts";

const HEADER = "traceDiagram";

// CSS Color 4's 148 named colours plus the separately defined transparent
// keyword. Keeping this list local makes parsing deterministic in Node and the
// browser rather than depending on a particular CSS engine's acceptance.
const CSS_NAMED_COLORS = new Set(
	`aliceblue antiquewhite aqua aquamarine azure beige bisque black blanchedalmond blue blueviolet brown burlywood cadetblue chartreuse chocolate coral cornflowerblue cornsilk crimson cyan
	darkblue darkcyan darkgoldenrod darkgray darkgreen darkgrey darkkhaki darkmagenta darkolivegreen darkorange darkorchid darkred darksalmon darkseagreen darkslateblue darkslategray darkslategrey darkturquoise darkviolet deeppink deepskyblue dimgray dimgrey dodgerblue
	firebrick floralwhite forestgreen fuchsia gainsboro ghostwhite gold goldenrod gray green greenyellow grey honeydew hotpink indianred indigo ivory khaki lavender lavenderblush lawngreen lemonchiffon
	lightblue lightcoral lightcyan lightgoldenrodyellow lightgray lightgreen lightgrey lightpink lightsalmon lightseagreen lightskyblue lightslategray lightslategrey lightsteelblue lightyellow lime limegreen linen
	magenta maroon mediumaquamarine mediumblue mediumorchid mediumpurple mediumseagreen mediumslateblue mediumspringgreen mediumturquoise mediumvioletred midnightblue mintcream mistyrose moccasin navajowhite navy
	oldlace olive olivedrab orange orangered orchid palegoldenrod palegreen paleturquoise palevioletred papayawhip peachpuff peru pink plum powderblue purple rebeccapurple red rosybrown royalblue
	saddlebrown salmon sandybrown seagreen seashell sienna silver skyblue slateblue slategray slategrey snow springgreen steelblue tan teal thistle tomato transparent turquoise violet wheat white whitesmoke yellow yellowgreen`.split(
		/\s+/,
	),
);

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{4}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

/** An open `frame`/`scope`, remembered so an unclosed block can name its line. */
interface OpenFrame {
	frame: Frame;
	line: number;
}

/**
 * Splits a value list on commas that are not inside a `~...~` strike marker, so
 * `~a, b~` stays one value.
 */
function splitValues(source: string): string[] {
	const parts: string[] = [];
	let current = "";
	let struck = false;
	for (const ch of source) {
		if (ch === "~") {
			struck = !struck;
			current += ch;
		} else if (ch === "," && !struck) {
			parts.push(current);
			current = "";
		} else {
			current += ch;
		}
	}
	parts.push(current);
	return parts.map((p) => p.trim()).filter((p) => p.length > 0);
}

/**
 * Builds a row's values. Every value but the last is superseded, so it is
 * struck; the last is struck only when the author wrote it as `~value~`.
 */
function parseValues(source: string): TraceValue[] {
	const raw = splitValues(source);
	return raw.map((text, index): TraceValue => {
		const forced =
			text.startsWith("~") && text.endsWith("~") && text.length > 1;
		const bare = forced ? text.slice(1, -1).trim() : text;
		const struck = forced || index < raw.length - 1;
		if (bare.startsWith("@")) {
			return { text: bare.slice(1), struck, pointsTo: bare.slice(1) };
		}
		const stackReference = bare.match(/^&([A-Za-z_][A-Za-z0-9_]*)$/);
		return stackReference
			? { text: bare, struck, pointsToStack: stackReference[1] }
			: { text: bare, struck };
	});
}

/** Every row reachable from a frame, including its nested frames' rows. */
function allRows(frames: Frame[]): Row[] {
	return frames.flatMap((frame) => [...frame.rows, ...allRows(frame.frames)]);
}

export function parseTrace(text: string): TraceModel {
	const lines = text.split("\n");
	const model: TraceModel = { frames: [], heap: [] };
	const stack: OpenFrame[] = [];
	let heap: HeapObject | undefined;

	const fail = (message: string, index: number, column = 1): never => {
		throw new TraceSyntaxError(message, index + 1, column);
	};

	let index = 0;
	// Skip leading blanks, then require the header.
	while (index < lines.length && lines[index].trim() === "") index++;
	if (index >= lines.length || lines[index].trim() !== HEADER) {
		fail(`A trace diagram must start with \`${HEADER}\``, index);
	}
	index++;

	for (; index < lines.length; index++) {
		const rawLine = lines[index];

		const line = rawLine.replace(/%%.*$/, "").trim();
		if (line === "") continue;
		const column = rawLine.indexOf(line.charAt(0)) + 1;

		// Inside a heap object, fields are `name: value` or `name -> id`.
		if (heap) {
			if (line === "end") {
				model.heap.push(heap);
				heap = undefined;
				continue;
			}
			const pointer = line.match(/^([^\s:]+)\s*->\s*(\S+)$/);
			if (pointer) {
				heap.fields.push({
					name: pointer[1],
					values: [],
					pointsTo: pointer[2],
				});
				continue;
			}
			const field = line.match(/^([^:]+):\s*(.*)$/);
			if (field) {
				const name = field[1].trim();
				const value = field[2].trim();
				if (name === "color") {
					// Constrained to a literal CSS colour: the value reaches an inline
					// fill declaration, so contextual and functional values stay excluded.
					if (
						!CSS_NAMED_COLORS.has(value.toLowerCase()) &&
						!HEX_COLOR.test(value)
					) {
						fail(
							`\`color\` must be a CSS named colour or 3, 4, 6, or 8-digit hex, not \`${value}\``,
							index,
							column,
						);
					}
					heap.color = value;
					continue;
				}
				const values = parseValues(value);
				if (values.some(({ pointsTo }) => pointsTo)) {
					fail(
						`Heap field \`${name}\` cannot use pointer values in \`name: values\` form; use \`${name} -> target\``,
						index,
						column,
					);
				}
				heap.fields.push({ name, values });
				continue;
			}
			fail(`Unknown heap field \`${line}\``, index, column);
		}

		const open = stack.at(-1)?.frame;

		if (line === "end") {
			if (stack.length === 0) fail("`end` closes nothing", index, column);
			stack.pop();
			continue;
		}

		if (line === "done") {
			if (!open) fail("`done` outside a frame or scope", index, column);
			else open.done = true;
			continue;
		}

		const title = line.match(/^title\s+(.+)$/);
		if (title) {
			model.title = title[1].trim();
			continue;
		}

		const block = line.match(/^(frame|scope)(?:\s+(.+))?$/);
		if (block) {
			const frame: Frame = {
				kind: block[1] as Frame["kind"],
				label: block[2]?.trim() ?? "",
				done: false,
				rows: [],
				frames: [],
			};
			if (open) open.frames.push(frame);
			else model.frames.push(frame);
			stack.push({ frame, line: index + 1 });
			continue;
		}

		const object = line.match(/^heap\s+(\S+)(?:\s+(\S+))?$/);
		if (object) {
			heap = {
				id: object[1],
				...(object[2] ? { address: object[2] } : {}),
				fields: [],
			};
			continue;
		}

		const ret = line.match(/^ret\s+(.+?)(?:\s*->\s*(\S+))?$/);
		if (ret) {
			if (!open) fail("`ret` outside a frame", index, column);
			else
				open.rows.push({
					kind: "ret",
					name: "ret",
					values: parseValues(ret[1]),
					...(ret[2] ? { returnsTo: ret[2] } : {}),
				});
			continue;
		}

		const explicitRow = line.match(/^(row|watch)\s+([^:]+):(.*)$/);
		if (explicitRow) {
			const kind = explicitRow[1] as RowKind;
			if (!open) fail(`\`${kind}\` outside a frame or scope`, index, column);
			else
				open.rows.push({
					kind,
					name: explicitRow[2].trim(),
					values: parseValues(explicitRow[3]),
				});
			continue;
		}

		// Ordinary frame rows need no keyword. Keep `row name: values` above as
		// a compatibility alias; `watch` remains explicit because it changes the
		// row's meaning and presentation.
		const implicitRow = line.match(/^([^:]+):(.*)$/);
		if (implicitRow) {
			const name = implicitRow[1].trim();
			if (!open) {
				fail(
					`Implicit row \`${name}\` must be inside a frame or scope`,
					index,
					column,
				);
			} else {
				open.rows.push({
					kind: "row",
					name,
					values: parseValues(implicitRow[2]),
				});
			}
			continue;
		}

		fail(`Unknown statement \`${line}\``, index, column);
	}

	if (heap) fail("Unclosed `heap` block", lines.length - 1);
	const unclosed = stack.at(-1);
	if (unclosed) {
		throw new TraceSyntaxError(
			`Unclosed \`${unclosed.frame.kind}\` opened here`,
			unclosed.line,
			1,
		);
	}

	// Heap pointers must name declared objects, stack pointers must name rows
	// above them, and return arrows must name rows, so every relation can render.
	const declared = new Set(model.heap.map((o) => o.id));
	for (const object of model.heap) {
		for (const field of object.fields) {
			if (field.pointsTo && !declared.has(field.pointsTo)) {
				throw new TraceSyntaxError(
					`Heap field \`${field.name}\` points at undeclared object \`${field.pointsTo}\``,
					1,
					1,
				);
			}
		}
	}
	const rows = allRows(model.frames);
	const precedingRows: Row[] = [];
	for (const rowEntry of rows) {
		for (const value of rowEntry.values) {
			if (value.pointsTo && !declared.has(value.pointsTo)) {
				throw new TraceSyntaxError(
					`Row \`${rowEntry.name}\` points at undeclared heap object \`${value.pointsTo}\``,
					1,
					1,
				);
			}
			if (
				value.pointsToStack &&
				!precedingRows.some(
					(candidate) => candidate.name === value.pointsToStack,
				)
			) {
				throw new TraceSyntaxError(
					`Row \`${rowEntry.name}\` points at stack row \`${value.pointsToStack}\` that is not declared above it`,
					1,
					1,
				);
			}
		}
		if (
			rowEntry.returnsTo &&
			!rows.some((r) => r.name === rowEntry.returnsTo)
		) {
			throw new TraceSyntaxError(
				`\`ret\` returns to unknown row \`${rowEntry.returnsTo}\``,
				1,
				1,
			);
		}
		precedingRows.push(rowEntry);
	}

	return model;
}
