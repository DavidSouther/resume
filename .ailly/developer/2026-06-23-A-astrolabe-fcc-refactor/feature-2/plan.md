# Implementation Plan: Feature 2 — Controls drawer

*Draft 2026-06-24*

**Depends on:** Feature 1 (reuses its no-raw-DOM guard harness/allowlist and its
FCC/hydration mount pattern).

**Feature tests:**
- `src/components/astrolabe/no-raw-dom.feature.test.ts` (widened to `controls.ts` +
  `pages/astrolabe/page.ts` — the one sanctioned test edit)
- `src/components/astrolabe/control-menu.feature.test.ts` (drawer structure — must stay green)
- `src/components/astrolabe/persistence.feature.test.ts` (localStorage persistence — must stay green)
- `src/components/astrolabe/astrolabe.feature.test.ts` (SSG build — must stay green)

**User story:** the controls drawer looks and behaves exactly as on `main`, but every form
construction, value binding, listener, and `classList`/`style`/`dataset` write flows through
Jiffies builders + `events:`/`class`/`style` attrs, with `localStorage` persistence intact.

**Steps:**
- [ ] Step 0: API surface area (FCC drawer handle + guard widening)
- [ ] Step 1: `page.ts` construction-time writes → builder attrs
- [ ] Step 2: `controls.ts` runtime mutations → FCC `update`/`class`/`style`/`events:`
- [ ] Step 3: Persistence + reset wired through the FCC handle (localStorage unchanged)
- [ ] Step 4: Widen the guard; reuse F1 hydration mount; verify parity

---

## Step 0: API surface area

The drawer becomes an FCC-handle-driven subtree mirroring Feature 1's `astrolabeView`
pattern: `page.ts` emits `data-fc` boundaries (or plain builder elements the client
re-wires), and `initControls()` returns a controls-view handle whose `update(state)` fans
the drawer's reactive state to child FCCs. Public surface (signatures, no bodies):

```ts
// src/components/astrolabe/controls.ts  (keep export shape the tests use)
export function initControls(): { getConfig: () => Config };

// Internal reactive shape the drawer FCCs render (state object, replaces scattered
// classList/style/dataset writes). NOT exported across the dial boundary.
interface DrawerState {
  open: boolean;                                  // panel.open + gear.open + aria-expanded
  ready: boolean;                                 // panel.ready
  groups: Record<string, string>;                 // earthMode/caseSize/speed -> data-value (drives .active + dataset)
  rootClasses: Record<string, boolean>;           // hide-orbits/hide-spokes/hide-twilight/hide-moon/hide-guilloche/hide-hands/full-screen
  rootVars: Record<string, string>;               // --ground/--case/... setProperty targets
  activeMaterial: MaterialId;                      // .material-swatch.active
  rangeOut: Record<string, string>;               // parallaxVal/guillocheNVal text
}
```

`localStorage` helpers (`readSnapshot`/`writeSnapshot`/`clearSnapshot`/`captureSnapshot`/
`parseSnapshot`) **stay unchanged** — they are not DOM mutations. `captureSnapshot`'s
`.dataset.value`/`.dataset.material`/`.dataset.var` READS must move to `getAttribute("data-...")`
(a permitted read; only `set/remove/toggleAttribute` are forbidden, and `/\.dataset\./`
trips on reads too). All §2/§3 selector strings (ids, classes, `data-*`) stay byte-identical
so `control-menu`/`persistence` tests keep passing.

After Step 0 the guard is still narrow (not yet widened), so it stays green; structure +
persistence tests stay green.

## Step 1: `page.ts` construction-time writes → builder attrs

**Enables:** removes the construction-time `setAttribute`/`dataset`/`style` calls from
`pages/astrolabe/page.ts` so the widened guard (Step 4) passes it; preserves every emitted
id/class/`data-*`/`role` so the SSG-build and structure tests stay green.

Move each post-construction mutation into the builder attrs (`map:scaffold-tests` §3):
- `row()`: `lbl.setAttribute("for", forId)` → `label({ for: forId }, ...)`.
- `colorSwatch()`: `inp.dataset.var/.def =` → `input({ "data-var": varName, "data-def": defaultColor, type:"color", value: defaultColor })`.
- `materialButton()`: `chip.style.setProperty("--chip", swatch)` → `span({ class:"chip", style:{ "--chip": swatch } })`; `btn.dataset.material = id` → `button({ class:"material-swatch", ariaLabel:name, "data-material": id }, ...)`.
- `segGroup()`: `grp.setAttribute("role","group")` → `{ role:"group" }`; `grp.dataset.value`/`b.dataset.value` → `{ "data-value": ... }`; `grp.appendChild(b)` → pass buttons as children to `div({...}, ...buttons)`.

**Tests:** `astrolabe.feature.test.ts` (build emits `id="controls"`, `<g`, etc.) and
`control-menu.feature.test.ts` (ids `realClock`/`simClock`/`earthMode`/`caseSize`/`speed`
present, `button.material-swatch` count > 0, `t_orbits` present). Edge case: `for`/`data-*`
must render verbatim (jiffies does no `htmlFor→for` mapping).

