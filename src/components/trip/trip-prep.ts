import { Panel } from "@davidsouther/jiffies/components/card.ts";
import {
	a,
	h2,
	li,
	mark,
	p,
	small,
	ul,
} from "@davidsouther/jiffies/dom/html.ts";
import type {
	PrepItem,
	PrepStatus,
	TripEnrichment,
} from "../../lib/trip-enrichment";
import type { Itinerary } from "../../lib/trip-itinerary";
import {
	type DeadlineState,
	deadlineState,
	stalenessBand,
} from "../../lib/trip-prep.ts";

// Humanized PrepStatus labels. The raw token is also emitted as `data-status`
// so the status is observable both ways (text and attribute).
const STATUS_LABEL: Record<PrepStatus, string> = {
	action_needed: "Action needed",
	in_progress: "In progress",
	done: "Done",
	no_action: "No action",
};

const DEADLINE_LABEL: Record<DeadlineState, string | null> = {
	ok: null,
	warn: "Deadline approaching",
	overdue: "Past deadline",
};

// Apply data-* attributes to an already-built element. The jiffies `Attrs` type
// only models known element properties, so arbitrary `data-` keys can't be
// passed through the builder's attrs object; setAttribute carries them through
// at runtime (the same path update() takes for any string attribute).
function withData(
	el: HTMLElement,
	data: Record<string, string | undefined>,
): HTMLElement {
	for (const [key, value] of Object.entries(data)) {
		if (value != null) el.setAttribute(`data-${key}`, value);
	}
	return el;
}

function PrepItemView(
	item: PrepItem,
	departure: string,
	today: Date,
): HTMLElement {
	const status = item.status;
	const statusBadge = status
		? withData(mark(STATUS_LABEL[status]), { status })
		: null;

	const deadline = deadlineState(item, departure, today);
	const deadlineNote = DEADLINE_LABEL[deadline];

	return withData(
		li(
			statusBadge,
			item.url
				? a(
						{ href: item.url, rel: "noopener noreferrer", target: "_blank" },
						item.label,
					)
				: item.label,
			item.detail ? small(item.detail) : null,
			deadlineNote ? withData(small(deadlineNote), { deadline }) : null,
		),
		{ status },
	);
}

// "Before you go" advisory panel. Returns null when `enrichment.trip_prep` is
// absent (failure-silent, design Metric 1) so TripPage can omit the section
// entirely — mirroring how page_cards/destinations degrade.
//
// Built with jiffies Panel (section > header/main/footer). The "Before you go"
// h2 sits in the header slot, so the heading's nearest enclosing <section> is
// the Panel wrapper. The checklist renders as a <ul> inside <main>; each item
// with a `url` emits an <a href>, and each surfaces its PrepStatus both as
// humanized <mark> text and as a `data-status` attribute.
//
// Freshness (Metric 3) is shown as <small> text plus a `data-checked-on`
// attribute — NEVER a bare `<time datetime="YYYY-MM-DD">`, which the feature
// test counts as a day group.
export function TripPrep(attrs: {
	itinerary: Itinerary;
	enrichment?: TripEnrichment;
	today?: Date;
}): HTMLElement | null {
	const { itinerary, enrichment, today = new Date() } = attrs;
	const prep = enrichment?.trip_prep;
	if (!prep) return null;

	const departure = String(itinerary.trip.start_date).slice(0, 10);

	const freshness =
		prep.checked_on != null
			? (() => {
					const band = stalenessBand(prep.checked_on, departure, today);
					return withData(
						small(
							`Checked ${prep.checked_on}${band === "stale" ? " · re-check before departure" : ""}`,
						),
						{ "checked-on": prep.checked_on, staleness: band },
					);
				})()
			: null;

	const checklist = prep.checklist ?? [];

	return Panel(
		{
			class: "TripPrep",
			header: [h2("Before you go"), freshness],
		},
		prep.summary ? p(prep.summary) : null,
		checklist.length
			? ul(...checklist.map((item) => PrepItemView(item, departure, today)))
			: null,
		prep.notes?.length ? ul(...prep.notes.map((note) => li(note))) : null,
	);
}
