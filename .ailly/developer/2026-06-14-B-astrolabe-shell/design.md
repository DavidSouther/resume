# F1: Astrolabe Shell & Case — Feature Design

**Feature:** F1 `astrolabe-shell` (first of three in the Astrolabe Watch project loop)
**Project plan:** `.ailly/developer/2026-06-14-A-astrolabe/plan.md`
**Project design:** `.ailly/developer/2026-06-14-A-astrolabe/design.md`
**Feature test:** `src/components/astrolabe/shell.feature.test.ts`
**Release gate:** `/astrolabe/` ships dark — F1 does NOT touch `scripts/sitemap.ts` and adds no nav link.

---

## Purpose

Stand up the `/astrolabe/` route as an empty luxury watch: a portrait case and strap framing an empty dial container, with the controls sheet and `#debug` harness every later feature plugs into. F1 owns the four shared contracts the project settles at "Step 0" and produces them as real, importable code so F2 and F3 build against fixed surfaces rather than guesses. The watch reads as a watch (case, strap, framing, fonts, tokens) before any astronomy exists. No bodies, no math, no motion, no Realtime/Fast button — those are F2 and F3.

## Prior Art

See the project design (`2026-06-14-A-astrolabe/design.md` § Prior Art) for the full list. Feature-relevant items only: the in-repo `PageModule` shape (`pages/page.ts`, `pages/trips/[id]/page.ts`), `src/lib/page-head.ts` (`pageHead` returns `Node[]`, spread then extended), the `src/components/trip/icons.ts` factory-plus-`innerHTML` idiom for prebaked SVG decoration, the jiffies CSS components (`Card`/`Panel`, `Accordion`, `PropertySheet`, `FormGroup`, `StaticTabList`, `Switches`), and the CSS-token convention in `src/global.css` (`@layer theme` `:root` blocks). The Patek 4997/200G finish reference and the visual spec's case-and-strap brief (`.ailly/prompts/astrolabe` § Case and strap) drive the platinum/cordovan tokens.

## User Journey & Metrics

**This feature's slice.** A reader opens `/astrolabe/` cold. A portrait watch fills the width: a mahogany cordovan strap above and below a platinum case, the case holding a deep-midnight empty dial. Below the case sits an always-visible controls sheet. With the `#debug` URL hash, a material section appears in that sheet exposing case-finish and strap-finish options; changing one repaints the case or strap immediately (tokens written via `element.style.setProperty`). Nothing on the dial moves or appears, because no body or astronomy exists yet.

**Closing Bell tasks advanced.** T1 (recognize it — case presence and portrait framing) and the case/material half of T5 (change the look — material toggles under `#debug`). F1 stands up the controls sheet that T5 depends on across all three features.

**Acceptable operating constraints (feature slice).**
- *First paint carries content.* The statically generated HTML ships the case, strap, and empty dial container with no client JS required to see the watch frame.
- *Reach.* The portrait figure fills the width on a phone; the dial container is square so F2's `viewBox="-500 -500 1000 1000"` SVG drops in without reflow.
- *Extensibility (the session goal).* Later features add controls by calling `registerControlsSection`, never by editing F1 markup. The `#debug` material section is the worked example of a comprehensive, well-organized debug panel for F1's surface.
- *Dark gate.* No sitemap entry, no nav link; the route is built into `docs/` unlisted.

## Specification

F1 is the route, the case/strap figure, the empty dial container, the controls registry, the material debug section, and the token declarations. Components live under `src/components/astrolabe/`; shared math/helper surfaces under `src/lib/`; the route under `pages/astrolabe/`.

### Files this feature creates

