# Implementation Plan: Feature 3 — Controls drawer state/markup separation

**Design:** `.ailly/developer/2026-06-23-A-astrolabe-fcc-refactor/controls-redesign.md`
(covers `review_2.md` item #2 — the third controls attempt; #1 jiffies-shim removal and
#3 Zodiac array are already green).

**Depends on:** Feature 2 (reuses its drawer markup, the no-raw-DOM guard harness/allowlist,
and the FCC/hydration mount pattern). This is a *rewrite* of Feature 2's `controls.ts` +
the control-construction half of `stage.ts`, not new surface area on the page.

**Feature test:** `src/components/astrolabe/controls-apply.feature.test.ts` (rewritten to the
v2 contract — see Step 5). The companion guards must stay green:
- `control-menu.feature.test.ts` (drawer structure / open-close)
- `persistence.feature.test.ts` (migrated to the v2 blob)
- `no-raw-dom.feature.test.ts` (controls.ts + the new control FCC module stay clean)
- `frame-roundtrip.feature.test.ts` (SSG serialize→reparse→adopt; must stay green)
- `astrolabe.feature.test.ts` (SSG build; must stay green)

**User story:** the controls drawer looks and behaves exactly as on `main`, but a single
serializable `ControlsState` is the only source of truth — state flows down to dumb,
reusable control FCCs that each render themselves from their slice and own the one styling
effect they govern; the controller holds state, persists it, pushes it down, and derives
`toConfig(state)` for the loop, making *zero* styling decisions. No `ControlHandles` bag, no
`bindRange`/`bindCheck`/`setChk` event-replay glue, no read-the-DOM-back snapshot.

**Steps:**
- [x] Step 0: API surface area (`ControlsState`, control-FCC signatures, `RootStyleSink`, `ControlsDrawer`, `initControls`) — stubs in `controls-components.ts`; re-homed to `controls.ts` at Step 4
- [x] Step 1: State core — `ControlsState`/`DEFAULTS`, `toConfig`, v2 persistence (pure, no DOM)
- [x] Step 2: Leaf control FCCs + `RootStyleSink` (each renders from value, owns its effect) — built as `make*` factories that close static config + `onChange` (mirrors `makeDisc`), since passing callbacks/objects as FCC attrs produces junk/dangerous (`onchange`) boundary attributes; events via `events:`, form-state via `.value`/`.checked`. MaterialPicker emits the id only (color pickers own var writes via the sink).
- [x] Step 3: `ControlsDrawer` FCC (composes leaves, fans state down, raises `onChange`/`onReset`/`onToggle`) — built via `makeControlsDrawer(slots)`; boundary IS `#stage-wrap` (so `root` === controls handle), externally-driven nodes (clocks/tip/signcard/dial) placed via `slots`. Callbacks arrive via a `.wire()` method (NOT update props), since a function prop becomes a live `onchange`/`ontoggle` boundary attribute that jsdom/browsers compile when an event bubbles (a crash).
- [x] Step 4: Rewrite `stage.ts` builder + thin `initControls` controller; wire `client.ts` mount — `buildStage` shrank to building the dial + overlay nodes and handing them to `makeControlsDrawer` (root === controls); `initControls` holds state, persists, fans down, derives `toConfig`, resets material-driven colors on a material change; `client.ts` reads `sizeMode` from `getConfig()`. Old `controls.ts` deleted; controller/drawer/state-core consolidated in `controls-components.ts` (one cohesive module, not split into `controls.ts`). SSG fix: `window.document` (the drawer builds at SSG too).
- [x] Step 5: Rewrite/migrate the feature + guard tests to the v2 contract — `controls-apply.feature.test.ts` rewritten to the v2 contract (project to cfg/class/var, reload-restore, reset-to-DEFAULTS-and-clear, v1 ignored); `persistence` migrated to the v2 key; `control-menu` reads the panel from the DOM. Full suite 198 green.

---

## Step 0: API surface area

New types and signatures (stubs only — no bodies). Lives in a new
`src/components/astrolabe/controls-components.ts` (the leaf FCCs, paralleling
`components.ts` for the dial) plus the rewritten `controls.ts`. `Config`/`MaterialId`/
`EarthMode` are unchanged imports.

```ts
// --- controls.ts: the one source of truth ---------------------------------
interface ControlsState {
  earthMode: "ptolemaic" | "galilean" | "keplerian";
  sizeMode: "full" | "90" | "48" | "38";
  speedStep: number;                 // index into SPEED_STEPS
  material: MaterialId;
  parallaxOn: boolean;
  parallax: number;
  orbits: boolean;                   // hide-orbits   (CSS only)
  spokes: boolean;                   // hide-spokes   (CSS only)
  signInfo: boolean;                 // → cfg.occ
  twilight: boolean;                 // → cfg.twilight + hide-twilight
  guilloche: boolean;                // → cfg.guilloche + hide-guilloche
  guillocheN: number;
  hands: boolean;                    // → cfg.hands + hide-hands
  moon: boolean;                     // hide-moon     (CSS only)
  colors: Record<string, string>;    // "--var" → hex; advanced overrides over the material
}
const DEFAULTS: ControlsState;       // mirrors current markup defaults
const STORAGE_KEY = "astrolabe.controls.v2";

function toConfig(s: ControlsState): Config;            // data for the loop — NOT styling
function persist(s: ControlsState): void;               // best-effort setItem(JSON)
function loadState(): ControlsState | null;             // getItem → validateState
function validateState(raw: unknown): ControlsState;    // parse-don't-validate, field-by-field vs DEFAULTS

// The cooperative CSS-var writer the color/material controls share (the one place
// pure distribution meets the cssText-only DOM wall — see design "decided: shared sink").
interface RootStyleSink { set(varName: string, value: string): void } // merge map + flush whole cssText once

// --- controls-components.ts: dumb, isolated, unit-testable control FCCs -----
// Each is an FCC<Props>; props carry the current value + an onChange + the styling
// target it owns. It renders its own UI from the value, applies its own effect, and
// emits the new value on interaction. It knows nothing of ControlsState/Config/persistence.
type RangeProps   = { id: string; min: number; max: number; step: number; value: number;
                      format: (v: number) => string; onChange: (v: number) => void };
type CheckProps   = { id: string; checked: boolean; root: HTMLElement; rootClass?: string;
                      onChange: (v: boolean) => void };          // owns its hide-* class
type SegmentProps = { id: string; items: { value: string; label: string }[]; value: string;
                      root?: HTMLElement; rootClass?: string;    // caseSize owns `full-screen`
                      onChange: (v: string) => void };
type MaterialProps= { materials: Material[]; value: MaterialId; sink: RootStyleSink;
                      onChange: (id: MaterialId) => void };
type ColorProps   = { varName: string; value: string; def: string; sink: RootStyleSink;
                      onChange: (varName: string, value: string) => void };

const RangeControl:   FCComponentCtor<RangeProps>;
const CheckControl:   FCComponentCtor<CheckProps>;
const SegmentGroup:   FCComponentCtor<SegmentProps>;
const MaterialPicker: FCComponentCtor<MaterialProps>;
const ColorPicker:    FCComponentCtor<ColorProps>;

// --- controls.ts: the drawer FCC + the controller --------------------------
type DrawerProps = { state: ControlsState; onChange: (p: Partial<ControlsState>) => void;
                     onReset: () => void; onToggle: (open?: boolean) => void };
type ControlsDrawerHandle = HTMLElement & { update(p: Partial<DrawerProps>): void };
function ControlsDrawer(): ControlsDrawerHandle;     // FCC ctor; renders the whole drawer subtree

function initControls(drawer: ControlsDrawerHandle): { getConfig: () => Config };
```

Everything in Step 0 is exercised by the feature test in Step 5.

---

## Step 1: State core — pure, no DOM

**Enables:** the feature test's "(a) projects to the right `cfg` field" and the data half of
"(b) survives a serialize→reparse→reload" — at the pure layer, before any DOM exists.

Build `ControlsState`, `DEFAULTS`, `toConfig`, and v2 persistence (`persist` / `loadState` /
`validateState`). No FCCs yet, no `up()`. `validateState` follows the existing
`parseSnapshot`/`parseStringMap` parse-don't-validate idiom in today's `controls.ts`, but
over the flat `ControlsState` instead of the DOM-addressed `ControlSnapshot`. The clean break
to v2 means a `v1` blob is *ignored* (one-time reset to defaults) — `loadState` only reads
`STORAGE_KEY = astrolabe.controls.v2`.

**Tests** (unit, jsdom not required for the pure functions):

```
test "toConfig maps every state field to its Config slot":
  cfg <- toConfig(DEFAULTS)
  assert cfg.earthMode == GALILEAN and cfg.occ == DEFAULTS.signInfo and cfg.guillocheN == 120
test "validateState round-trips a serialized state":
  assert validateState(JSON.parse(JSON.stringify(s))) deepEquals s
```

- A missing key falls back to the `DEFAULTS` value (field-by-field).
- A wrong-typed key (string where boolean expected, NaN speedStep) falls back, never throws.
- A non-object / null / unparseable blob → `loadState()` returns `null`.
- `colors` keeps only string-valued `--*` entries (drop tampered nested values).
- `speedStep` out of range clamps or falls back to default (decide at build; keep parity).

**Implementation Outline**

```
toConfig(s):
  return { speed: speedToMul(s.speedStep), sizeMode: s.sizeMode,
           earthMode: EARTH_MODE_BY_VALUE[s.earthMode], parallaxOn, parallax,
           occ: s.signInfo, twilight, guilloche, guillocheN, hands }
validateState(raw):
  if not object → return {...DEFAULTS}
  for each key of DEFAULTS: take raw[key] if it matches the DEFAULTS[key] primitive, else DEFAULTS[key]
  colors = stringMap(raw.colors)
persist(s):  try setItem(KEY, JSON.stringify(s)) catch {}
loadState(): try { raw=getItem(KEY); raw ? validateState(JSON.parse(raw)) : null } catch { null }
```

---

## Step 2: Leaf control FCCs + `RootStyleSink`

**Enables:** "(a) … the right root class / root var" — each control, in isolation, renders its
UI from its value AND applies the one effect it owns.

Build the five FCCs in `controls-components.ts` and the `RootStyleSink` implementation.
Pattern is exactly the dial's `components.ts`: `FCC<Props>(name, boundary, render)`, render
returns children, the boundary's own attrs (e.g. a group's `data-value`, a button's
`active`/`!active`) applied via the merged-attrs path. Effects:

