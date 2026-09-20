// A hand-written, line-oriented parser for the `traceDiagram` syntax.
//
// Mermaid recommends Chevrotain, but an out-of-tree plugin owes it only a
// `parse(text)` that drives the db and throws positioned errors. This syntax
// is line-oriented enough that a generator would buy no structure.

import {
	type Frame,
	type HeapObject,
	type Row,
	type RowKind,
	type Timed,
	type TraceModel,
	TraceSyntaxError,
	type TraceValue,
} from "./model.ts";

/**
 * Stamps a node with its document position and its diagram source line. `at` is
 * the 0-based index of the line in the diagram text.
 */
type Mint = (at: number, tag?: Tag) => Timed;

/** A peeled `@<line>` with the optional `#<occurrence>` that qualifies it. */
interface Tag {
	line: number;
	occurrence?: number;
}

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
 * A trailing step tag: `@` followed by digits only, optionally qualified by
 * `#<digits>` naming which execution of that line is meant. A heap pointer is
 * `@id` with a non-numeric id, so the two never collide — which is why a heap
 * object id may not be all digits.
 */
const TRAILING_TAG = /\s*@(\d+)(?:#(\d+))?$/;

/**
 * Peels one trailing `@<digits>[#<digits>]` off a statement or a value token.
 * Peeling before dispatch keeps every statement regex unchanged; `ret &art ->
 * my_art` in particular keeps its arrow target, which a tag-aware `ret` regex
 * loses.
 */
function peelTrailingTag(source: string): { text: string; tag?: Tag } {
	const match = source.match(TRAILING_TAG);
	if (!match || match.index === undefined) return { text: source };
	return {
		text: source.slice(0, match.index).trim(),
		tag: {
			line: Number(match[1]),
			...(match[2] === undefined ? {} : { occurrence: Number(match[2]) }),
		},
	};
}

/**
 * Gives a statement's peeled tag to the last value it declares, or to the
 * statement itself when it declares none. `my_art: @10` is a row tag;
 * `art: @artwork @1` is a value tag.
 */
function applyTrailingTag(
	node: Timed,
	values: TraceValue[],
	tag: Tag | undefined,
): void {
	if (tag === undefined) return;
	const target = values.at(-1) ?? node;
	target.tag = tag.line;
	if (tag.occurrence !== undefined) target.occurrence = tag.occurrence;
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
function parseValues(source: string, line: number, mint: Mint): TraceValue[] {
	const raw = splitValues(source);
	return raw.map((token, index): TraceValue => {
		const { text, tag } = peelTrailingTag(token);
		const timed = mint(line, tag);
		const forced =
			text.startsWith("~") && text.endsWith("~") && text.length > 1;
		const bare = forced ? text.slice(1, -1).trim() : text;
		const struck = forced || index < raw.length - 1;
		if (bare.startsWith("@")) {
			return {
				...timed,
				text: bare.slice(1),
				struck,
				pointsTo: bare.slice(1),
			};
		}
		const stackReference = bare.match(/^&([A-Za-z_][A-Za-z0-9_]*)$/);
		return stackReference
			? { ...timed, text: bare, struck, pointsToStack: stackReference[1] }
			: { ...timed, text: bare, struck };
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
	/** Set once a `frame`, `scope`, or `heap` opens, which closes `steps`. */
	let blockSeen = false;

	const fail = (message: string, index: number, column = 1): never => {
		throw new TraceSyntaxError(message, index + 1, column);
	};

	// True document order across heap blocks and frames exists only here, as the
	// parser walks. Every timed node takes the next ordinal as it is built.
	let order = 0;
	const mint: Mint = (at, tag) => ({
		...(tag === undefined ? {} : { tag: tag.line }),
		...(tag?.occurrence === undefined ? {} : { occurrence: tag.occurrence }),
		order: order++,
		sourceLine: at + 1,
	});

	let index = 0;
	// Skip leading blanks, then require the header.
	while (index < lines.length && lines[index].trim() === "") index++;
	if (index >= lines.length || lines[index].trim() !== HEADER) {
		fail(`A trace diagram must start with \`${HEADER}\``, index);
	}
	index++;

	for (; index < lines.length; index++) {
		const rawLine = lines[index];

		const statement = rawLine.replace(/%%.*$/, "").trim();
		if (statement === "") continue;
		const column = rawLine.indexOf(statement.charAt(0)) + 1;

		// The tag is peeled before dispatch, so every statement regex below sees
		// the text it saw before timing notation existed.
		const { text: line, tag: trailingTag } = peelTrailingTag(statement);
		if (line === "") fail(`Unknown statement \`${statement}\``, index, column);

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
					...mint(index, trailingTag),
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
				const timed = mint(index);
				const values = parseValues(value, index, mint);
				applyTrailingTag(timed, values, trailingTag);
				if (values.some(({ pointsTo }) => pointsTo)) {
					fail(
						`Heap field \`${name}\` cannot use pointer values in \`name: values\` form; use \`${name} -> target\``,
						index,
						column,
					);
				}
				heap.fields.push({ ...timed, name, values });
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
			else {
				open.done = true;
				open.doneAt = mint(index, trailingTag);
			}
			continue;
		}

		const title = line.match(/^title\s+(.+)$/);
		if (title) {
			model.title = title[1].trim();
			continue;
		}

		// At most one `steps`, and only before the first block, so a reader of
		// the diagram meets the execution order before the trace it orders.
		const steps = line.match(/^steps\s+(\d+(?:\s+\d+)*)$/);
		if (steps) {
			if (model.declaredSteps) {
				fail(
					"A diagram may declare at most one `steps` statement",
					index,
					column,
				);
			} else if (blockSeen) {
				fail(
					"`steps` must come before the first `frame`, `scope`, or `heap`",
					index,
					column,
				);
			} else {
				model.declaredSteps = steps[1].split(/\s+/).map(Number);
			}
			continue;
		}

		const block = line.match(/^(frame|scope)(?:\s+(.+))?$/);
		if (block) {
			blockSeen = true;
			const frame: Frame = {
				...mint(index, trailingTag),
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
			blockSeen = true;
			heap = {
				...mint(index, trailingTag),
				id: object[1],
				...(object[2] ? { address: object[2] } : {}),
				fields: [],
			};
			continue;
		}

		const ret = line.match(/^ret\s+(.+?)(?:\s*->\s*(\S+))?$/);
		if (ret) {
			if (!open) fail("`ret` outside a frame", index, column);
			else {
				const timed = mint(index);
				const values = parseValues(ret[1], index, mint);
				applyTrailingTag(timed, values, trailingTag);
				open.rows.push({
					...timed,
					kind: "ret",
					name: "ret",
					values,
					...(ret[2] ? { returnsTo: ret[2] } : {}),
				});
			}
			continue;
		}

		const explicitRow = line.match(/^(row|watch)\s+([^:]+):(.*)$/);
		if (explicitRow) {
			const kind = explicitRow[1] as RowKind;
			if (!open) fail(`\`${kind}\` outside a frame or scope`, index, column);
			else {
				const timed = mint(index);
				const values = parseValues(explicitRow[3], index, mint);
				applyTrailingTag(timed, values, trailingTag);
				open.rows.push({
					...timed,
					kind,
					name: explicitRow[2].trim(),
					values,
				});
			}
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
				const timed = mint(index);
				const values = parseValues(implicitRow[2], index, mint);
				applyTrailingTag(timed, values, trailingTag);
				open.rows.push({ ...timed, kind: "row", name, values });
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
