import { Card } from "@davidsouther/jiffies/components/card.ts";
import {
	a,
	details,
	h2,
	li,
	mark,
	p,
	small,
	summary,
	ul,
} from "@davidsouther/jiffies/dom/html.ts";
import type {
	PrepItem,
	PrepStatus,
	TripEnrichment,
} from "../../lib/trip-enrichment";
import type { Itinerary } from "../../lib/trip-itinerary";
import {
	anyActionNeeded,
	deadlineDate,
	formatPrepDate,
} from "../../lib/trip-prep.ts";

// Humanized PrepStatus labels. The raw token is also emitted as `data-status`
// so the status is observable both ways (text and attribute).
const STATUS_LABEL: Record<PrepStatus, string> = {
	action_needed: "Action needed",
	no_action: "No action",
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

// One checklist item. An `action_needed` item surfaces a humanized <mark> badge
// (with data-status); a `no_action` item renders no badge (design §2). A `url`
// links out to its authoritative government source. An item carrying
// `lead_time_days` shows its apply-by deadline as an ABSOLUTE date ("Apply by 4
// July 2026"), derived from departure − lead_time_days (no relative phrasing).
function PrepItemView(item: PrepItem, departure: string): HTMLElement {
	const status = item.status;
	const statusBadge =
		status === "action_needed"
			? withData(mark(STATUS_LABEL[status]), { status })
			: null;

	const deadline =
		item.lead_time_days != null
			? small(`Apply by ${deadlineDate(departure, item.lead_time_days)}`)
			: null;

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
			deadline,
		),
		{ status },
	);
}

// "Before you go" advisory Card. Returns null when `enrichment.trip_prep` is
// absent (failure-silent, design Metric 1) so TripPage can omit the region
// entirely — mirroring how page_cards/destinations degrade.
//
// Built with jiffies Card (article > main). The body is a single <details>
// rendered WITHOUT the `open` attribute (collapsed by default). The <details>'s
// <summary> carries the "Before you go" h2, an aggregate "Action needed" <mark>
// badge (only when any item needs action), and the absolute checked date
// "Checked 7 June 2026" (raw ISO retained as data-checked-on for machine
// observation). The revealed body holds the summary <p>, the checklist <ul>,
// and the notes <ul>. The render path is fully clock-independent (every date is
// absolute), so no `today` is injected — design §3.
export function TripPrep(attrs: {
	itinerary: Itinerary;
	enrichment?: TripEnrichment;
}): HTMLElement | null {
	const { itinerary, enrichment } = attrs;
	const prep = enrichment?.trip_prep;
	if (!prep) return null;

	const departure = String(itinerary.trip.start_date).slice(0, 10);

	const freshness =
		prep.checked_on != null
			? withData(small(`Checked ${formatPrepDate(prep.checked_on)}`), {
					"checked-on": prep.checked_on,
				})
			: null;

	const checklist = prep.checklist ?? [];

	const actionBadge = anyActionNeeded(checklist)
		? withData(mark("Action needed"), { status: "action_needed" })
		: null;

	return Card(
		{ class: "TripPrep" },
		details(
			summary(h2("Before you go"), actionBadge, freshness),
			prep.summary ? p(prep.summary) : null,
			checklist.length
				? ul(...checklist.map((item) => PrepItemView(item, departure)))
				: null,
			prep.notes?.length ? ul(...prep.notes.map((note) => li(note))) : null,
		),
	);
}