| Path | Responsibility |
|---|---|
| `pages/astrolabe/page.ts` | The `/astrolabe/` route. `PageModule` with `head` and `default`. `head()` returns `[...pageHead("Astrolabe — David Souther"), <Cormorant Garamond link>, <DM Mono link>]`. `default()` returns `Astrolabe()`. |
| `src/components/astrolabe/astrolabe.ts` | `Astrolabe(): Element` — the top-level SHELL. Returns the `<figure>` wrapper `[strap]/[platinum case → empty dial container]/[strap]` plus the controls sheet. Registers the F1 material section (calls `registerControlsSection`) then mounts `ControlsSheet()`. NO bodies, NO SVG dial content, NO Realtime/Fast button. |
| `src/components/astrolabe/case.ts` | `WatchCase(dial: Element): Element` — the portrait `<figure>` with strap-top, platinum case wrapping the passed dial container, strap-bottom. Prebaked decoration via the `icons.ts` factory-plus-`innerHTML` idiom where raw SVG/markup is needed. Reads `--case-platinum`, `--strap-cordovan`, `--strap-stitch` from CSS. |
| `src/components/astrolabe/dial-container.ts` | `DialContainer(): Element` — the empty square host element at the (1) coordinate contract. F2 mounts its `<svg viewBox="-500 -500 1000 1000">` here. Carries a stable hook (e.g. `data-astrolabe-dial` / class) F2 targets; renders `--dial-midnight` ground. |
| `src/components/astrolabe/controls.ts` | Owns Contract (2). Exports `interface ControlsSection { id; title; render(): Node \| Node[]; debugOnly: boolean }`, `registerControlsSection(section): void`, and `ControlsSheet(): Element`. Internal module-level ordered registry, idempotent on `id`. `ControlsSheet` builds a `Card`/`Panel` of `Accordion` sections in registration order; `debugOnly` sections render only when the `#debug` hash is present. |
| `src/components/astrolabe/material-section.ts` | The F1 contributed material section (a `ControlsSection`, `debugOnly: true`). Its `render()` returns case-finish and strap-finish controls (jiffies `FormGroup`/`PropertySheet`/`StaticTabList`/`Switches`) that write `--case-platinum`, `--strap-cordovan`, related tokens via `element.style.setProperty`. |
| `src/lib/astro-tokens.ts` | Owns Contracts (3) and (4) on the TS side. Exports `BodyName` (re-export point for F2's `astro-math.ts` to align with — F1 declares the color-token NAMES and `bodyColorVar`), and `bodyColorVar(body: BodyName): \`--color-${BodyName}\``. Material-token name constants live here too so the material section and CSS share one source. |
| `src/global.css` (append) | Declares Contracts (3) and (4) on the CSS side: `--color-sun`…`--color-neptune` plus `--case-platinum`, `--strap-cordovan`, `--strap-stitch`, `--dial-midnight`, `--lacquer-depth`, in an `@layer theme` `:root` block matching the existing convention. |

### How F1 produces the shared contracts

- **(1) Coordinate container.** `DialContainer()` is an empty square host with a stable selector hook. F1 declares no SVG; it guarantees the slot F2 fills at `viewBox="-500 -500 1000 1000"`.
- **(2) Controls-sheet registration.** `controls.ts` finalizes the section type exactly as `{ id: string; title: string; render(): Node | Node[]; debugOnly: boolean }`, owns the ordered, id-idempotent registry, and gates `debugOnly` on the `#debug` hash. F1 is the first caller (material section); F2/F3 append theirs.
- **(3) Color tokens.** Names declared once in `global.css`; `bodyColorVar(body)` in `astro-tokens.ts` maps a `BodyName` to its `--color-${body}` property name. No body is rendered in F1 — only the token surface exists.
- **(4) Finish & material tokens.** Platinum/cordovan/stitch/midnight/lacquer declared once in `global.css`; the material debug section writes them via `setProperty`.

### How F1 consumes the shared contracts

None. F1 settles all four.

### Challenges

- **`#debug` gating in a static page.** The page is SSG-generated; `debugOnly` sections are decided client-side off `location.hash`. `ControlsSheet` reads the hash at construction (and may re-evaluate on `hashchange`); the always-visible sections render unconditionally. The feature test exercises both states deterministically (see below).
- **Token single-source.** Material-token names appear in both `global.css` and the material section's `setProperty` calls. `astro-tokens.ts` holds the names as constants so the two stay in lock-step; a renamed token breaks the import, not silently the styling.
- **Empty-but-sized dial.** The container must be square and width-filling on a phone so F2's fixed-aspect SVG mounts without reflow; this is a CSS-aspect concern verified visually later, structurally asserted now (the hook exists and is empty).

## Alternatives (feature-local)

- **One monolithic `astrolabe.ts`.** Rejected. The session goal is clean, composable modules; splitting case / dial-container / controls / material-section / tokens keeps each file small and lets F2/F3 import the registry without dragging in shell markup.
- **Controls sheet with hard-coded sections (no registry).** Rejected — it is the contract F2/F3 depend on. The registry is the whole point of Contract (2); F1 must ship it working with one real section, not a stub.
- **Prebaked raster image for the entire case+strap.** The research/plan allow a "prebaked static image" for strap/case decoration. F1 uses inline SVG/CSS decoration via the `icons.ts` idiom rather than a binary asset, so the material tokens are live-tunable under `#debug` (a raster can't be retinted by `setProperty`). A raster remains an option for the strap's domed-luster photo texture if CSS proves insufficient; deferred to build judgment, not a contract change.
- **Gate `#debug` on a query param instead of the hash.** Rejected — the research and plan fix the `#debug` URL hash as the convention all three features share.

## Summary

Deferred (parked to the F1 cleanup `TASKS.md`):
- Exact token color values (oklch tuning of platinum/cordovan/midnight and the gold Sun) — set at build, refined visually in later sessions.
- Whether the strap's domed-luster texture needs a raster asset vs pure CSS — a build-time visual call, no contract impact.
- The `hashchange` live-toggle of `#debug` sections (re-render on hash change) vs read-once-at-construction — a build refinement; the contract only requires correct gating at construction.
- Comprehensive material controls beyond case/strap finish (e.g. bezel polish, stitch density) — F1 ships the worked example; the debug panel grows as the product is refined in later sessions.

**Feature test:** `src/components/astrolabe/shell.feature.test.ts` (recorded above; the one executable acceptance test that stays red until F1 is built).
