// Pure planning for one stage-to-stage transition: which previous cells land
// in which new cells, which collapse into a surviving copy, and which vanish.

import type { Stage } from "./dataset.ts";

export interface Move {
	from: string;
	to: string;
	/** The first source of a cell travels as the cell; later ones merge into it. */
	survivor: boolean;
}

export interface Transition {
	moves: Move[];
	/** Previous cells that no next cell cites as a source. */
	dropped: string[];
}

export function planTransition(prev: Stage, next: Stage): Transition {
	const moves: Move[] = [];
	const used = new Set<string>();
	for (const table of next.tables)
		for (const row of table.rows)
			for (const cell of row)
				cell.from.forEach((from, i) => {
					used.add(from);
					moves.push({ from, to: cell.id, survivor: i === 0 });
				});
	const dropped = prev.tables.flatMap((t) =>
		t.rows
			.flat()
			.filter((c) => !used.has(c.id))
			.map((c) => c.id),
	);
	return { moves, dropped };
}

export interface Keyframe {
	index: number;
	/** `raw`, or `<stage id>-violates` / `<stage id>-settled`; keys content.md. */
	id: string;
	stage: number;
	/** `violates` shows the stage with next form's offending columns marked. */
	kind: "settled" | "violates";
	/** Stage whose violations are highlighted, for `violates` keyframes. */
	target?: number;
	/** Name of the form this keyframe's stage shows, for control labels. */
	form: string;
}

/**
 * Frame 0 is the settled raw stage; each later form adds a violates frame then
 * a settled frame. client.ts (forward-move test in goTo) and renderControls
 * depend on this ordering. Pure structure: the browser bundle imports this, so
 * prose stays in narrate().
 */
export function buildKeyframes(stages: Stage[]): Keyframe[] {
	const frames: Keyframe[] = [
		{ index: 0, id: "raw", stage: 0, kind: "settled", form: stages[0].form },
	];
	for (let i = 1; i < stages.length; i++) {
		frames.push({
			index: frames.length,
			id: `${stages[i].id}-violates`,
			stage: i - 1,
			kind: "violates",
			target: i,
			form: stages[i - 1].form,
		});
		frames.push({
			index: frames.length,
			id: `${stages[i].id}-settled`,
			stage: i,
			kind: "settled",
			form: stages[i].form,
		});
	}
	return frames;
}