- `CheckControl` owns its `hide-*` class: on render it calls `up(root, { class: checked ?
  '!'+rootClass : rootClass })` (checked ⇒ NOT hidden). Incremental class — composable, no
  coordination (design "boolean toggles distribute cleanly").
- `SegmentGroup` marks the active button (`class: on ? 'active':'!active'`), reflects
  `data-value` on the group; `caseSize`'s instance also owns `full-screen` via its `root`/
  `rootClass` (applied from `value === 'full'`).
- `ColorPicker` / `MaterialPicker` write CSS vars only through the shared `sink` (cssText-only
  wall). `MaterialPicker` stages every `materialVars(id)` entry into the sink, marks the
  active swatch, and reports the seeded values up so the controller can seed the pickers.

Single handler per event type (Jiffies law): each control wires exactly one `input`/`change`/
`click` that calls `onChange`. Apply-its-effect happens in render (driven by the value it gets
back), never as a second listener.

**Tests** (jsdom, mount each control standalone — proves isolation, no `document` reach):

```
test "CheckControl unchecked applies its hide class to the passed root":
  root <- div(); el <- CheckControl({ id:'t_orbits', checked:true, root, rootClass:'hide-orbits', onChange })
  fire(input, 'change' with checked=false)
  assert onChange called with false AND root.classList has 'hide-orbits'
test "ColorPicker writes its var through the sink, not the root directly":
  sink <- recordingSink(); el <- ColorPicker({ varName:'--mars', value:'#000', def, sink, onChange })
  fire(input, 'input' with value '#123456')
  assert sink.set('--mars', '#123456') AND onChange('--mars','#123456')
```

