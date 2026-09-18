// Draws a TraceModel as SVG, reproducing the hand-drawn memory-diagram notation:
// a Name/Value T-table under one continuous vertical rule, value history running
// rightward with every superseded entry struck, call frames stacking downward
// and crossed out with a large X when complete, block scopes opened by a dashed
// rule, a return arrow along the left margin, and a heap area to the right.
//
// Text is measured arithmetically from a monospace metric, never with getBBox.
// That is what keeps the renderer free of a layout engine, so it runs the same
// under jsdom as in a browser and the feature test needs no real page.

import {
	g,
	line,
	path,
	rect,
	svg,
	text,
} from "@davidsouther/jiffies/dom/svg.ts";
import type {
	Frame,
	HeapObject,
	Row,
	TraceModel,
	TraceValue,
} from "./model.ts";
import { parseTrace } from "./parse.ts";
import { resolveSteps } from "./steps.ts";

/** Monospace advance and line box, in user units, for FONT_SIZE. */
const FONT_SIZE = 16;
const CHAR_W = FONT_SIZE * 0.6;
const ROW_H = FONT_SIZE * 1.75;
const PAD = FONT_SIZE;
/** Minimum left gutter; the real one is derived from the widest frame label. */
const GUTTER = FONT_SIZE * 5;
/** How far a return arc bows left of the name column. */
const RETURN_BULGE = FONT_SIZE * 1.5;
/** Clearance at both ends of a pointer arrow into the heap. */
const ARROW_GAP = FONT_SIZE * 0.5;
/** Clearance between a return arc's endpoints and the row text they serve. */
const RETURN_GAP = FONT_SIZE;
/** Gap between two successive values in a row. */
const VALUE_GAP = FONT_SIZE;
/** Vertical space a frame's opening rule occupies. */
const RULE_H = FONT_SIZE * 0.75;
/** Horizontal inset applied to each nesting level. */
const INDENT = FONT_SIZE;
const HEAP_GAP = FONT_SIZE * 3;

const width = (s: string): number => s.length * CHAR_W;

/** A row with the geometry the draw pass and the arrow pass both need. */
interface PlacedRow {
	row: Row;
	y: number;
	/** Visible text for each value, parallel to `row.values`. */
	displayValues: string[];
	/** Left edge of each value, parallel to `row.values`. */
	valueX: number[];
	/** Right edge of the last value; where a pointer arrow leaves the table. */
	endX: number;
	/** Indent of the frame that owns this row. */
	indent: number;
}

interface PlacedFrame {
	frame: Frame;
	top: number;
	bottom: number;
	indent: number;
}

interface PlacedHeapPointer {
	sourceId: string;
	targetId: string;
	y: number;
	/** Step of the heap field that owns the pointer, so the arrow never leads it. */
	step?: number;
}

/**
 * The `data-at` attribute for one timed element, or nothing at all.
 *
 * `resolveSteps` writes no `step` on an untimed diagram, so an untagged diagram
 * emits no timing attribute anywhere and its SVG is byte-identical to the one
 * the renderer produced before timing existed.
 */
type Timing = { "data-at"?: number };

function timing(step: number | undefined): Timing {
	return step === undefined ? {} : { "data-at": step };
}

/** The exact string drawn for a stack value. Pointer ids stay lookup-only. */
function stackValue(
	value: TraceValue,
	heapAddresses: ReadonlyMap<string, string>,
): string {
	return value.pointsTo
		? (heapAddresses.get(value.pointsTo) ?? "")
		: value.text;
}

/** Widest name, value run, and frame label across the whole model. */
function measure(
	frames: Frame[],
	heapAddresses: ReadonlyMap<string, string>,
): {
	nameW: number;
	valuesW: number;
	labelW: number;
	maxIndent: number;
} {
	let nameW = width("Name");
	let valuesW = width("Value");
	let labelW = 0;
	let maxIndent = 0;
	const walk = (list: Frame[], depth: number): void => {
		for (const frame of list) {
			maxIndent = Math.max(maxIndent, depth * INDENT);
			labelW = Math.max(labelW, width(frame.label) + depth * INDENT);
			for (const row of frame.rows) {
				nameW = Math.max(nameW, width(row.name) + depth * INDENT);
				const run =
					row.values.reduce(
						(sum, value) => sum + width(stackValue(value, heapAddresses)),
						0,
					) +
					Math.max(0, row.values.length - 1) * VALUE_GAP;
				valuesW = Math.max(valuesW, run);
			}
			walk(frame.frames, depth + 1);
		}
	};
	walk(frames, 0);
	return { nameW, valuesW, labelW, maxIndent };
}

