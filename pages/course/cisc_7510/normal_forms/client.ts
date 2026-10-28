// Browser entry for the normal-forms page. The server renders keyframe 0 and
// every narration step; this wires scroll, buttons and arrow keys to one
// current keyframe. Steps between a violates frame and a settled frame animate
// in both directions; a change within one stage only retints the marked
// columns; a multi-step jump repaints with a short fade.

import {
	canAnimate,
	cancelAnimations,
	runMove,
	runReverse,
} from "./animate.ts";
import { buildStages, type Stage } from "./dataset.ts";
import { buildKeyframes, type Keyframe, planTransition } from "./plan.ts";
import { renderStage, setMarked } from "./viewer.ts";

export interface Viewer {
	/** Scrolls the narration to a keyframe, which updates the figure. */
	goTo(index: number): void;
	current(): number;
	destroy(): void;
}

function markedFor(stages: Stage[], frame: Keyframe) {
	return frame.kind === "violates" && frame.target !== undefined
		? stages[frame.target].violates
		: [];
}

function paint(canvas: HTMLElement, stages: Stage[], frame: Keyframe): void {
	canvas.replaceChildren(
		renderStage(stages[frame.stage], markedFor(stages, frame)),
	);
}

/** `csv` defaults to the text page.ts embeds as #nf-data. */
export function mountNormalForms(
	root: HTMLElement,
	csv = document.getElementById("nf-data")?.textContent,
): Viewer {
	if (!csv) throw new Error("missing #nf-data");
	const stages = buildStages(csv);
	const frames = buildKeyframes(stages);
	const canvas = root.querySelector<HTMLElement>(".nf-canvas");
	if (!canvas) throw new Error("missing .nf-canvas");
	const steps = [...document.querySelectorAll<HTMLElement>(".nf-step")];
	const jumps = [...root.querySelectorAll<HTMLElement>("[data-nf-jump]")];
	let index = 0;
	// Suppress the observer while a programmatic smooth scroll runs.
	let lockUntil = 0;
	const abort = new AbortController();
	const { signal } = abort;

	const mark = (): void => {
		root.dataset.keyframe = String(index);
		for (const [i, s] of steps.entries())
			s.classList.toggle("active", i === index);
		const stage = frames[index].stage;
		const prev = root.querySelector<HTMLButtonElement>("[data-nf-prev]");
		const next = root.querySelector<HTMLButtonElement>("[data-nf-next]");
		if (prev) prev.disabled = index === 0;
		if (next) next.disabled = index === frames.length - 1;
		for (const j of jumps) {
			const target = frames[Number(j.dataset.nfJump)];
			j.setAttribute("aria-current", String(target.stage === stage));
		}
	};

	const goTo = (next: number): void => {
		const to = Math.max(0, Math.min(frames.length - 1, next));
		if (to === index) return;
		const from = frames[index];
		const dest = frames[to];
		const forwardMove =
			to === index + 1 && from.kind === "violates" && dest.kind === "settled";
		const backwardMove =
			to === index - 1 && from.kind === "settled" && dest.kind === "violates";
		index = to;
		mark();
		// Bring the table view back to its top while the next stage animates in.
		canvas.scrollTo?.({
			top: 0,
			left: 0,
			behavior: canAnimate(canvas) ? "smooth" : "auto",
		});
		if (from.stage === dest.stage) {
			setMarked(canvas, markedFor(stages, dest));
			return;
		}
		if (forwardMove && canAnimate(canvas)) {
			runMove(
				canvas,
				stages[dest.stage],
				planTransition(stages[from.stage], stages[dest.stage]),
			);
			return;
		}
		if (backwardMove && canAnimate(canvas)) {
			runReverse(
				canvas,
				stages[dest.stage],
				planTransition(stages[dest.stage], stages[from.stage]),
				markedFor(stages, dest),
			);
			return;
		}
		cancelAnimations(canvas);
		paint(canvas, stages, dest);
		if (canAnimate(canvas))
			canvas.animate([{ opacity: 0.4 }, { opacity: 1 }], { duration: 250 });
	};

	let releaseTimer: ReturnType<typeof setTimeout> | undefined;
	const release = (): void => {
		lockUntil = 0;
		clearTimeout(releaseTimer);
	};

	const jumpTo = (next: number): void => {
		lockUntil = Number.POSITIVE_INFINITY;
		window.addEventListener("scrollend", release, { once: true, signal });
		// Fallback for browsers without scrollend and for jumps that do not scroll.
		// A newer jump replaces an older fallback so it cannot release this lock early.
		clearTimeout(releaseTimer);
		releaseTimer = setTimeout(release, 1500);
		goTo(next);
		steps[Math.max(0, Math.min(frames.length - 1, next))]?.scrollIntoView({
			behavior: canAnimate(canvas) ? "smooth" : "auto",
			block: "start",
		});
	};

	root.addEventListener(
		"click",
		(e) => {
			const t = (e.target as HTMLElement).closest<HTMLElement>("button");
			if (!t) return;
			if (t.hasAttribute("data-nf-prev")) jumpTo(index - 1);
			else if (t.hasAttribute("data-nf-next")) jumpTo(index + 1);
			else if (t.dataset.nfJump !== undefined) jumpTo(Number(t.dataset.nfJump));
		},
		{ signal },
	);

	document.addEventListener(
		"keydown",
		(e) => {
			if (
				e.target instanceof Element &&
				e.target.closest(
					"input, textarea, select, [contenteditable], .nf-canvas",
				)
			)
				return;
			if (e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
			const before = index;
			if (e.key === "ArrowRight" || e.key === "ArrowDown") jumpTo(index + 1);
			else if (e.key === "ArrowLeft" || e.key === "ArrowUp") jumpTo(index - 1);
			else return;
			if (index !== before) e.preventDefault();
		},
		{ signal },
	);

	// The figure is sticky at the top, and each step snaps just below it. The
	// observer watches a thin band under the figure, so the step crossing that
	// line is the active one. --nf-fig-h also feeds the snap offset and the
	// sticky card offset in page.ts.
	const BAND = 8;
	let io: IntersectionObserver | undefined;
	const layout = (): void => {
		const figH = root.offsetHeight;
		document.documentElement.style.setProperty("--nf-fig-h", `${figH}px`);
		if (typeof IntersectionObserver !== "function") return;
		io?.disconnect();
		const top = figH + BAND;
		const bottom = Math.max(0, window.innerHeight - top - 2);
		io = new IntersectionObserver(
			(entries) => {
				if (performance.now() < lockUntil) return;
				for (const entry of entries)
					if (entry.isIntersecting)
						goTo(steps.indexOf(entry.target as HTMLElement));
			},
			{ rootMargin: `-${top}px 0px -${bottom}px 0px` },
		);
		for (const s of steps) io.observe(s);
	};
	layout();
	window.addEventListener("resize", layout, { signal });
	if (typeof ResizeObserver === "function") {
		const ro = new ResizeObserver(layout);
		ro.observe(root);
		signal.addEventListener("abort", () => ro.disconnect());
	}
	signal.addEventListener("abort", () => {
		io?.disconnect();
		document.documentElement.classList.remove("nf-snap");
	});

	// Scrolling back above the first step leaves no step on the observer line.
	window.addEventListener(
		"scroll",
		() => {
			const top = steps[0]?.getBoundingClientRect().top;
			document.documentElement.classList.toggle(
				"nf-snap",
				top <= root.offsetHeight + BAND + 2,
			);
			if (performance.now() < lockUntil) return;
			if (steps[0]?.getBoundingClientRect().top > root.offsetHeight + BAND + 2)
				goTo(0);
		},
		{ signal, passive: true },
	);

	mark();
	return { goTo: jumpTo, current: () => index, destroy: () => abort.abort() };
}

// Skip auto-mount outside a browser, e.g. under node or jsdom tests.
const root =
	typeof document === "undefined" ? null : document.getElementById("nf-figure");
if (root) mountNormalForms(root);
