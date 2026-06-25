# Design — Controls drawer: centralized state + dumb control FCCs

Scope: rewrite `controls.ts` (and the control-construction half of `stage.ts`) so
the drawer has **one** source of truth, isolated reusable control components, and
serialized persistence. Items #1 (jiffies shim removal) and #3 (Zodiac array) of
`review_2.md` are already applied and green; this design covers only #2.

Decisions locked with the user (2026-06-24):

1. **Centralized `ControlsState`** — one serializable object is the single source of truth.
2. **Reusable control-type FCCs** — `RangeControl`, `CheckControl`, `SegmentGroup`,
   `MaterialPicker`, `ColorPicker`, composed by a `ControlsDrawer` FCC.
3. **Clean break to v2 persistence** — serialize `ControlsState` directly; ignore
   existing `astrolabe.controls.v1` blobs (a one-time reset to defaults for current users).

## The problem this fixes

Today there are **three** stores kept in sync by hand: `cfg` (the shadow the loop
reads), the **DOM** (`input.value`/`.checked`, `data-value`, `.active` classes), and
the **snapshot** (captured by reading the DOM back, restored by writing it). One
slider drag fans out across all three. `bindRange`/`bindCheck` are the glue smearing
that fan-out; `setChk` exists only because **reset** can't replay the event path.
`ControlHandles` is a 22-element bag `initControls` reaches into — the opposite of a
component boundary.

## The model

