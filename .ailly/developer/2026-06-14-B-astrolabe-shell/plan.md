# Implementation Plan: F1 — Astrolabe Shell & Case

**Feature test:** `src/components/astrolabe/shell.feature.test.ts`
**Feature design:** `.ailly/developer/2026-06-14-B-astrolabe-shell/design.md`
**Project plan:** `.ailly/developer/2026-06-14-A-astrolabe/plan.md`
**Release gate:** `/astrolabe/` ships DARK — do NOT touch `scripts/sitemap.ts`, add no nav link.

**User story:** A reader opens `/astrolabe/` cold and sees a portrait luxury watch — a platinum case and cordovan strap framing an empty midnight dial container — with an always-visible controls sheet whose `#debug` material section retints the case and strap live, and no astronomy, motion, or Realtime/Fast button yet.

**Steps:**

- [ ] Step 0: API surface area (stubs for every module the feature test and shared contracts require)
- [ ] Step 1: Token surface — `astro-tokens.ts` + the `global.css` token block (Contracts 3 & 4)
- [ ] Step 2: Controls registry — `registerControlsSection` / `ControlsSheet` with `#debug` gating (Contract 2)
- [ ] Step 3: Dial container + watch case figure (Contract 1 slot, portrait shell)
- [ ] Step 4: Material debug section — the F1 contributed `ControlsSection`
- [ ] Step 5: `Astrolabe()` shell + `pages/astrolabe/page.ts` route (wires everything; feature test goes GREEN)

The feature test asserts two `it` blocks: (A) a `<figure>` with exactly one empty `[data-astrolabe-dial]` (no `<svg>`, no `[data-body]`, no Realtime/Fast button), and (B) the registry — `ControlsSheet()` shows always-visible sections always, and `debugOnly` sections only when `window.location.hash === "#debug"`. Block B is unblocked at Step 2; block A is unblocked at Step 5. The test stays RED until Step 5.

---

## Step 0: API surface area

