// The parsed shape of a `traceDiagram`. The parser is the only place raw
// diagram text exists; everything downstream reads this model, so a value that
// reaches the renderer is already well-formed.

/**
 * One point in the trace's timeline. `tag` is the author's 0-based listing line;
 * `step` is the 1-based ordinal resolved against the step sequence.
 */
export interface Timed {
	/** Author's `@<digits>`, absent when the item inherits. */
	tag?: number;
	/** Document position across heap and frames, for inheritance and occurrence. */
	order: number;
	/** 1-based diagram source line, for TraceSyntaxError positions. */
	sourceLine: number;
	/** Resolved 1-based step ordinal. Absent when the diagram is untimed. */
	step?: number;
}

export interface TraceValue extends Timed {
	/** Rendered text. For a heap pointer with no declared address, the heap id. */
	text: string;
	/** Superseded by a later value in the row, or forced struck with `~v~`. */
	struck: boolean;
	/** Heap object id, set when the source wrote `@id`. */
	pointsTo?: string;
	/** Stack row name, set when the source wrote a Rust-like `&name`. */
	pointsToStack?: string;
}

export type RowKind = "row" | "watch" | "ret";

export interface Row extends Timed {
	kind: RowKind;
	/** An identifier, a watched expression, or the literal "ret". */
	name: string;
	values: TraceValue[];
	/** From `ret <v> -> <target>`: the row in an enclosing frame to point at. */
	returnsTo?: string;
}

export interface Frame extends Timed {
	/** A `scope` draws its opening rule dashed; a `frame` draws it solid. */
	kind: "frame" | "scope";
	label: string;
	/** Set by `done`: draw the large X across this block. */
	done: boolean;
	rows: Row[];
	frames: Frame[];
	/** Timing of the frame's `done`, which is a second event on one frame. */
	doneAt?: Timed;
}

export interface HeapField extends Timed {
	name: string;
	/** Scalar value history, using the same semantics as a stack row. */
	values: TraceValue[];
	/** Pointer fields carry their relation geometrically instead of as text. */
	pointsTo?: string;
}

export interface HeapObject extends Timed {
	id: string;
	/** Hexadecimal, written at the object's top-left (the 2021 paper's variant). */
	address?: string;
	/** Fills the card. The object carries its colour rather than naming it. */
	color?: string;
	fields: HeapField[];
}

export interface TraceModel {
	title?: string;
	frames: Frame[];
	heap: HeapObject[];
	/** From a `steps` statement. Absent means "derive the default sequence". */
	declaredSteps?: number[];
}

/** Thrown for any malformed diagram. Carries a 1-based line and column. */
export class TraceSyntaxError extends Error {
	readonly line: number;
	readonly column: number;

	constructor(message: string, line: number, column: number) {
		super(`${message} (line ${line}, column ${column})`);
		this.name = "TraceSyntaxError";
		this.line = line;
		this.column = column;
	}
}
