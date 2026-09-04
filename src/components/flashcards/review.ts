import {
	Alert,
	Card,
	FormGroup,
} from "@davidsouther/jiffies/components/index.ts";
import { Button } from "@davidsouther/jiffies/dom/form/form.ts";
import {
	div,
	p,
	progress,
	small,
	span,
} from "@davidsouther/jiffies/dom/html.ts";
import { Rating } from "../../lib/flashcards/fsrs.ts";
import { buildDeckSelect } from "./deck-select.ts";

const GRADE_LABELS: [grade: number, label: string][] = [
	[Rating.Again, "Again"],
	[Rating.Hard, "Hard"],
	[Rating.Good, "Good"],
	[Rating.Easy, "Easy"],
];

// A plain flex row of independent action buttons, not jiffies-css's
// FormGroup (which fuses adjacent controls into one seamlessly-joined
// segmented row) — grading is four discrete one-shot actions, not a single
// joined control, so a fused-border look would be misleading here.
function buildGradeButtons(): HTMLDivElement {
	const buttons = GRADE_LABELS.map(([grade, label]) => {
		const btn = Button(
			undefined,
			label,
			small({ class: "grade-interval" }, ""),
		);
		btn.dataset.grade = String(grade);
		return btn;
	});
	return div({ class: "review-grades flex row", hidden: true }, ...buttons);
}

/**
 * One face (front or back) of the review flashcard: a jiffies-css elevated
 * Card for the surface, content written straight into its own `<main>` (see
 * browse.ts's buildFlashFace for why — one `<main>`, never nested).
 */
function buildReviewFace(face: "front" | "back"): HTMLElement {
	return Card({ class: `review-face review-${face}` });
}

/**
 * The review-mode panel shell. Empty of card data at render time — client.ts
 * owns picking the due queue (from deck data + localStorage progress) and
 * filling in each face's `<main>` on the card shown.
 */
export function buildReviewView(): HTMLDivElement {
	const startBtn = Button(undefined, "Start review");
	startBtn.classList.add("review-start");
	// A joined picker + go-button pair — jiffies-css's FormGroup fuses them
	// into one segmented row, the sanctioned pattern for exactly this shape.
	const scope = FormGroup(
		{ legend: "Review scope" },
		buildDeckSelect("review-deck-select", "All due cards"),
		startBtn,
	);

	const front = buildReviewFace("front");
	const back = buildReviewFace("back");
	const card = div(
		{ class: "review-card", role: "button" },
		div({ class: "review-card-inner" }, front, back),
	);
	card.setAttribute("aria-label", "Flip card");
	card.tabIndex = 0;

	// A native <progress> — jiffies-css styles this directly, no wrapper div
	// needed. value/max are set as real properties (not via the attrs
	// shorthand): 0 is a valid value but a falsy one, and the attrs runtime
	// treats a falsy input as "remove this attribute."
	const progressBar = progress({ class: "review-progress" });
	progressBar.max = 1;
	progressBar.value = 0;

	const session = div(
		{ class: "review-session", hidden: true },
		progressBar,
		card,
		p(
			{ class: "review-hint" },
			"Click the card or press Space to flip. Then grade it — press 1-4.",
		),
		buildGradeButtons(),
	);

	const empty = Alert(
		{ variant: "info", class: "review-empty", hidden: true },
		"Nothing's due right now. Pick a deck above to get ahead, or come back later.",
	);
	const done = Alert(
		{ variant: "success", class: "review-done", hidden: true },
		p({}, "Session complete."),
		span({ class: "review-done-summary" }, ""),
	);

	// No `hidden` here: app.ts marks this element role="tabpanel", and
	// tabs.css drives its visibility from the tab strip's aria-selected
	// state — jiffies-css's reset gives [hidden] `!important`, which would
	// permanently defeat that regardless of which tab is selected.
	return div({ class: "review-view" }, scope, session, empty, done);
}
