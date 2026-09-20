// The step control for a trace figure. It drives both halves — the listing's
// spotlight and the diagram's timed elements — so it lives beside neither.
//
// Nothing here removes anything from the page. A future item keeps its box and
// its place in the accessibility tree; only its presentation changes.

import { button, div, p } from "@davidsouther/jiffies/dom/html.ts";

/** Set to `false` to mount complete instead of animating from the first step. */
const MOUNT_AT_FIRST_STEP = true;

/** Marks a figure whose control bar already exists, so a second mount is a no-op. */
const MOUNTED = "data-trace-mounted";

/** The listing half in both its forms, never the diagram's own `pre`. */
const LISTING = ".highlight-gutters, pre:not(.mermaid)";

/** One `[data-at]` element and the step it belongs to, read once at mount. */
interface TimedElement {
	element: Element;
	at: number;
}

function parseSequence(figure: HTMLElement): number[] {
	return (figure.dataset.traceLines ?? "")
		.split(/\s+/)
		.filter((token) => token.length > 0)
		.map(Number);
}

function collectTimed(figure: HTMLElement): TimedElement[] {
	return [...figure.querySelectorAll("[data-at]")].map((element) => ({
		element,
		at: Number(element.getAttribute("data-at")),
	}));
}

/**
 * The listing's source rows, in either fence's form. The class qualifiers are
 * load-bearing: gutter *band* spans also carry `data-line`, and would be
 * spotlit instead of the line they decorate.
 */
function gutterLines(figure: HTMLElement): HTMLElement[] {
	return [
		...figure.querySelectorAll<HTMLElement>(
			".highlight-gutter-line, .trace-listing-line",
		),
	];
}

/**
 * Writes each path's length into `--trace-draw-length` so the stylesheet can
 * draw it with `stroke-dasharray` instead of guessing. Measured once — the
 * geometry never changes. An engine with no SVG geometry API (jsdom) leaves
 * the property unset and the stylesheet's fallback stands.
 */
function measureDrawLengths(timed: readonly TimedElement[]): void {
	for (const { element } of timed) {
		const geometry = element as SVGGeometryElement;
		if (typeof geometry.getTotalLength !== "function") continue;
		try {
			const length = Math.ceil(geometry.getTotalLength());
			if (length > 0) {
				geometry.style.setProperty("--trace-draw-length", String(length));
			}
		} catch {
			// A path the engine cannot measure keeps the stylesheet's fallback.
		}
	}
}

