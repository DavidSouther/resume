// Pairs keyframes with their content.md prose. Server only: content.ts reads
// the file, so the browser bundle (client.ts -> plan.ts) must not import this.

import { type Content, checkOrder, fillPlaceholders } from "./content.ts";
import type { Stage } from "./dataset.ts";
import type { Keyframe } from "./plan.ts";

/** Narration for one keyframe, ready to render as Markdown. */
export interface Narration {
	id: string;
	title: string;
	text: string;
}

const rowCount = (s: Stage): string =>
	s.tables.map((t) => `${t.name} ${t.rows.length}`).join(", ");

/**
 * Pairs each keyframe with its content.md step, by ID and in order, filling
 * `{{columns}}` (marked columns) and `{{rows}}` (row counts) from the data.
 * Server only: content.ts reads the file.
 */
export function narrate(
	stages: Stage[],
	frames: Keyframe[],
	content: Content,
): Narration[] {
	checkOrder(
		content.steps,
		frames.map((f) => f.id),
	);
	return frames.map((f, i) => {
		const shown =
			stages[f.kind === "violates" ? (f.target ?? f.stage) : f.stage];
		return {
			id: f.id,
			title: content.steps[i].title,
			text: fillPlaceholders(content.steps[i].body, {
				columns: [...new Set(shown.violates.map((v) => v.column))].join(", "),
				rows: rowCount(shown),
			}),
		};
	});
}