/** Width of a left-to-right value history, including the gaps between values. */
function valueRunWidth(
	values: TraceValue[],
	heapAddresses: ReadonlyMap<string, string>,
): number {
	return (
		values.reduce(
			(sum, value) => sum + width(stackValue(value, heapAddresses)),
			0,
		) +
		Math.max(0, values.length - 1) * VALUE_GAP
	);
}

function heapObjectSize(
	object: HeapObject,
	heapAddresses: ReadonlyMap<string, string>,
): {
	w: number;
	h: number;
	nameW: number;
} {
	const nameW = Math.max(
		width("Name"),
		...object.fields.map((field) => width(field.name)),
	);
	const valueW = Math.max(
		width("Value"),
		...object.fields.map((field) => valueRunWidth(field.values, heapAddresses)),
	);
	return {
		w: nameW + valueW + 4 * PAD,
		h: (object.fields.length + 1) * ROW_H + PAD,
		nameW,
	};
}

/** Escaped by construction: every string reaches the DOM as a text node. */
type Anchor = "start" | "middle" | "end";

function label(
	x: number,
	y: number,
	s: string,
	cls: string,
	anchor: Anchor,
	at: Timing = {},
) {
	return text(
		{
			x,
			y,
			class: cls,
			"text-anchor": anchor,
			"font-family": "ui-monospace, SFMono-Regular, Menlo, monospace",
			"font-size": FONT_SIZE,
			"dominant-baseline": "middle",
			...at,
		},
		s,
	);
}

/**
 * One entry of a value history: the value itself, and the strike that cancels
 * it when a later value supersedes it.
 *
 * A timed diagram wraps the value's label in `g.trace-value-item` so the value
 * is one element that can carry a state; the strike stays a *sibling* of that
 * group and takes the step of the value that supersedes it, because a strike
 * appears when its successor does. Placed inside the group it would be revealed
 * together with the value it cancels.
 *
 * An untimed diagram gets neither the wrapper nor the attribute.
 */
function valueCells(
	values: TraceValue[],
	index: number,
	x: number,
	y: number,
	displayValue: string,
	cls: string,
	timed: boolean,
): SVGElement[] {
	const value = values[index];
	const drawn = label(
		x,
		y,
		displayValue,
		`${cls}${value.struck ? " trace-struck" : ""}`,
		"start",
	);
	const cells: SVGElement[] = [
		timed
			? g({ class: "trace-value-item", ...timing(value.step) }, drawn)
			: drawn,
	];
	if (value.struck) {
		cells.push(
			line({
				x1: x - 2,
				y1: y + FONT_SIZE * 0.35,
				x2: x + width(displayValue) + 2,
				y2: y - FONT_SIZE * 0.35,
				class: "trace-strike",
				// A terminal `~v~` has no successor, so it is struck when it appears.
				...timing(values[index + 1]?.step ?? value.step),
			}),
		);
	}
	return cells;
}