/** Mounts one figure and returns whether a control bar was added. */
function mountFigure(figure: HTMLElement): boolean {
	const sequence = parseSequence(figure);
	const timed = collectTimed(figure);
	// A mermaid failure leaves the diagram as text, so there is nothing to
	// reveal and the figure must not grow a control bar it cannot drive.
	if (sequence.length === 0 || timed.length === 0) return false;

	const total = sequence.length;
	const lines = gutterLines(figure);
	let warned = false;
	let current = MOUNT_AT_FIRST_STEP ? 1 : total;

	// `role`, `aria-*`, and `disabled` are set as attributes and properties
	// rather than as jiffies attrs: its typed attr map admits none of them.
	const status = p("");
	status.setAttribute("role", "status");
	status.setAttribute("aria-live", "polite");
	const replay = button(
		{ type: "button", class: "trace-stepper-button" },
		"Replay",
	);
	const previous = button(
		{ type: "button", class: "trace-stepper-button" },
		"Previous",
	);
	const next = button(
		{ type: "button", class: "trace-stepper-button" },
		"Next",
	);

	const spotlight = (step: number): string => {
		for (const line of lines) line.removeAttribute("data-state");
		const wanted = sequence[step - 1];
		const index = lines.findIndex(
			(candidate) => Number(candidate.dataset.line) === wanted,
		);
		if (index < 0) {
			// A `steps` entry past the end of the listing is only detectable here:
			// the parser never sees the listing. The figure stays steppable.
			figure.removeAttribute("data-trace-spotlight");
			if (lines.length > 0 && !warned) {
				warned = true;
				console.warn(
					`A trace figure steps listing line ${wanted}, which its listing does not have`,
				);
			}
			return "";
		}
		const line = lines[index];
		line.setAttribute("data-state", "current");
		// Every gutter row is one line box tall, so the sliding spotlight bar is
		// placed from the row's ordinal alone and never has to read layout.
		figure.style.setProperty("--trace-spotlight-index", String(index));
		figure.dataset.traceSpotlight = "";
		return line.textContent?.trim() ?? "";
	};

	/**
	 * Turns the stylesheet's transitions off, or on again. Marks every timed
	 * element, not just the figure: mermaid id-prefixes the diagram's own
	 * stylesheet, so a rule in there cannot reach an ancestor of the SVG.
	 */
	const suppressMotion = (suppressed: boolean): void => {
		if (suppressed) figure.dataset.motion = "none";
		else figure.removeAttribute("data-motion");
		for (const { element } of timed) {
			if (suppressed) element.setAttribute("data-motion", "none");
			else element.removeAttribute("data-motion");
		}
	};

	const show = (step: number): void => {
		const target = Math.min(Math.max(step, 1), total);
		// Only forward motion animates. A backward move — Previous, Replay,
		// ArrowLeft, Home — commits with transitions suppressed, so no arrow
		// un-draws and no value slides back out of its cell.
		const instant = target < current;
		current = target;
		if (instant) suppressMotion(true);

		figure.dataset.step = String(current);
		for (const { element, at } of timed) {
			element.setAttribute(
				"data-state",
				at < current ? "past" : at === current ? "current" : "future",
			);
		}
		const source = spotlight(current);
		status.update(
			source
				? `Step ${current} of ${total} — ${source}`
				: `Step ${current} of ${total}`,
		);
		previous.disabled = current === 1;
		next.disabled = current === total;

		if (instant) {
			// Reading a layout property commits the suppressed frame. Without the
			// flush the browser would compute style once, at the end of this task,
			// with the suppression already lifted — and play the reverse motion.
			void figure.clientHeight;
			suppressMotion(false);
		}
	};

	replay.update({ events: { click: () => show(1) } });
	previous.update({ events: { click: () => show(current - 1) } });
	next.update({ events: { click: () => show(current + 1) } });

	const bar = div({ class: "trace-stepper" }, replay, previous, next, status);
	bar.setAttribute("role", "group");
	bar.setAttribute("aria-label", "Step through the trace");

	// The listener sits on the figure rather than on the bar, so the keys act
	// while focus is anywhere inside the figure — a reader who tabbed into the
	// diagram does not have to reach the buttons first. A key pressed outside
	// the figure never reaches it.
	figure.addEventListener("keydown", (event) => {
		// The listing is a horizontally scrolling box, and the arrow keys are how
		// it scrolls. Inside it the browser's own behaviour wins; stepping stays
		// available from the control bar.
		const target = event.target as Element | null;
		if (target?.closest?.(LISTING) != null) return;
		if (event.key === "ArrowRight") show(current + 1);
		else if (event.key === "ArrowLeft") show(current - 1);
		else if (event.key === "Home") show(1);
		else return;
		event.preventDefault();
	});

	measureDrawLengths(timed);
	figure.dataset.traceSteps = String(total);
	figure.setAttribute(MOUNTED, "");
	// The first step is written while the bar is still detached. A live region
	// populated after it enters the document announces, and a post whose every
	// figure mounts at once would read a step count for each of them before the
	// reader has pressed anything.
	show(current);
	figure.append(bar);
	return true;
}

/**
 * Mounts a step control on every steppable `figure` under `root`, and returns
 * how many there were. Steppable means carrying `data-trace-lines` (written
 * only for a diagram that resolved a sequence) and holding at least one
 * `[data-at]` (present only on a diagram that drew).
 */
export function mountTraceSteppers(root: ParentNode): number {
	let mounted = 0;
	for (const figure of root.querySelectorAll<HTMLElement>(
		"figure[data-trace-lines]",
	)) {
		// A second call on an already-mounted page adds no second bar, but still
		// counts the figure, so the return value is the page's steppable figures.
		if (figure.hasAttribute(MOUNTED) || mountFigure(figure)) mounted += 1;
	}
	return mounted;
}