Establish every new type and public signature as a stub so the project typechecks and the feature test's imports (`Astrolabe` from `astrolabe.ts`; `ControlsSheet`, `registerControlsSection` from `controls.ts`) resolve. No bodies. Signatures mirror the project plan's settled Contracts 2, 3, 4 exactly. `BodyName` lives in `astro-tokens.ts` per the F1 design (F2's `astro-math.ts` re-exports/aligns with it — the project-plan Contract 1 places `BodyName` in `astro-math.ts`, but the cleared F1 design names `astro-tokens.ts` as the F1-owned declaration point; follow the design).

Stub bodies must compile under `tsc --noEmit` and `biome check`. Use `throw new Error("not implemented")` for functions and a typed cast / empty literal for component returns so each file is import-resolvable but obviously unbuilt. `as` casts are acceptable in Step 0 stubs only; they are replaced with real construction in later steps.

```typescript
// src/lib/astro-tokens.ts  — owns the TS side of Contracts (3) and (4)

/** The bodies rendered on the dial. F1 declares the name set; F2's astro-math.ts aligns to it. */
export type BodyName =
	| "sun" | "mercury" | "venus" | "earth" | "moon"
	| "mars" | "jupiter" | "saturn" | "uranus" | "neptune";

/** The CSS custom-property name for a body's color, e.g. bodyColorVar("mars") === "--color-mars". */
export function bodyColorVar(body: BodyName): `--color-${BodyName}`;

/** Finish/material token names (Contract 4), one source shared by the material section and global.css. */
export const MATERIAL_TOKENS: {
	readonly casePlatinum: "--case-platinum";
	readonly strapCordovan: "--strap-cordovan";
	readonly strapStitch: "--strap-stitch";
	readonly dialMidnight: "--dial-midnight";
	readonly lacquerDepth: "--lacquer-depth";
};
```

```typescript
// src/components/astrolabe/controls.ts  — owns Contract (2)

export interface ControlsSection {
	id: string;
	title: string;
	render(): Node | Node[];
	debugOnly: boolean;
}

/** Append a section to the registry. Sections render in registration order; idempotent on id. */
export function registerControlsSection(section: ControlsSection): void;

/** Build the controls sheet; debugOnly sections appear only with the #debug hash. */
export function ControlsSheet(): Element;
```

```typescript
// src/components/astrolabe/dial-container.ts
/** The empty square host F2 mounts its <svg viewBox="-500 -500 1000 1000"> into. Carries [data-astrolabe-dial]. */
export function DialContainer(): Element;
```

```typescript
// src/components/astrolabe/case.ts
/** Portrait <figure>: strap-top / platinum case wrapping the passed dial / strap-bottom. */
export function WatchCase(dial: Element): Element;
```

```typescript
// src/components/astrolabe/material-section.ts
/** The F1 contributed material ControlsSection (debugOnly: true). */
export const materialSection: ControlsSection;
```

```typescript
// src/components/astrolabe/astrolabe.ts
/** Top-level SHELL: case/strap figure + empty dial + controls sheet. NO bodies, astronomy, or Realtime/Fast button. */
export function Astrolabe(): Element;
```

```typescript
// pages/astrolabe/page.ts
import type { PageModule } from "@davidsouther/jiffies/ssg/ssg.ts";
// export default { head, default } satisfies PageModule  — stubbed head()/default() in Step 0, filled in Step 5.
```

**Leaves green:** `npm run check` passes (stubs compile). The feature test now fails at runtime/assertion (modules resolve, `Astrolabe()`/`ControlsSheet()` throw or return empty) — the RIGHT reason, not "module not found." No existing test regresses.

---

## Step 1: Token surface — `astro-tokens.ts` + the `global.css` token block

**Enables:** No direct feature-test assertion (the test is structural/jsdom and does not read computed CSS). This step is the foundation Steps 3 and 4 consume: the material section writes these token names, the case reads them, the dial renders `--dial-midnight`. It is sequenced first so later steps reference a real token surface rather than inventing names.

Implement `bodyColorVar` (template-literal return), `MATERIAL_TOKENS` (the `as const` object), and append a single `@layer theme :root { … }` block to `src/global.css` matching the existing convention (the file already declares the `@layer fns … theme` order and uses oklch tokens). Declare `--color-sun … --color-neptune` (Contract 3) and the five material tokens (Contract 4) with provisional oklch values: warm gold Sun, cool-white platinum, mahogany cordovan, tonal stitch, deep-midnight dial, translucent lacquer. Exact oklch tuning is parked to cleanup (design §Summary); set plausible values now. `global.css` is bundled to `public/global.css` by `npm run css:bundle` (lightningcss) and linked as `/global.css` — no page-level CSS file is added.

**Tests**

`src/lib/astro-tokens.test.ts` — pure-function unit test (no jsdom needed).

```
test "bodyColorVar maps a body to its --color- property name":
	assert bodyColorVar("mars") == "--color-mars"
	assert bodyColorVar("sun") == "--color-sun"
```

- Edge: every `BodyName` member round-trips (`--color-${body}` for all ten) — a `for…of` over a literal name array.
- Edge: `MATERIAL_TOKENS` values are exactly the five Contract-4 names (guards a rename drifting from `global.css`).
- Not tested in unit: that `global.css` actually declares the tokens with valid oklch — that is a build-time / browser-verification concern (the live repaint is browser-verified in Step 5), not a jsdom assertion.

**Implementation Outline**

```
function bodyColorVar(body):
	return `--color-${body}`

MATERIAL_TOKENS = { casePlatinum: "--case-platinum", strapCordovan: "--strap-cordovan",
	strapStitch: "--strap-stitch", dialMidnight: "--dial-midnight", lacquerDepth: "--lacquer-depth" } as const

# global.css append (inside @layer theme):
:root {
	--color-sun: <warm gold>; --color-mercury … --color-neptune: <provisional>;
	--case-platinum: <cool white>; --strap-cordovan: <mahogany>;
	--strap-stitch: <tonal>; --dial-midnight: <near-black>; --lacquer-depth: <translucent midnight>;
}
```

**Leaves green:** `npm run check` + `npx vitest run` pass; the new unit test passes; feature test still RED (block A needs the shell; block B needs the registry).

---

## Step 2: Controls registry — `registerControlsSection` / `ControlsSheet`

**Enables:** Feature-test block B in full — "builds the always-visible controls sheet from the contributed-section registry, gating debugOnly behind #debug." After this step, registering an always-visible and a debugOnly section, then mounting `ControlsSheet()`, shows the always-visible title always and the debugOnly title only when `window.location.hash === "#debug"`.

Implement a module-level ordered registry (array preserving registration order) with id-idempotency: re-registering an existing id replaces in place (the test re-runs `registerControlsSection`, so this must be safe across runs — replace, don't duplicate, don't append). `ControlsSheet()` reads `window.location.hash` at construction, filters out `debugOnly` sections when the hash is not `#debug`, and renders the surviving sections in order. Use the jiffies `Card`/`Panel` (`Card(parts, ...children)`) wrapping one `Accordion({ summary: title }, ...renderResult)` per section; the section `title` must appear in `textContent` (the test asserts `.toContain("Always Section")`), so the title goes in the `Accordion` summary. Normalize `render()`'s `Node | Node[]` into the children spread. Confirmed jiffies exports: `Card`, `Panel` from `components/card.ts`; `Accordion` from `components/accordion.ts`.

**Tests**

`src/components/astrolabe/controls.test.ts` — `// @vitest-environment jsdom` first line; `mount`/`resetDom` from `../test-dom.ts`. This is the feature-test's block B in unit form; keep it parsimonious (the feature test already covers the happy path, so the unit test focuses on the registry edges the feature test does not).

```
test "re-registering an id replaces rather than duplicates":
	registerControlsSection({ id: "x", title: "First", render: () => textNode("a"), debugOnly: false })
	registerControlsSection({ id: "x", title: "Second", render: () => textNode("b"), debugOnly: false })
	sheet <- mount(ControlsSheet())
	assert occurrences("Second" in sheet.textContent) == 1
	assert sheet.textContent does NOT contain "First"
```

- Edge: `render()` returning a `Node[]` fragment is fully appended (not just the first node).
- Edge: registration order is preserved (section A registered before B appears before B in the DOM).
- Edge: with no `#debug` hash a `debugOnly` section is absent; with `#debug` it is present (mirror of the feature-test assertion, retained as the registry's own guard against a gating regression).
- Note: the registry is module-level state shared across tests; do not rely on a clean registry between `it` blocks (the feature test registers `test-always`/`test-debug` and re-runs safely). Use distinct ids per unit test, or assert on presence of this test's ids rather than total count of all sections.

**Implementation Outline**

```
const registry: ControlsSection[] = []

function registerControlsSection(section):
	idx = registry.findIndex(s => s.id == section.id)
	if idx >= 0: registry[idx] = section
	else: registry.push(section)

function ControlsSheet():
	debug = window.location.hash == "#debug"
	visible = registry.filter(s => !s.debugOnly || debug)
	sections = visible.map(s => Accordion({ summary: s.title }, ...toArray(s.render())))
	return Card({}, ...sections)   # or Panel; the title lives in the Accordion summary
```

**Leaves green:** `npm run check` + `npx vitest run` pass; the controls unit test passes; **feature-test block B now passes**; block A still RED (no shell yet). No existing test regresses.

---

## Step 3: Dial container + watch case figure

**Enables:** Feature-test block A's structural shell — the `<figure>` wrapper, exactly one `[data-astrolabe-dial]`, and emptiness (no `<svg>`, no `[data-body]` inside). This step builds the two presentational components; Step 5 composes them into `Astrolabe()` where the assertions actually run.

`DialContainer()` returns an empty square host element carrying the stable hook `data-astrolabe-dial` (the F2 mount target) and rendering the `--dial-midnight` ground (class or inline `background`); it contains NO SVG and NO body groups (the test asserts the slot is empty). `WatchCase(dial)` returns the portrait `<figure>` composed `[strap-top] / [platinum case wrapping the passed dial] / [strap-bottom]`, using `figure` and `div`/`section` from jiffies `dom/html.ts`. Prebaked strap/case decoration uses the `icons.ts` factory-plus-`innerHTML` idiom (inline SVG/CSS, not a raster, so material tokens stay live-tunable per the design's rejected-alternative note) where raw markup is needed; the case reads `--case-platinum`, `--strap-cordovan`, `--strap-stitch` via CSS classes. Keep each file small and presentational.

**Tests**

`src/components/astrolabe/case.test.ts` — `// @vitest-environment jsdom`; `mount`/`resetDom`.

```
test "WatchCase wraps the passed dial inside a portrait figure":
	dial <- DialContainer()
	el <- mount(WatchCase(dial))
	assert el.querySelector("figure") not null
	assert el.querySelector("[data-astrolabe-dial]") not null      # the passed dial is present in the tree
	assert dial.querySelector("svg") is null                       # container ships empty
```

- Edge: `DialContainer()` alone exposes `[data-astrolabe-dial]` and is empty of `<svg>`/`[data-body]`.
- Edge: `WatchCase` renders strap regions above AND below the case (two strap nodes around the case), satisfying the portrait framing — assert two strap elements by class/hook.
- Not unit-tested: portrait fill on a phone, square aspect, platinum/cordovan finish appearance — browser-verified in Step 5 per the design (truly visual behavior is deferred).

**Implementation Outline**

```
function DialContainer():
	return div({ "data-astrolabe-dial": "", class: "astrolabe-dial" })   # empty; midnight ground via class

function WatchCase(dial):
	return figure({ class: "astrolabe-case" },
		div({ class: "astrolabe-strap astrolabe-strap-top" }, <prebaked strap decoration via innerHTML idiom>),
		div({ class: "astrolabe-bezel" }, dial),                          # platinum case/bezel wraps the dial
		div({ class: "astrolabe-strap astrolabe-strap-bottom" }, <prebaked strap decoration>))
```

**Leaves green:** `npm run check` + `npx vitest run` pass; case/dial unit tests pass; feature test still RED on block A (shell not yet composed in `Astrolabe()`); block B still GREEN. The case/strap finish CSS may be appended to `global.css` here (classes referencing the Step-1 tokens) — purely additive, no regression.

---

## Step 4: Material debug section — the F1 contributed `ControlsSection`

**Enables:** No new feature-test assertion (the feature test contributes its OWN test sections and never inspects the material section). This step delivers the design's worked example of a comprehensive, well-organized `#debug` panel — the session's deliverable emphasis — and is the real first caller of Contract 2 that `Astrolabe()` registers in Step 5.

Build `materialSection: ControlsSection` with `id: "material"`, a human title (e.g. "Case & Strap"), `debugOnly: true`, and a `render()` returning case-finish and strap-finish controls built from jiffies form components (confirmed exports: `Switches`/`Radios`/`Switch` from `dom/form/form.ts`; `FormGroup` from `components/form.ts`; `PropertySheet` from `components/property.ts`; `StaticTabList` from `components/tabs.ts`). Each control writes a `MATERIAL_TOKENS` token via `element.style.setProperty(MATERIAL_TOKENS.casePlatinum, value)` on `document.documentElement` (or the figure root) so the case/strap retint live. Favor a thorough, well-organized panel: group case tokens and strap tokens, use the token-name constants from `astro-tokens.ts` so a rename breaks the import rather than silently the styling.

**Tests**

`src/components/astrolabe/material-section.test.ts` — `// @vitest-environment jsdom`; `mount`/`resetDom`.

```
test "material section is debugOnly and exposes case + strap controls":
	assert materialSection.debugOnly == true
	assert materialSection.id == "material"
	body <- mount(materialSection.render())
	assert body has an input/control for the case finish
	assert body has an input/control for the strap finish
```

```
test "changing a material control writes its token via setProperty":
	body <- mount(materialSection.render())
	control <- the case-finish control in body
	simulate change(control, <a finish value>)
	assert getComputedStyle/documentElement.style has --case-platinum set to the chosen value
```

- Edge: the strap control writes `--strap-cordovan` (not `--case-platinum`) — guards a copy-paste token mix-up.
- Edge: `render()` returns a `Node | Node[]` consumable by `ControlsSheet` (mounts without error).
- Mock note: jsdom provides `document.documentElement.style.setProperty`; no external mocking needed. Assert via `documentElement.style.getPropertyValue(...)`, the observable behavior, not which method was called.

**Implementation Outline**

```
function applyToken(name, value):
	document.documentElement.style.setProperty(name, value)

materialSection = {
	id: "material", title: "Case & Strap", debugOnly: true,
	render: () => FormGroup({ legend: "Materials" },
		<case-finish control> onChange => applyToken(MATERIAL_TOKENS.casePlatinum, value),
		<strap-finish control> onChange => applyToken(MATERIAL_TOKENS.strapCordovan, value),
		<additional well-organized controls: stitch, lacquer, dial ground>)
}
```

**Leaves green:** `npm run check` + `npx vitest run` pass; material-section unit tests pass; feature test still RED on block A (not yet composed); block B GREEN. No regression.

---

## Step 5: `Astrolabe()` shell + `pages/astrolabe/page.ts` route

**Enables:** Feature-test block A in full — `mount(Astrolabe())` yields a `<figure>`, exactly one empty `[data-astrolabe-dial]` (no `<svg>`, no `[data-body]` anywhere), and no Realtime/Fast button. With block B already green from Step 2, **the whole feature test passes after this step.**

Implement `Astrolabe()` to: register the F1 `materialSection` via `registerControlsSection(materialSection)` (idempotent, safe on repeated renders), build the dial via `DialContainer()`, frame it via `WatchCase(dial)`, build the sheet via `ControlsSheet()`, and return a wrapper holding the case figure and the sheet below it. Ship NO body groups, NO `<svg>` in the dial, NO Realtime/Fast button (those are F2/F3) — the feature test explicitly asserts their absence. Then write `pages/astrolabe/page.ts` as the `PageModule`: `head()` returns `[...pageHead("Astrolabe — David Souther"), <Cormorant Garamond link>, <DM Mono link>]` (Google Fonts `<link>`s appended via the `link` factory from `dom/html.ts`, matching the `page-head.ts` pattern); `default()` returns `Astrolabe()`. Do NOT add `/astrolabe` to `scripts/sitemap.ts` and add no nav link — the route ships dark (the SSG builds `pages/astrolabe/page.ts` into `docs/` unlisted; intended).

**Tests**

The feature test `shell.feature.test.ts` is the acceptance test for this step — no separate unit test for `Astrolabe()` is needed beyond it (parsimony: the feature test exercises the composition end-to-end). A focused page-module unit test guards the head contract, which the feature test does not cover:

`pages/astrolabe/page.test.ts` (or `src/components/astrolabe/astrolabe.test.ts` for head, if page-level tests are not yet a pattern — confirm during build):

```
test "head() includes pageHead output plus the two Google Font links":
	nodes <- pageModule.head()
	assert nodes contains a <title> (from pageHead)
	assert nodes contains a <link> to a Cormorant Garamond fonts.googleapis.com URL
	assert nodes contains a <link> to a DM Mono fonts.googleapis.com URL
```

- Edge: `default()` returns an element whose tree contains a `<figure>` and a `[data-astrolabe-dial]` (smoke test that the page renders the shell; the feature test owns the full assertions).
- Browser verification (mandatory for UI, per the design's deferral of visual behavior): after green, serve `docs/` (`node scripts/serve.ts --port 8080 --watch`) and load `http://127.0.0.1:8080/astrolabe/` with `playwright-cli` — confirm the portrait watch fills the width, the platinum/cordovan finish reads as a luxury watch, the dial container is square and empty, and under `#debug` the material controls retint the case/strap live (`setProperty` repaint). This is the live-token-repaint / portrait-fill behavior the feature test deliberately does not assert.

**Implementation Outline**

```
function Astrolabe():
	registerControlsSection(materialSection)
	dial = DialContainer()
	caseFigure = WatchCase(dial)
	sheet = ControlsSheet()
	return div({ class: "astrolabe" }, caseFigure, sheet)

// pages/astrolabe/page.ts
const FONT_CORMORANT = "https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@…&display=swap"
const FONT_DM_MONO   = "https://fonts.googleapis.com/css2?family=DM+Mono:wght@…&display=swap"
export default {
	head: () => [...pageHead("Astrolabe — David Souther"),
		link({ rel: "stylesheet", href: FONT_CORMORANT }),
		link({ rel: "stylesheet", href: FONT_DM_MONO })],
	default: () => Astrolabe(),
} satisfies PageModule
```

**Leaves green:** `npm run check` + `npx vitest run` pass; **`shell.feature.test.ts` passes (both blocks)**; the page-module head test passes; no existing test regresses; browser verification confirms the visual/repaint behavior the unit layer defers. The route remains dark (no sitemap entry, no nav link).

---

## Notes for the builder

- **`BodyName` ownership.** The cleared F1 design places `BodyName` and `bodyColorVar` in `src/lib/astro-tokens.ts`. The project-plan Contract 1 lists `BodyName` under `astro-math.ts`; that file is F2's. F1 declares the name set in `astro-tokens.ts`; F2's `astro-math.ts` will import or re-export it to stay aligned. Do not create `astro-math.ts` in F1.
- **Module-level registry state.** The controls registry is module-global; tests share it. The feature test re-registers safely (idempotent on id). Write unit tests to assert on their own ids, not total section counts.
- **Tabs / fonts / token values are tunable.** Provisional oklch token values and the exact Google Fonts weight axes are build-time/cleanup refinements (design §Summary), not contract surface. Pick plausible values; refine in a later session.
- **Verify each step:** `npm run format` then `npm run check` clean, then `npx vitest run`. Biome uses tabs — run `npm run format` before `npm run check`.
- **Dark gate:** never edit `scripts/sitemap.ts`, never add a nav link.