State is the single source of truth and flows **down**; each control receives its
slice and **makes its own styling decision**. There is no central projection pass:
the controller never reaches out to style the dial. (Correction over the first
draft — a central `applyProjections` writing `:root` was backwards; that is the
controller dictating styling, which is exactly the entanglement we're removing.)

```
user event ─▶ control.onChange(value)
                 └─▶ setState(patch): state = {…state, …patch}; persist(state); drawer.update({ state })
state flows down ─▶ drawer.update({ state }) fans each slice to its child control FCC
                 └─▶ each control renders ITSELF from its value AND applies its own styling effect
loop reads data  ─▶ getConfig() = toConfig(state)        (simulation inputs — NOT styling)
```

What the controller (`initControls`) does and *only* does: hold `state`, persist it,
push it down (`drawer.update`), and expose `toConfig(state)` to the loop. It makes
**zero** styling decisions.

- **One** `ControlsState`. The DOM is a *projection* of it, never a store.
- A control receives its value (down) and emits a new value (`onChange`, up). Within
  that, it owns **its own** styling: its UI (checked / active / readout) **and** the
  visual effect it governs (its `hide-*` root class, its CSS var). The styling logic
  lives *with* the control, not in a god-function.
- `toConfig` is **data, not styling** — the simulation inputs the 60fps loop consumes.
  It is the one thing the controller still derives, because the loop, not a control,
  owns dial *rendering*. The `hide-*`/var *styling* layer is distributed to controls.

### State shape

```ts
interface ControlsState {
  earthMode: "ptolemaic" | "galilean" | "keplerian";
  sizeMode: "full" | "90" | "48" | "38";
  speedStep: number;            // index into SPEED_STEPS (group data-value today)
  material: MaterialId;
  parallaxOn: boolean;
  parallax: number;
  orbits: boolean;              // t_orbits   (CSS only)
  spokes: boolean;              // t_spokes   (CSS only)
  signInfo: boolean;            // t_occ      → cfg.occ
  twilight: boolean;            // → cfg.twilight AND hide-twilight class
  guilloche: boolean;           // → cfg.guilloche AND hide-guilloche class
  guillocheN: number;
  hands: boolean;               // → cfg.hands AND hide-hands class
  moon: boolean;                // t_moon     (CSS only)
  colors: Record<string, string>;  // "--var" → hex; advanced overrides over the material
}

const DEFAULTS: ControlsState = { /* mirrors current markup defaults */ };
```

### The one thing the controller derives: `toConfig` (data, not styling)

```ts
toConfig(s): Config
  // speed: speedToMul(s.speedStep); earthMode: EARTH_MODE_BY_VALUE[s.earthMode];
  // sizeMode, parallax, parallaxOn, occ: s.signInfo, twilight, guilloche, guillocheN, hands.
```

`getConfig()` returns `toConfig(state)` (recomputed on change, cached for the
per-frame read — cheap, no DOM read). The loop consumes this; it owns dial *rendering*.

### Where styling lives: distributed into the controls

Each control owns the visual effect it governs and applies it when it receives its
value. Two kinds of effect, with different mechanics:

- **Boolean layer toggles** (`hide-orbits`, `hide-spokes`, `hide-twilight`,
  `hide-moon`, `hide-guilloche`, `hide-hands`; `full-screen` for case size). These are
  **independent, composable** root classes: `up(root, { class })` with the `!`-prefix
  adds/removes exactly the one named class. So each toggle control can own and apply
  its own class with no coordination. (`handsHidden` is just `!hands`; the old
  `updateHands()`-on-speed-change was redundant and disappears.)
- **CSS custom properties** (material var map + color overrides). These are the
  exception — see the open question: `--x` can only be written through a whole-string
  cssText (the object style path can't set `--*`), and that string also carries
  `--dial-px` (owned by `client.ts`). Whole-string writes don't distribute cleanly.

### Reusable control FCCs (own their value + their styling)

Each is an `FCC` whose props carry the current value, an `onChange`, and the styling
target it owns. It renders its own UI from the value, applies its own effect, and
emits the new value on interaction. It knows nothing about `ControlsState`, `cfg`,
persistence, or any *other* control's effect.

```ts
RangeControl({ id, min, max, step, value, format, onChange })   // <input range> + <span.val>
// CheckControl owns its hide-* class: applies up(root, {class}) from `checked` on render.
CheckControl({ id, checked, rootClass?, root, onChange })       // <input checkbox>
SegmentGroup({ id, items, value, onChange })                        // .btn-group + seg buttons, marks active
//   caseSize SegmentGroup also owns the `full-screen` class (applied from its value).
MaterialPicker({ materials, value, sink, onChange })            // swatch row, marks active; writes vars via `sink`
ColorPicker({ varName, value, def, sink, onChange })            // <input type=color>; writes its var via `sink`
```

`root`/`rootClass` and `sink` are the styling targets passed in so the control stays
isolated and unit-testable (no global `document` reach, no knowledge of siblings).
The `sink` is the shared cssText writer the open question is about.

Reconcile note: on **user** interaction the control's own DOM is already correct
(native input set it), so re-render is idempotent. On **reset/restore** the drawer
calls `drawer.update({ state })`, which re-renders every control from state — the one
path that programmatically moves the controls, and the one that re-applies effects.
No `setChk`, no manual replay.

### Persistence (v2)

```ts
const STORAGE_KEY = "astrolabe.controls.v2";
persist(s):      try { localStorage.setItem(KEY, JSON.stringify(s)) } catch {}
loadState():     parse → validateState (parse-don't-validate, field-by-field vs DEFAULTS) → ControlsState
reset():         state = DEFAULTS; drawer.update({ state }); localStorage.removeItem(KEY)
                 // drawer.update re-renders every control, which re-applies its own effect
```

No capture-by-reading-DOM: the state object *is* the snapshot.

### Target `controls.ts` skeleton

```ts
export function initControls(drawer: ControlsDrawerHandle): { getConfig: () => Config } {
  let state = loadState() ?? DEFAULTS;
  let cfg = toConfig(state);

  function setState(patch: Partial<ControlsState>) {
    state = { ...state, ...patch };       // single source of truth
    cfg = toConfig(state);                // data for the loop (not styling)
    persist(state);                       // serialize the state object as-is
    drawer.update({ state });             // push down; controls re-render + re-apply their own effects
  }

  // First paint: hand the controls their state once; each applies its own effect.
  drawer.update({ state, onChange: setState, onReset: reset, onToggle: togglePanel });
  return { getConfig: () => cfg };
}
```

The controller has no `applyProjections` and never touches `:root`. Styling is the
controls' job, reached only through `drawer.update({ state })`.

`buildStage()` returns a single `ControlsDrawer` FCC handle (plus the dial/overlay
handles) instead of the 22-field `ControlHandles` bag. Panel open/close + `aria-expanded`
stay as drawer-local UI state (not part of the persisted `ControlsState`).

## Wrinkles to honor (where prior attempts snagged)

- **Single handler per event type (Jiffies).** Each control wires exactly one
  `input`/`change`/`click` handler that calls `onChange`. Apply-its-effect happens in
  the control's own render (driven by the value it receives back via `drawer.update`),
  never as a second listener; persist happens in `setState`.
- **No raw DOM.** All writes stay through `up()` / FCC `.update()`; the no-raw-dom
  feature test and `frame-roundtrip` adopt-swap test must stay green. `sizeDial` host
  sizing in `client.ts` is unchanged (still the sanctioned page-lifecycle exception).
- **Boolean toggles distribute cleanly; CSS vars do not.** `up(root, { class })` is
  incremental, so each toggle control owns its own class independently. Custom
  properties can only be written as one whole-string cssText (object style can't set
  `--*`), and that string also carries `--dial-px` (owned by `client.ts`) — so the
  color/material controls cannot each write their own var in isolation without
  clobbering. This is the one place pure distribution meets a hard DOM-API wall.

## CSS-var application — decided: shared `sink` (A)

The boolean toggles distribute cleanly; CSS **custom properties** collide with the
cssText-only constraint, so they apply through a shared root-style `sink`:

```ts
interface RootStyleSink { set(varName: string, value: string): void } // merge + flush whole cssText once
```

`sink.set("--orbit", value)` merges into a var map and flushes the whole cssText in
one pass (re-emitting `--dial-px`, owned by `client.ts`). The *decision* — which var,
what value — stays in each color/material control; only the *mechanism* of the
whole-string write is shared, because the DOM forces it. Booleans stay fully
distributed; vars are cooperatively distributed.

> Deferred (per user, 2026-06-24): a larger refactor of CSS into proper components
> can revisit the `sink` later. For #2 the shared `sink` is the chosen seam.

Remaining nit (implementer's call, parity-preserving): `RangeControl` may own its
readout `<span class="val">` (boundary renders both) or stay split with the label
`row()` owning it. Default to **owning both** (cleaner isolation); revert if the
Closing Bell flags any markup-parity issue.

## Feature test (defines done for #2)

Extend `controls-apply.feature.test.ts` (or a sibling) to assert, against a
client-built stage: setting each control's value (a) projects to the right
`cfg` field / root class / root var, (b) survives a serialize→reparse→reload by
restoring from the v2 blob, and (c) `reset()` returns every projection to `DEFAULTS`
and clears storage. Existing control/persistence feature tests are migrated, not
deleted.
