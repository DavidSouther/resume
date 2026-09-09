import {
	Alert,
	Card,
	Chip,
	Panel,
} from "@davidsouther/jiffies/components/index.ts";
import { Button } from "@davidsouther/jiffies/dom/form/form.ts";
import {
	a,
	div,
	form,
	h2,
	h3,
	input,
	li,
	p,
	ul,
} from "@davidsouther/jiffies/dom/html.ts";

export interface HubDeck {
	slug: string;
	title: string;
	cardCount: number;
}

/**
 * One deck's tile on the /flashcards/ picker: the whole tile is a link to
 * /flashcards/<slug>/ (a static page — see pages/flashcards/[slug]/), not a
 * button with a client-side handler, so it's a plain crawlable/bookmarkable
 * anchor with no JS required to navigate.
 */
function buildDeckTile(deck: HubDeck): HTMLElement {
	const link = a({ href: `/flashcards/${deck.slug}/`, class: "hub-deck-link" });
	link.append(
		Card(
			{ class: "hub-deck-card" },
			h2({}, deck.title),
			p({}, Chip({ variant: "neutral" }, `${deck.cardCount} cards`)),
		),
	);
	return link;
}

/**
 * "Bring your own deck": a URL to a JSON/YAML note array, fetched and
 * rendered entirely client-side by hub-client.ts (see its doc comment for
 * why this can't be a static /flashcards/<slug>/ page like a registered
 * deck gets — the SSG has to know every route at build time, and an
 * arbitrary URL isn't known until someone pastes one in).
 *
 * A real `<form method="get">`, not a JS click handler: submitting it is an
 * ordinary navigation to `/flashcards/?deck=<url>`, so the URL is always
 * shareable/bookmarkable and it degrades to "at least the link is right"
 * without JS. hub-client.ts's whole job is reading that `deck` query param
 * on page load, fetching/parsing it, and mounting the result into
 * `.hub-external-mount` — no submit handler to wire here.
 */
function buildExternalDeckForm(): HTMLElement {
	const urlInput = input({
		class: "hub-external-url",
		type: "url",
		name: "deck",
		placeholder: "https://example.com/my-deck.yaml",
		required: true,
	});
	urlInput.setAttribute("aria-label", "Deck URL");

	const loadBtn = Button(undefined, "Load deck");
	loadBtn.classList.add("hub-external-load");
	loadBtn.type = "submit";

	const loadForm = form(
		{
			action: "/flashcards/",
			method: "get",
			class: "hub-external-form flex row",
		},
		urlInput,
		loadBtn,
	);

	const status = Alert(
		{ variant: "error", class: "hub-external-status", hidden: true },
		"",
	);

	return div(
		{ class: "hub-external" },
		h3({}, "Bring your own deck"),
		p(
			{ class: "hub-external-hint" },
			"Paste a URL to a JSON or YAML array of notes in this app's shape — see “Where to find decks” below.",
		),
		loadForm,
		status,
		div({ class: "hub-external-mount" }),
	);
}

/**
 * Where a URL for "bring your own deck" (above) might come from. This app
 * only reads plain JSON/YAML note arrays — not a raw Anki .apkg export
 * (a zipped SQLite database, a different format) — so the practical path is
 * exporting through AnkiConnect, which speaks nearly this exact shape.
 */
function buildResources(): HTMLElement {
	return Panel(
		{ class: "hub-resources", header: h2({}, "Where to find decks") },
		p(
			{},
			"Any URL that returns a JSON or YAML array of notes — ",
			"noteId, modelName, deckName, fields, tags — works with ",
			"“Bring your own deck” above. That's the same shape ",
			"AnkiConnect's own notesInfo action returns, not a raw .apkg ",
			"file (a zipped SQLite database, a different format this app ",
			"doesn't read directly).",
		),
		ul(
			{},
			li(
				{},
				a(
					{ href: "https://foosoft.net/projects/anki-connect/" },
					"AnkiConnect",
				),
				" — run its ",
				"notesInfo",
				" action against a local Anki deck, save the result as JSON, ",
				"and host it somewhere with CORS enabled (a GitHub Gist's ",
				"raw URL or a raw.githubusercontent.com link both work).",
			),
			li(
				{},
				a(
					{ href: "https://ankiweb.net/shared/decks" },
					"AnkiWeb's shared decks",
				),
				" — browse existing community decks for inspiration, then ",
				"convert the cards you want through AnkiConnect as above.",
			),
		),
	);
}

/**
 * The /flashcards/ deck picker: one tile per registered deck (see
 * decks/manifest.ts), each linking to its own Browse/Review page, plus a
 * "bring your own deck" loader for anyone else's Anki-shaped notes and a
 * pointer to where to find some. Studying a registered deck always happens
 * scoped to just that deck (see app.ts's buildFlashcardsApp); an external
 * deck gets the same treatment, just mounted inline here instead of on its
 * own page (see hub-client.ts).
 */
export function buildFlashcardsHub(decks: HubDeck[]): HTMLDivElement {
	const grid = div(
		{ class: "hub-grid" },
		...decks.map((d) => buildDeckTile(d)),
	);
	const view = div(
		{ class: "hub-view" },
		p({ class: "hub-intro" }, "Pick a cheat sheet to browse or review."),
		grid,
		buildExternalDeckForm(),
		buildResources(),
	);
	view.setAttribute("role", "region");
	view.setAttribute("aria-label", "Cheat sheets");
	return view;
}
