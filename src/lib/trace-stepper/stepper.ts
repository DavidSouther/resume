// The step control for a trace figure. It spans both halves of the figure —
// the listing's gutter spotlight and the diagram's timed elements — so it lives
// beside neither, in its own module.
//
// Nothing here removes anything from the page. A future item keeps its box and
// its place in the accessibility tree; only its presentation changes, which is
// what keeps a figure readable with JavaScript off, before mount, on print, and
// after a mermaid failure.

import { button, div, p } from "@davidsouther/jiffies/dom/html.ts";

/**
 * D1: a mounted figure starts at its first execution, because the feature is
 * animation. Set to `false` to mount complete instead — a one-line reversal.
 */
const MOUNT_AT_FIRST_STEP = true;

/** Marks a figure whose control bar already exists, so a second mount is a no-op. */
const MOUNTED = "data-trace-mounted";

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
 * The listing's source rows. The gutter band spans carry `data-line` too, so
 * the class qualifier is what keeps a band from being spotlit instead of the
 * line it decorates.
 */
function gutterLines(figure: HTMLElement): HTMLElement[] {
	return [...figure.querySelectorAll<HTMLElement>(".highlight-gutter-line")];
}

/**
 * Writes each arrow's and strike's drawn length into `--trace-draw-length`, so
 * the stylesheet can draw it with `stroke-dasharray` rather than guess at a
 * dash long enough for the longest path in the diagram.
 *
 * Measured once at mount: the geometry never changes afterwards. An engine
 * with no SVG geometry API — jsdom, and any renderer that failed — leaves the
 * property unset and the stylesheet's fallback stands.
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
	 * Turns the stylesheet's transitions off, or on again. The attribute goes on
	 * every timed element and not on the figure alone, because mermaid prefixes
	 * every selector of the diagram's own stylesheet with the SVG's id: a rule
	 * in there cannot reach up to an ancestor of the SVG.
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
	// listing does not have to reach the buttons first. A key pressed outside
	// the figure never reaches it.
	figure.addEventListener("keydown", (event) => {
		if (event.key === "ArrowRight") show(current + 1);
		else if (event.key === "ArrowLeft") show(current - 1);
		else if (event.key === "Home") show(1);
		else return;
		event.preventDefault();
	});

	measureDrawLengths(timed);
	figure.dataset.traceSteps = String(total);
	figure.append(bar);
	figure.setAttribute(MOUNTED, "");
	show(current);
	return true;
}

/**
 * Mounts a step control on every steppable `figure.trace-figure` under `root`.
 * A figure is steppable when it carries `data-trace-lines` and holds at least
 * one `[data-at]` element. Returns the number of figures mounted.
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
