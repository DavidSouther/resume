// Forward (and, via runReverse, backward) transition between a violates frame and a settled frame: cells slide from
// where they were to where they now live. Cells with no source fade in.
// FLIP: record old rects, swap the DOM, then animate each new cell from its
// survivor's old position. Cells merged into a survivor slide over as ghosts and
// fade; cells that feed nothing fade out where they stood.

import type { Stage, Violation } from "./dataset.ts";
import type { Transition } from "./plan.ts";
import { renderStage } from "./viewer.ts";

/** Latest runMove call; an older run's cleanup must not remove newer ghosts. */
let run = 0;

const DURATION = 700;
const EASING = "cubic-bezier(0.4, 0, 0.2, 1)";

interface Box {
	x: number;
	y: number;
	w: number;
	h: number;
	text: string;
}

/** Coordinates are relative to .nf-canvas, which must be position: relative. */
function boxes(canvas: HTMLElement): Map<string, Box> {
	const origin = canvas.getBoundingClientRect();
	const out = new Map<string, Box>();
	for (const el of canvas.querySelectorAll<HTMLElement>("[data-cell-id]")) {
		const r = el.getBoundingClientRect();
		out.set(el.dataset.cellId ?? "", {
			x: r.left - origin.left + canvas.scrollLeft,
			y: r.top - origin.top + canvas.scrollTop,
			w: r.width,
			h: r.height,
			text: el.textContent ?? "",
		});
	}
	return out;
}

export function canAnimate(canvas: HTMLElement): boolean {
	return (
		typeof canvas.animate === "function" &&
		!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
	);
}

export function cancelAnimations(canvas: HTMLElement): void {
	if (typeof canvas.getAnimations === "function")
		for (const a of canvas.getAnimations({ subtree: true })) a.cancel();
	for (const g of canvas.querySelectorAll(".nf-ghost")) g.remove();
}

export function ghost(canvas: HTMLElement, b: Box): HTMLElement {
	const g = document.createElement("div");
	g.className = "nf-ghost";
	g.textContent = b.text;
	g.style.cssText = `left:${b.x}px;top:${b.y}px;width:${b.w}px;height:${b.h}px`;
	canvas.append(g);
	return g;
}

/** Callers gate on canAnimate. Cancels in-flight animations first, then swaps to `next` and animates `plan`. */
export function runMove(
	canvas: HTMLElement,
	next: Stage,
	plan: Transition,
): void {
	const token = ++run;
	cancelAnimations(canvas);
	const before = boxes(canvas);
	canvas.replaceChildren(renderStage(next));
	const after = boxes(canvas);
	const finished: Promise<unknown>[] = [];
	const opts: KeyframeAnimationOptions = {
		duration: DURATION,
		easing: EASING,
		fill: "backwards",
	};

	const survivors = new Map<string, string>();
	for (const m of plan.moves) if (m.survivor) survivors.set(m.to, m.from);

	for (const el of canvas.querySelectorAll<HTMLElement>("[data-cell-id]")) {
		const id = el.dataset.cellId ?? "";
		const to = after.get(id);
		const from = before.get(survivors.get(id) ?? "");
		if (!to) continue;
		if (from) {
			finished.push(
				el.animate(
					[
						{ transform: `translate(${from.x - to.x}px, ${from.y - to.y}px)` },
						{ transform: "none" },
					],
					opts,
				).finished,
			);
		} else {
			finished.push(
				el.animate([{ opacity: 0 }, { opacity: 1 }], opts).finished,
			);
		}
	}
	for (const m of plan.moves) {
		if (m.survivor) continue;
		const from = before.get(m.from);
		const to = after.get(m.to);
		if (!from || !to) continue;
		const g = ghost(canvas, from);
		finished.push(
			g.animate(
				[
					{ transform: "none", opacity: 1 },
					{
						transform: `translate(${to.x - from.x}px, ${to.y - from.y}px)`,
						opacity: 0,
					},
				],
				{ ...opts, fill: "forwards" },
			).finished,
		);
	}
	for (const id of plan.dropped) {
		const from = before.get(id);
		if (!from) continue;
		finished.push(
			ghost(canvas, from).animate([{ opacity: 1 }, { opacity: 0 }], {
				...opts,
				fill: "forwards",
			}).finished,
		);
	}
	for (const head of canvas.querySelectorAll<HTMLElement>("figcaption, thead"))
		finished.push(
			head.animate([{ opacity: 0 }, { opacity: 1 }], opts).finished,
		);

	Promise.allSettled(finished).then(() => {
		if (token !== run) return;
		for (const g of canvas.querySelectorAll(".nf-ghost")) g.remove();
	});
}

/**
 * Backward transition from a settled frame to the previous violates frame: each
 * earlier cell slides out of the cell it was merged into, and cells that had no
 * counterpart fade in. `plan` is the forward plan from `prev` to the stage now
 * on screen. Callers gate on canAnimate.
 */
export function runReverse(
	canvas: HTMLElement,
	prev: Stage,
	plan: Transition,
	marked: Violation[],
): void {
	const token = ++run;
	cancelAnimations(canvas);
	const before = boxes(canvas);
	canvas.replaceChildren(renderStage(prev, marked));
	const after = boxes(canvas);
	const descendant = new Map<string, string>();
	for (const m of plan.moves)
		if (m.survivor || !descendant.has(m.from)) descendant.set(m.from, m.to);
	const opts: KeyframeAnimationOptions = {
		duration: DURATION,
		easing: EASING,
		fill: "backwards",
	};
	const finished: Promise<unknown>[] = [];
	for (const el of canvas.querySelectorAll<HTMLElement>("[data-cell-id]")) {
		const id = el.dataset.cellId ?? "";
		const to = after.get(id);
		const from = before.get(descendant.get(id) ?? "");
		if (!to) continue;
		finished.push(
			el.animate(
				from
					? [
							{
								transform: `translate(${from.x - to.x}px, ${from.y - to.y}px)`,
							},
							{ transform: "none" },
						]
					: [{ opacity: 0 }, { opacity: 1 }],
				opts,
			).finished,
		);
	}
	for (const head of canvas.querySelectorAll<HTMLElement>("figcaption, thead"))
		finished.push(
			head.animate([{ opacity: 0 }, { opacity: 1 }], opts).finished,
		);
	Promise.allSettled(finished).then(() => {
		if (token !== run) return;
		for (const g of canvas.querySelectorAll(".nf-ghost")) g.remove();
	});
}
