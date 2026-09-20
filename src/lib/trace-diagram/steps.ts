// The one definition of a trace diagram's timeline. The renderer and the
// build-time figure writer both read S from here, so they cannot drift.

import type {
	Frame,
	HeapObject,
	Timed,
	TraceModel,
	TraceValue,
} from "./model.ts";
import { TraceSyntaxError } from "./model.ts";
import { parseTrace } from "./parse.ts";

/**
 * The resolved step sequence: `S[n-1]` is the 0-based listing line executed at
 * step n. Empty when the diagram carries no timing notation at all.
 */
export type StepSequence = readonly number[];

/** Every timed node of the model, in the document order the parser stamped. */
function collectTimed(model: TraceModel): Timed[] {
	const nodes: Timed[] = [];

	const values = (list: TraceValue[]): void => {
		for (const value of list) nodes.push(value);
	};

	const object = (card: HeapObject): void => {
		nodes.push(card);
		for (const field of card.fields) {
			nodes.push(field);
			values(field.values);
		}
	};

	const walk = (frames: Frame[]): void => {
		for (const frame of frames) {
			nodes.push(frame);
			for (const row of frame.rows) {
				nodes.push(row);
				values(row.values);
			}
			walk(frame.frames);
			if (frame.doneAt) nodes.push(frame.doneAt);
		}
	};

	for (const card of model.heap) object(card);
	walk(model.frames);

	// Traversal order is nearly document order already; sorting makes it exactly
	// so, and keeps this function independent of how the parser nests blocks.
	return nodes.sort((a, b) => a.order - b.order);
}

/**
 * Resolves S and writes `step` onto every timed node of `model`, in place.
 * Returns S. Returns `[]` and writes no `step` when nothing is tagged and no
 * `steps` statement was written — that is the backward-compatible path.
 *
 * Throws TraceSyntaxError when a tag names a line absent from an explicit
 * `steps` list.
 */
export function resolveSteps(model: TraceModel): StepSequence {
	const nodes = collectTimed(model);
	const tags = nodes
		.map(({ tag }) => tag)
		.filter((tag): tag is number => tag !== undefined);
	if (tags.length === 0 && model.declaredSteps === undefined) return [];

	const sequence =
		model.declaredSteps ?? [...new Set(tags)].sort((a, b) => a - b);

	// Claims per repeated line, so a line written twice in `steps` replays a
	// loop instead of collapsing to one step.
	const taken = new Map<number, number>();
	// An untagged node takes the nearest preceding tagged node's step rather
	// than re-resolving, so it never consumes an occurrence of its own.
	let inherited = 1;

	for (const node of nodes) {
		if (node.tag === undefined) {
			node.step = inherited;
			continue;
		}
		const tag = node.tag;
		const positions: number[] = [];
		sequence.forEach((line, at) => {
			if (line === tag) positions.push(at);
		});
		if (positions.length === 0) {
			throw new TraceSyntaxError(
				`Step tag \`@${tag}\` names a line the \`steps\` statement never executes`,
				node.sourceLine,
				1,
			);
		}
		// The implicit counter is ambiguous wherever one line writes two rows or
		// a recursive frame's rows precede the call, so those tag `#k` outright.
		const wanted = node.occurrence;
		if (wanted !== undefined) {
			if (wanted < 1 || wanted > positions.length) {
				throw new TraceSyntaxError(
					`Step tag \`@${tag}#${wanted}\` names execution ${wanted} of listing line ${tag}, which the \`steps\` statement runs ${positions.length} time${positions.length === 1 ? "" : "s"}`,
					node.sourceLine,
					1,
				);
			}
			node.step = positions[wanted - 1] + 1;
			taken.set(tag, wanted);
			inherited = node.step;
			continue;
		}
		const used = taken.get(tag) ?? 0;
		node.step = positions[Math.min(used, positions.length - 1)] + 1;
		taken.set(tag, used + 1);
		inherited = node.step;
	}

	return sequence;
}

/** Parses `source` and resolves its sequence without drawing. Build-time entry. */
export function resolveStepsFromSource(source: string): StepSequence {
	return resolveSteps(parseTrace(source));
}
