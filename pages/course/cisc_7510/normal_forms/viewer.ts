import {
	button,
	div,
	figcaption,
	figure,
	h3,
	nav,
	span,
	table,
	tbody,
	td,
	th,
	thead,
	tr,
} from "@davidsouther/jiffies/dom/html.ts";
import type { Stage, Table, Violation } from "./dataset.ts";
import type { Keyframe } from "./plan.ts";

/** jiffies attrs are typed to DOM properties, so data-* is set after creation. */
export function data<T extends HTMLElement>(
	el: T,
	values: Record<string, string>,
): T {
	Object.assign(el.dataset, values);
	return el;
}

/**
 * Data attribute contract: cells carry data-cell-id (and data-null for NULLs),
 * a table figure carries data-table, a stage carries data-stage, and controls
 * carry data-nf-prev, data-nf-next and data-nf-jump. animate.ts queries
 * [data-cell-id].
 */
export function renderTable(t: Table, marked: Violation[] = []): HTMLElement {
	const markedCols = new Set(
		marked.filter((m) => m.table === t.name).map((m) => m.column),
	);
	return data(
		figure(
			{ class: "nf-table" },
			figcaption(h3(t.name)),
			table(
				thead(
					tr(
						...t.columns.map((c) =>
							th(
								{
									scope: "col",
									class: [
										t.key.includes(c) ? "key" : "",
										markedCols.has(c) ? "violates" : "",
									]
										.filter(Boolean)
										.join(" "),
								},
								c,
							),
						),
					),
				),
				tbody(
					...t.rows.map((row) =>
						tr(
							...row.map((c, i) => {
								const cls = markedCols.has(t.columns[i]) ? "violates" : "";
								return c.value === null
									? data(td({ class: cls }, "NULL"), {
											cellId: c.id,
											null: "true",
										})
									: data(td({ class: cls }, String(c.value)), { cellId: c.id });
							}),
						),
					),
				),
			),
		),
		{ table: t.name },
	);
}

/** One stage's tables, with `marked` columns flagged. */
export function renderStage(
	stage: Stage,
	marked: Violation[] = [],
): HTMLElement {
	return data(
		div(
			{ class: "nf-stage" },
			...stage.tables.map((t) => renderTable(t, marked)),
		),
		{ stage: stage.id },
	);
}

export function renderControls(frames: Keyframe[]): HTMLElement {
	const forms = [...new Set(frames.map((f) => f.stage))];
	const controls = nav(
		{ class: "nf-controls" },
		data(button({ type: "button" }, "Back"), { nfPrev: "true" }),
		span({ class: "nf-spacer" }),
		...forms.map((s) => {
			const first = frames.find((f) => f.stage === s && f.kind === "settled");
			return data(button({ type: "button" }, first?.form ?? ""), {
				nfJump: String(first?.index ?? 0),
			});
		}),
		span({ class: "nf-spacer" }),
		data(button({ type: "button" }, "Next"), { nfNext: "true" }),
	);
	// jiffies would emit ariaLabel as a literal `arialabel` attribute.
	controls.setAttribute("aria-label", "Normal form stepper");
	return controls;
}

/** Flags `marked` columns in place so CSS transitions animate the highlight. */
export function setMarked(root: HTMLElement, marked: Violation[]): void {
	for (const fig of root.querySelectorAll<HTMLElement>("figure.nf-table")) {
		const cols = new Set(
			marked.filter((m) => m.table === fig.dataset.table).map((m) => m.column),
		);
		const names = [...fig.querySelectorAll("thead th")].map(
			(th) => th.textContent ?? "",
		);
		for (const row of fig.querySelectorAll("tr"))
			for (const [i, cell] of [...row.children].entries())
				cell.classList.toggle("violates", cols.has(names[i]));
	}
}