export function drawTrace(model: TraceModel, host: Element): SVGSVGElement {
	// One resolution for the whole draw. An empty sequence means the diagram
	// carries no timing notation, so no `step` is written on any node, `timing`
	// yields nothing, and no `g.trace-value-item` wrapper is created.
	const timed = resolveSteps(model).length > 0;
	const heapAddresses = new Map(
		model.heap.flatMap((object) =>
			object.address ? [[object.id, object.address] as const] : [],
		),
	);
	const { nameW, valuesW, labelW, maxIndent } = measure(
		model.frames,
		heapAddresses,
	);
	// Each nesting level bows one step further out, so concentric return arcs
	// nest instead of running into one another.
	const maxBulge = RETURN_BULGE + maxIndent;

	// Derived, not fixed: the gutter holds the frame labels and the return arcs
	// that bow out to their left, so a long label must widen it rather than be
	// drawn at a negative x and clipped off the canvas.
	const tableLeft = Math.max(GUTTER, labelW + maxBulge + RETURN_GAP + PAD);
	const ruleX = tableLeft + nameW + PAD;
	const valueLeft = ruleX + PAD;
	const tableRight = valueLeft + valuesW + PAD;

	const placedRows: PlacedRow[] = [];
	const placedFrames: PlacedFrame[] = [];
	const nodes: (SVGElement | null)[] = [];

	let y = PAD + (model.title ? ROW_H : 0);
	if (model.title) {
		nodes.push(
			label(tableLeft, PAD + ROW_H / 2, model.title, "trace-title", "start"),
		);
	}

	// Column headers, above the first frame rule.
	const headerY = y + ROW_H / 2;
	nodes.push(label(ruleX - PAD, headerY, "Name", "trace-header", "end"));
	nodes.push(label(valueLeft, headerY, "Value", "trace-header", "start"));
	y += ROW_H;
	const ruleTop = y;

	const walk = (frames: Frame[], depth: number): void => {
		for (const frame of frames) {
			const top = y;
			const indent = depth * INDENT;
			const dashed = frame.kind === "scope";
			nodes.push(
				line({
					x1: tableLeft + indent,
					y1: top,
					x2: tableRight,
					y2: top,
					class: dashed ? "trace-scope" : "trace-rule",
					...(dashed ? { "stroke-dasharray": "6 4" } : {}),
					...timing(frame.step),
				}),
			);
			if (frame.label) {
				nodes.push(
					label(
						// Left of the corridor the return arcs bow through, so a label
						// and an arc never cross.
						tableLeft + indent - maxBulge - RETURN_GAP - PAD / 2,
						top + RULE_H + ROW_H / 2,
						frame.label,
						"trace-frame-label",
						"end",
						timing(frame.step),
					),
				);
			}
			y += RULE_H;

			for (const row of frame.rows) {
				const rowY = y + ROW_H / 2;
				const displayValues = row.values.map((value) =>
					stackValue(value, heapAddresses),
				);
				const valueX: number[] = [];
				let x = valueLeft;
				for (const displayValue of displayValues) {
					valueX.push(x);
					x += width(displayValue) + VALUE_GAP;
				}
				placedRows.push({
					row,
					y: rowY,
					displayValues,
					valueX,
					endX: x - VALUE_GAP,
					indent,
				});
				y += ROW_H;
			}

			// The frame's own extent stops at its last row. A nested call's rows
			// belong to that call, so an outer frame's X must not cover them —
			// in the original figures each X spans only its own frame.
			const bottom = y;
			walk(frame.frames, depth + 1);
			placedFrames.push({ frame, top, bottom, indent });
		}
	};
	walk(model.frames, 0);

	const tableBottom = y + PAD / 2;

	// Rows and their values, drawn after the frames so the rules sit behind them.
	for (const placed of placedRows) {
		const { row, y: rowY, displayValues, valueX } = placed;
		const classes = ["trace-row", row.kind === "watch" ? "trace-watch" : ""]
			.filter(Boolean)
			.join(" ");
		// A row tagged in its own right is timed by that tag — which is what makes
		// an empty-valued row like `my_art:` timeable at all. Otherwise the name
		// appears with the first value it holds.
		const nameStep =
			row.tag === undefined ? (row.values[0]?.step ?? row.step) : row.step;
		const cells: SVGElement[] = [
			label(ruleX - PAD, rowY, row.name, "trace-name", "end", timing(nameStep)),
		];
		row.values.forEach((_value, index) => {
			cells.push(
				...valueCells(
					row.values,
					index,
					valueX[index],
					rowY,
					displayValues[index],
					"trace-value",
					timed,
				),
			);
		});
		// `g.trace-row` stays untimed: it contains the name and every value, so a
		// state on the group would shadow its children in document order.
		nodes.push(g({ class: classes }, ...cells));
	}

	// The one continuous vertical rule, running the full height of the table.
	nodes.push(
		line({
			x1: ruleX,
			y1: ruleTop - ROW_H,
			x2: ruleX,
			y2: tableBottom,
			class: "trace-divider",
		}),
	);

	// Frames: a group per block, plus the large X across a completed one.
	for (const placed of placedFrames) {
		const { frame, top, bottom, indent } = placed;
		const left = tableLeft + indent;
		const members: SVGElement[] = [];
		if (frame.done) {
			// Inset vertically: the X reads as crossing the frame out, not as two
			// lines growing from the rules that bound it.
			const xTop = top + RULE_H;
			const xBottom = bottom - RULE_H / 2;
			members.push(
				path({
					d: `M ${left} ${xTop} L ${tableRight} ${xBottom} M ${tableRight} ${xTop} L ${left} ${xBottom}`,
					class: "trace-frame-done",
					fill: "none",
					// `done` is a second event on one frame, so the X is timed by
					// `doneAt`, not by the frame's own step. The attribute goes on the
					// path rather than the enclosing group.
					...timing(frame.doneAt?.step),
				}),
			);
		}
		const group = g(
			{ class: `trace-frame trace-frame-${frame.kind}` },
			...members,
		);
		group.setAttribute("data-label", frame.label);
		nodes.push(group);
	}

	// Return arrows: down the left gutter from the callee's ret to the caller's.
	for (const placed of placedRows) {
		const target = placed.row.returnsTo;
		if (!target) continue;
		// The nearest matching row above, not the first: in a recursive trace every
		// frame has a `ret`, and the arrow goes to the immediate caller's.
		const to = placedRows
			.filter(
				(candidate) => candidate.row.name === target && candidate.y < placed.y,
			)
			.at(-1);
		if (!to) continue;
		// One ellipse segment rather than a rectilinear bracket: the arrow leaves
		// the left of the callee's ret row, bows out into the gutter, and lands
		// back on the left of the caller's row.
		const leaveX = ruleX - PAD - width(placed.row.name) - RETURN_GAP;
		const landX = ruleX - PAD - width(to.row.name) - RETURN_GAP;
		const rx = RETURN_BULGE + placed.indent;
		const ry = Math.max(PAD, (placed.y - to.y) / 2);
		nodes.push(
			path({
				// sweep-flag 1 bows left when travelling upward in SVG's y-down space.
				d: `M ${leaveX} ${placed.y} A ${rx} ${ry} 0 0 1 ${landX} ${to.y}`,
				class: "trace-return-arrow",
				fill: "none",
				"marker-end": "url(#trace-arrow)",
				// The arrow belongs to the returned value, so it never precedes or
				// outlives it.
				...timing(placed.row.values.at(-1)?.step ?? placed.row.step),
			}),
		);
	}

	// Rust-like `&name` values point back into the stack table. The row name is
	// still printed, but the arrow makes the storage relation geometric rather
	// than leaving the reference as text alone.
	for (const placed of placedRows) {
		placed.row.values.forEach((value, index) => {
			if (!value.pointsToStack) return;
			const target = placedRows
				.filter(
					(candidate) =>
						candidate.row.name === value.pointsToStack &&
						candidate.y < placed.y,
				)
				.at(-1);
			if (!target) return;
			const sourceX =
				placed.valueX[index] + width(placed.displayValues[index]) + ARROW_GAP;
			const targetX = (target.valueX[0] ?? valueLeft) - ARROW_GAP;
			const bendX = Math.max(sourceX, target.endX + PAD);
			nodes.push(
				path({
					d: `M ${sourceX} ${placed.y} C ${bendX} ${placed.y} ${bendX} ${target.y} ${targetX} ${target.y}`,
					class: `trace-pointer trace-stack-pointer${value.struck ? " trace-struck" : ""}`,
					fill: "none",
					"marker-end": "url(#trace-arrow)",
					...timing(value.step),
				}),
			);
		});
	}

	// The heap, to the right of the table.
	let heapY = ruleTop;
	const heapLeft = tableRight + HEAP_GAP;
	const heapBox = new Map<
		string,
		{ x: number; y: number; w: number; h: number }
	>();
	const heapPointers: PlacedHeapPointer[] = [];
	for (const object of model.heap) {
		const { w, h, nameW } = heapObjectSize(object, heapAddresses);
		heapBox.set(object.id, { x: heapLeft, y: heapY, w, h });
		const dividerX = heapLeft + 2 * PAD + nameW;
		const headerY = heapY + PAD / 2 + ROW_H / 2;
		const headerRuleY = heapY + PAD / 2 + ROW_H;
		const fields = object.fields.flatMap((field, index) => {
			const fieldY = headerY + (index + 1) * ROW_H;
			if (field.pointsTo) {
				heapPointers.push({
					sourceId: object.id,
					targetId: field.pointsTo,
					y: fieldY,
					step: field.step,
				});
			}
			const members: SVGElement[] = [
				label(
					dividerX - PAD,
					fieldY,
					field.name,
					"trace-heap-field-name",
					"end",
					timing(field.step),
				),
			];
			if (field.pointsTo) {
				members.push(
					label(
						dividerX + PAD,
						fieldY,
						"",
						"trace-heap-field trace-heap-field-value",
						"start",
						timing(field.step),
					),
				);
				return members;
			}

			let valueX = dividerX + PAD;
			field.values.forEach((value, at) => {
				const displayValue = stackValue(value, heapAddresses);
				members.push(
					...valueCells(
						field.values,
						at,
						valueX,
						fieldY,
						displayValue,
						"trace-heap-field trace-heap-field-value trace-value",
						timed,
					),
				);
				valueX += width(displayValue) + VALUE_GAP;
			});
			return members;
		});
		const box = g(
			{ class: "trace-heap-object", ...timing(object.step) },
			rect({
				x: heapLeft,
				y: heapY,
				width: w,
				height: h,
				// A generous corner radius and a soft drop shadow: the heap objects
				// read as raised cards, the way a drawing tool renders them, rather
				// than as bare wireframe boxes.
				rx: FONT_SIZE,
				ry: FONT_SIZE,
				class: "trace-heap-rect",
				// The object carries its colour rather than naming it in a field.
				...(object.color ? { style: { fill: object.color } } : {}),
				filter: "url(#trace-pillow)",
			}),
			label(
				dividerX - PAD,
				headerY,
				"Name",
				"trace-header trace-heap-name-header",
				"end",
			),
			label(
				dividerX + PAD,
				headerY,
				"Value",
				"trace-header trace-heap-value-header",
				"start",
			),
			line({
				x1: dividerX,
				y1: heapY + PAD / 2,
				x2: dividerX,
				y2: heapY + h - PAD / 2,
				class: "trace-heap-divider",
			}),
			line({
				x1: heapLeft + PAD,
				y1: headerRuleY,
				x2: heapLeft + w - PAD,
				y2: headerRuleY,
				class: "trace-heap-rule",
			}),
			...fields,
		);
		box.setAttribute("data-id", object.id);
		nodes.push(box);
		if (object.address) {
			nodes.push(
				label(
					heapLeft,
					heapY - PAD / 2,
					object.address,
					"trace-heap-address",
					"start",
				),
			);
		}
		heapY += h + ROW_H;
	}

	// Pointer-valued heap fields carry their relation geometrically. Heap ids are
	// parser/lookup keys only, so neither endpoint's id is printed inside a card.
	const heapPointerCorridorX = model.heap.length
		? heapLeft +
			Math.max(...model.heap.map((o) => heapObjectSize(o, heapAddresses).w)) +
			PAD
		: heapLeft;
	for (const pointer of heapPointers) {
		const source = heapBox.get(pointer.sourceId);
		const target = heapBox.get(pointer.targetId);
		if (!source || !target) continue;
		const sourceX = source.x + source.w;
		const targetX = target.x + target.w;
		const targetY = target.y + ROW_H / 2;
		nodes.push(
			path({
				d: `M ${sourceX} ${pointer.y} C ${heapPointerCorridorX} ${pointer.y} ${heapPointerCorridorX} ${targetY} ${targetX + ARROW_GAP} ${targetY} L ${targetX} ${targetY}`,
				class: "trace-pointer trace-heap-pointer",
				fill: "none",
				"marker-end": "url(#trace-arrow)",
				...timing(pointer.step),
			}),
		);
	}

	// Pointer arrows from the value column into the heap. A value whose object
	// declares an address prints the address instead — the 2021 paper's variant.
	for (const placed of placedRows) {
		placed.row.values.forEach((value, index) => {
			if (!value.pointsTo) return;
			const box = heapBox.get(value.pointsTo);
			if (!box) return;
			nodes.push(
				path({
					d: `M ${placed.valueX[index] + width(placed.displayValues[index]) + ARROW_GAP} ${placed.y} L ${box.x - ARROW_GAP} ${box.y + ROW_H / 2}`,
					class: `trace-pointer${value.struck ? " trace-struck" : ""}`,
					fill: "none",
					"marker-end": "url(#trace-arrow)",
					...timing(value.step),
				}),
			);
		});
	}

	const heapRight = model.heap.length
		? heapPointerCorridorX + (heapPointers.length ? PAD : 0)
		: tableRight + PAD;
	const titleRight = model.title ? tableLeft + width(model.title) + PAD : 0;
	const totalW = Math.max(heapRight, tableRight + PAD, titleRight);
	// A completed frame's X reaches its own bottom edge, which for the last frame
	// sits below the last row. Measure against every drawn extent, not just the
	// table, so nothing is cut off at the bottom.
	const framesBottom = placedFrames.reduce(
		(lowest, placed) => Math.max(lowest, placed.bottom),
		0,
	);
	const totalH = Math.max(tableBottom, framesBottom, heapY) + PAD;

	const root = svg({
		class: "trace-diagram",
		viewBox: `0 0 ${Math.ceil(totalW)} ${Math.ceil(totalH)}`,
		width: Math.ceil(totalW),
		height: Math.ceil(totalH),
	});
	root.setAttribute("role", "img");
	root.setAttribute("aria-roledescription", "traceDiagram");
	root.innerHTML = `<defs><marker id="trace-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M 0 0 L 10 5 L 0 10 z" class="trace-arrowhead" /></marker><filter id="trace-pillow" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="2" stdDeviation="3" flood-opacity="0.18" /></filter></defs>`;
	for (const node of nodes) if (node) root.append(node);
	host.append(root);
	return root;
}

/** Parses `source` and draws it into `host`, as the mermaid renderer does. */
export function renderTrace(source: string, host: Element): SVGSVGElement {
	return drawTrace(parseTrace(source), host);
}