## Step 2: `controls.ts` runtime mutations → FCC `update`/`class`/`style`/`events:`

**Enables:** removes every `classList`/`style`/`dataset`-write/`addEventListener` from
`controls.ts` so the widened guard passes it; preserves gear toggle, layer toggles,
material/color application, segmented groups (parity).

Route each runtime mutation (`map:scaffold-tests` §3) through the FCC handle and attrs:
- classList toggles (`updateHands` hide-hands; `togglePanel` panel.open/gear.open + `aria-expanded`;
  `panel.classList.add("ready")`; `bindCheck` root hide-* and `full-screen`; `bindGroup.set`
  + `applyMaterial` `.active`) → `class` attr lists (`active`/`!active`, `open`/`!open`) and
  `rootClasses` applied via a root FCC `class` attr (root-scoped per the jiffies-theme law).
- style writes (color pickers + `applyMaterial` + reset `documentElement.style.setProperty`)
  → a root FCC `style` object attr keyed by CSS var (`rootVars`).
- dataset writes (`applySnapshot`/`bindGroup.set` `grp.dataset.value = v`) → `data-value`
  attr via the group FCC `update`.
- `addEventListener` (gear, closeBtn, range `input`, checkbox `change`, seg/material/color/
  resetBtn `click`/`input`, every `input[id]` input+change, `.btn-group button` click) →
  `events:` attrs on the respective FCC boundaries.
- `bindRange.upd` `out.innerHTML = fmt(v)` → text-node child via `el.update`.
- `el.dispatchEvent(new Event(...))` (NOT forbidden) → drive `apply` directly instead.

`aria-expanded` reflects `String(open)`; gear text never swaps CONTROLS/CLOSE (parity).
Keep PERMITTED reads/non-element APIs: `getElementById`/`querySelectorAll`, `localStorage.*`,
`window.matchMedia`, `window.dispatchEvent(new Event("resize"))` (window, not element),
`getComputedStyle`.

**Tests:** `control-menu.feature.test.ts` — `gear.click()` flips `drawer.classList.contains("open")`
and sets `aria-expanded`; `always-controls` is null; `t_orbits` reachable. Edge cases: matchMedia
absent (jsdom) boots closed; seg group click marks one `.active`; range output text updates.

## Step 3: Persistence + reset through the FCC handle

**Enables:** `persistence.feature.test.ts` stays green — storage holds only `STORAGE_KEY`,
never `simT`/`bootMs`/`caseOffset`; reset clears the key; malformed blob falls back without
throwing.

`captureSnapshot` reads live control state (now via `getAttribute("data-...")` for groups/
material/colors). `persist()` runs on every control change via the `events:` handlers from
Step 2 (synthetic input/change don't bubble — keep per-control wiring, now as `events:`).
`applySnapshot` writes restored values by driving the relevant FCC `update`s/`apply`
callbacks (checkbox `checked`, range `value`, group `data-value`, material) rather than raw
`.value`/`.checked` assignment where those would be element-state writes — note `inp.value=`/
`inp.checked=` are NOT in the FORBIDDEN set (they are properties, not `setAttribute`/`style`/
`classList`), so value/checked assignment may stay; only attribute/class/style/dataset/listener
calls must route through Jiffies. Reset re-applies defaults through the same `apply`/`update`
paths, then `clearSnapshot()` last.

**Tests:** `persistence.feature.test.ts` — keplerian click persists `earthMode` data-value;
parallax range input persists; `t_spokes` change persists; gold material sets `--case=#d9a441`;
`--ground` color input persists; reset → `localStorage[STORAGE_KEY]` null; storage JSON never
contains `simT`/`bootMs`/`caseOffset`. Edge cases: malformed blob → `initControls()` no throw,
earthMode stays galilean; unknown persisted material falls back to default.

## Step 4: Widen the guard, reuse F1 hydration mount, verify parity

**Enables:** the no-raw-dom guard's project bar — `controls.ts` + `pages/astrolabe/page.ts`
now scanned and clean.

The single sanctioned test edit: in `no-raw-dom.feature.test.ts`, remove `"controls.ts"`
from `EXCLUDE` (keep `"client.ts"`), and extend the scan to include
`pages/astrolabe/page.ts` (add it to the file list the `describe` iterates, alongside the
`src/components/astrolabe` directory scan; keep the ≥4-modules guard-the-guard intact). Do
not alter the FORBIDDEN/PERMITTED regexes or the listener stripping.

Reuse Feature 1's hydration mount: the drawer FCC boundaries are server-rendered with
`data-fc`, `hydrate.start()` re-wires them, and `initControls()` collects the handles
(mirroring `astrolabeView`). Decide here whether `client.ts` joins the guarded set now that
the drawer is FCC-based (the design left this to Feature 2) — recommend keeping `client.ts`
excluded since `sizeDial` host sizing + window/visualViewport listeners remain permitted
page-lifecycle wiring.

**Tests:** all four feature tests green together; `tsc`/biome clean (fix formatting via
`mise exec -- npx biome check --write src pages`, never hand-edit). Edge case: the guard's
file iteration must read `pages/astrolabe/page.ts` by absolute/relative path correctly so a
missing-file silent pass cannot occur.
