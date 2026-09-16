// The parsed shape of a `traceDiagram`. The parser is the only place raw
// diagram text exists; everything downstream reads this model, so a value that
// reaches the renderer is already well-formed.

export interface TraceValue {
	/** Rendered text. For a pointer with no declared address, the heap id. */
	text: string;
	/** Superseded by a later value in the row, or forced struck with `~v~`. */
	struck: boolean;
	/** Heap object id, set when the source wrote `@id`. */
	pointsTo?: string;
}

export type RowKind = "row" | "watch" | "ret";

export interface Row {
	kind: RowKind;
	/** An identifier, a watched expression, or the literal "ret". */
	name: string;
	values: TraceValue[];
	/** From `ret <v> -> <target>`: the row in an enclosing frame to point at. */
	returnsTo?: string;
}

export interface Frame {
	/** A `scope` draws its opening rule dashed; a `frame` draws it solid. */
	kind: "frame" | "scope";
	label: string;
	/** Set by `done`: draw the large X across this block. */
	done: boolean;
	rows: Row[];
	frames: Frame[];
}

export interface HeapField {
	name: string;
	/** Scalar value history, using the same semantics as a stack row. */
	values: TraceValue[];
	/** Pointer fields carry their relation geometrically instead of as text. */
	pointsTo?: string;
}

export interface HeapObject {
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