- `RootStyleSink.set` merges into a var map and flushes the *whole* cssText once,
  re-emitting `--dial-px` (read fresh via getComputedStyle — owned by `client.ts`).
- A `MaterialPicker` change re-seeds the matching color pickers' displayed values.
- `RangeControl` owns its readout `<span class="val">` (design's "default to owning both");
  on render the text node reconciles to `format(value)`.
- Re-rendering a control with the same value is idempotent (no duplicate listeners — the
  single-handler law).

**Implementation Outline**

```
RootStyleSink(root):
  vars = new Map()
  set(name, value): vars.set(name, value); flush()
  flush(): dialPx = getComputedStyle(root)['--dial-px']; up(root, { style: [dialPx?, ...vars].join(';') })
CheckControl render(el, attrs):
  up(attrs.root, { class: attrs.checked ? '!'+attrs.rootClass : attrs.rootClass })  // if rootClass
  return [ input({ id, type:'checkbox', checked: attrs.checked,
                   events:{ change: e => attrs.onChange(e.target.checked) } }) ]
SegmentGroup render: buttons map → class active/!active; group data-value; one click→onChange(value)
```

---

## Step 3: `ControlsDrawer` FCC

**Enables:** the down-flow that re-renders every control on `update({ state })` — the single
programmatic path that reset/restore use, replacing `setChk` and the snapshot replay.

`ControlsDrawer` is the FCC that builds the whole drawer subtree (motion block, the three
`<details>` sections, swatches, btnrow, gear, strap — i.e. the markup `buildStage` builds
today) by composing the Step-2 leaf FCCs, handing each its slice of `state` and an `onChange`
that raises a `Partial<ControlsState>` to the drawer's `onChange` prop. On `update({ state })`
it fans each slice to its child FCC (attrs merge → each child re-renders from its value and
re-applies its own effect). Panel open/close + `aria-expanded` are drawer-local UI state
(`onToggle`), *not* part of the persisted `ControlsState`.

**Tests** (jsdom):

```
test "drawer.update({ state }) re-renders every control from state":
  drawer <- ControlsDrawer({ state: DEFAULTS, onChange, onReset, onToggle })
  drawer.update({ state: { ...DEFAULTS, orbits:false, material:'gold' } })
  assert root has 'hide-orbits' AND the gold swatch is active
```

- A child `onChange` raises exactly its `Partial<ControlsState>` (e.g. `{ orbits:false }`).
- Toggling the panel flips `.open` + `aria-expanded` on gear/panel only (no state write).
- `update({ state })` is the only path that moves controls programmatically (reset/restore).

**Implementation Outline**

```
ControlsDrawer boundary = div({ id:'stage-wrap' } or the panel root)
render(el, attrs):
  sink = RootStyleSink(documentElement)
  return [ ...motion(SegmentGroup earthMode/caseSize/speed, MaterialPicker),
           ...details(CheckControls bound to attrs.state slices + RangeControls),
           ...swatches(ColorPickers via sink), btnrow(reset→onReset, close→onToggle(false)),
           gear ]
  // each leaf: value = attrs.state.<slice>; onChange = v => attrs.onChange({ <slice>: v })
```

> Note for the builder: `buildStage` currently also returns `dial` + `overlays` handles used
> by `view.ts`. Keep those exactly as-is; only the `controls` half changes from a 22-field
> bag to the single `ControlsDrawer` handle.

---

## Step 4: Rewrite `stage.ts` builder + thin `initControls`; wire mount

**Enables:** the full client path the feature test drives (`buildStage()` → `mount` →
`initControls(stage.controls)`), and the cfg the loop reads.

`buildStage()` returns `{ root, dial, overlays, controls }` where `controls` is now the single
`ControlsDrawerHandle` instead of `ControlHandles`. `initControls(drawer)` becomes the thin
controller from the design skeleton: holds `state = loadState() ?? DEFAULTS`, computes
`cfg = toConfig(state)`, and on `setState(patch)` updates state, recomputes cfg, persists, and
`drawer.update({ state })`. First paint hands the drawer `{ state, onChange:setState,
onReset:reset, onToggle }`. `getConfig()` returns the cached cfg. The controller touches no
`:root` and has no `applyProjections`.

**Tests:** the existing `control-menu` / `persistence` suites exercise this through
`buildStage`+`initControls`; they are migrated in Step 5, but after this step they compile and
the SSG `astrolabe.feature.test.ts` + `frame-roundtrip` stay green (the page renders the same
markup; only its construction is refactored). Verify the production mount: page-emitted static
drawer elements still drive through `up()` (the grafted-`.update`-lost-on-SSG-reparse fix —
see `[[jiffies-update-graft-lost-on-ssg-reparse]]`); `frame-roundtrip` guards it.

- `pages/astrolabe/page.ts` and `client.ts` build from the same `buildStage` (parity).
- `sizeDial` host sizing in `client.ts` is unchanged (sanctioned page-lifecycle exception).
- No retained ref reaches past the drawer's immediate child FCCs (engine-enforced unit boundary).

**Implementation Outline** — the design's `controls.ts` skeleton verbatim:

```
initControls(drawer):
  state = loadState() ?? DEFAULTS;  cfg = toConfig(state)
  setState(patch): state = {...state, ...patch}; cfg = toConfig(state); persist(state); drawer.update({ state })
  reset(): state = DEFAULTS; drawer.update({ state }); localStorage.removeItem(KEY)
  drawer.update({ state, onChange:setState, onReset:reset, onToggle:togglePanel })
  return { getConfig: () => cfg }
```

---

## Step 5: Rewrite/migrate tests to the v2 contract

**Enables:** the whole feature test — this is the step that turns it green and is the
definition of done for #2.

Rewrite `controls-apply.feature.test.ts` to assert, against a client-built stage
(`buildStage` → `mount` → `initControls`): (a) setting each control's value projects to the
right `cfg` field / root class / root var; (b) the state survives serialize→reparse→reload by
restoring from the v2 blob; (c) `reset()` returns every projection to `DEFAULTS` and clears
storage. Migrate `persistence.feature.test.ts` to the `astrolabe.controls.v2` key and the flat
state blob (no `inputs`/`groups`/`colors` DOM-addressed shape). `control-menu` should keep
passing unchanged (drawer structure is parity-preserved); adjust only if a markup nicety moved
(e.g. RangeControl owning its `.val`). Keep `no-raw-dom` (now also scanning
`controls-components.ts`) and `frame-roundtrip` green. Existing control/persistence feature
tests are **migrated, not deleted**.

**Tests:** this *is* the test step. The driving assertions:

```
test "each control projects to cfg / root class / root var":
  set t_twilight off → getConfig().twilight == false AND root has 'hide-twilight'
  set --mars swatch → root.style['--mars'] == chosen
  set earthMode keplerian → getConfig().earthMode == KEPLERIAN
test "state survives reparse + reload via the v2 blob":
  change controls → re-build stage from v2 storage → projections restored
test "reset returns every projection to DEFAULTS and clears storage":
  change many → reset() → all projections == DEFAULTS AND getItem(v2) == null
```

- v1 blobs are ignored (clean break) — a stored `astrolabe.controls.v1` does not restore.
- Reset clears storage *last* (default-applying paths must not re-persist after the clear).
- The persisted blob contains only `ControlsState` (no simulation fields), asserted as before.

**Implementation Outline:** rewrite the `beforeEach`/assertions around `getConfig()` +
`documentElement` projections + the v2 key; reuse the `fire(el,type)` helper and the
`buildStage`/`mount`/`initControls` harness already in the file.
