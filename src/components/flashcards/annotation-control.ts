import { Button } from "@davidsouther/jiffies/dom/form/form.ts";
import { div, textarea } from "@davidsouther/jiffies/dom/html.ts";

/**
 * An "Annotate this card" control: a toggle button that reveals a small
 * note form (what's wrong with this card, plus save/remove/cancel).
 * Structural only, like the rest of this directory — client.ts owns
 * opening/closing the form and reading/writing the annotation itself (see
 * lib/flashcards/annotations.ts). One instance lives per browse tile
 * (browse.ts, cardId fixed at build time, icon-only — real estate on a
 * tile is tight); one shared instance lives in the review panel
 * (review.ts, labeled, alongside the grade buttons), retargeted by
 * client.ts at whichever card is currently showing.
 */
export function buildAnnotationControl(
	toggleLabel = "📝 Annotate",
): HTMLDivElement {
	const toggle = Button(undefined, toggleLabel);
	toggle.classList.add("annotation-toggle");
	toggle.type = "button";
	toggle.setAttribute("aria-label", "Annotate this card");

	const note = textarea({
		class: "annotation-note",
		rows: 2,
		placeholder: "What's wrong with this card?",
	});
	note.setAttribute("aria-label", "Annotation note");

	const save = Button(undefined, "Save annotation");
	save.classList.add("annotation-save");
	save.type = "button";

	const clear = Button(undefined, "Remove annotation");
	clear.classList.add("annotation-clear");
	clear.type = "button";
	clear.hidden = true;

	const cancel = Button(undefined, "Cancel");
	cancel.classList.add("annotation-cancel");
	cancel.type = "button";

	const form = div(
		{ class: "annotation-form", hidden: true },
		note,
		div({ class: "annotation-form-actions flex row" }, save, clear, cancel),
	);

	return div({ class: "annotation-control" }, toggle, form);
}
