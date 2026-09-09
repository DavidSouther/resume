# Deck data

Deck content is data, not code: plain YAML files under `public/_flashcards/`
(so, once deployed, at `https://davidsouther.com/_flashcards/<slug>.yaml`),
loaded at runtime rather than compiled into the app. The app never has a
compile-time dependency on any deck's content — only on the `Note` shape
(`../anki-types.ts`) and the manifest below.

YAML over JSON here because a deck is hand-authored and hand-reviewed
content, not machine-generated output — block scalars (`|-`) keep a note's
multi-line HTML `Front`/`Back` readable in a diff, and unquoted plain
scalars keep short fields free of JSON's mandatory quoting. Parsing goes
through the `yaml` package (already a devDependency, used server-side at
build time and bundled into the client build — see load-server.ts /
load-client.ts) rather than hand-rolled parsing; its pure-JS browser build
has no `node:*` or JSON-import dependencies, so Rollup's client bundler
(see @davidsouther/jiffies' `ssg/bundle.js`, which has no JSON-import
plugin) resolves and bundles it directly, with no CDN `<script>` needed.

The `Note` shape mirrors AnkiConnect's `notesInfo`/`addNote` JSON on purpose:
a real Anki export (or an AnkiConnect dump, converted to this shape) can be
served from the same place as any other deck.

## How loading works

- `manifest.ts` — `DECK_MANIFEST`: the list of decks this app knows about,
  each just `{ slug, title, url }`. This is the only place a new deck gets
  registered.
- `load-server.ts` — used at SSG build time: `loadAllDecks` by
  `pages/flashcards/page.ts` (the deck-picker hub, which needs every deck's
  card count) and `loadDeck(slug)` by `pages/flashcards/[slug]/page.ts` (one
  deck's own Browse/Review page, which needs only its own notes). Reads each
  deck's YAML straight off disk (the build already has `public/`'s contents
  locally, so there's no reason to loop back over the network for them) and
  parses it with `yaml`'s `parse`.
- `load-client.ts` — the browser-side counterpart, used by
  `components/flashcards/client.ts`. Its `loadDeck(slug)` `fetch`es that one
  deck's `url` over the network — same-origin by default, but nothing stops
  a manifest entry pointing at a different origin, CORS permitting — and
  parses the response text with the same `yaml` package, bundled into the
  client build. `loadAllDecks` also exists here for symmetry but has no
  current caller: the browser only ever needs the one deck its page is for.
- `parse.ts` — both loaders run parsed YAML through `parseDeckNotes`, which
  parses each entry into a `Note` (defaulting `modelName` to `"Basic"` when
  absent) and drops (with a warning) whatever doesn't parse, instead of
  taking down the whole app on one bad note. Deck data can come from
  anywhere; treat it accordingly.

Two loader modules, not one, because they need different runtimes: the
server one imports `node:fs`, which the browser bundle can't (and shouldn't
try to) resolve; the client one uses `fetch`, which doesn't exist at SSG
build time. Never import `load-server.ts` from client-side code or vice
versa.

## Routing

Each deck gets its own static page at `/flashcards/<slug>/`
(`pages/flashcards/[slug]/page.ts`, a dynamic SSG route whose
`generateStaticParams` enumerates `DECK_MANIFEST`) — Browse and Review
scoped to exactly that deck's cards, never several decks merged into one
pool. `/flashcards/` itself (`pages/flashcards/page.ts`) is a deck picker:
one tile per manifest entry, linking to its page. See
`../deck-outline.ts` for how each deck's own group/section reading order is
determined (an authored fixed order for decks that want one, like Rust's;
derived from the data itself otherwise).

## Adding a deck

1. Produce a `Note[]` — by hand, by script, or converted from an Anki
   export — and save it as `public/_flashcards/<slug>.yaml`.
2. Add one entry to `DECK_MANIFEST` in `manifest.ts`:
   `{ slug, title, url: "/_flashcards/<slug>.yaml" }`.

That's it — the deck gets its own `/flashcards/<slug>/` page and a tile on
the `/flashcards/` hub automatically (see "Routing" above); nothing else
names a specific deck. `slug` becomes part of the deck's localStorage keys
(`flashcards:progress:v1:<slug>`, `flashcards:annotations:v1:<slug>`) — keep
it stable once a deck ships, so people's review history doesn't reset.

## `rust-cheat-sheet.yaml`

Sourced from [cheats.rs](https://cheats.rs) ("Rust Language Cheat Sheet" by
Ralf Biedert and contributors), whose content is licensed CC-BY with Rust
code snippets separately licensed CC-0. Card explanations here are
paraphrased rather than transcribed (as the license expects of a
reproduction); adapted Rust code snippets are used freely as CC-0 material.
This deck is an unofficial derivative study aid — it is not affiliated with,
endorsed by, or controlled by cheats.rs or its author.

It was authored by reading cheats.rs's raw source content (its GitHub repo,
`ralfbiedert/cheats.rs`, `content/_index.md`) section by section and writing
one note per genuinely distinct, testable fact — a syntax form, a semantic
distinction, a gotcha, an "X vs Y" comparison. Deck names follow cheats.rs's
own section hierarchy under a `Rust Cheat Sheet::` root, using Anki's `::`
hierarchy separator. Field text is HTML, matching how Anki fields are
normally authored — deliberately not run through this repo's own markdown
renderer (`../render.ts`), which would corrupt the many fields containing
literal Rust `{ ... }` syntax (see that file's doc comment for exactly why).
`../render.ts` is there for a deck whose fields are markdown prose without
that collision; it's a choice made per deck, not a universal pass every
field goes through.

Regenerating this file (e.g. after an upstream content change) means
re-running that authoring pass against the updated source and re-merging the
result — there's no mechanical script to rerun, since the authoring step
itself is a reading-comprehension task.
