# Implementation Plan: Feature 4 — Dial styling distribution + event-contract conformance

**Design:** `.ailly/developer/2026-06-23-A-astrolabe-fcc-refactor/dial-redesign.md`
(covers `review_2.md`'s dial half — the controls half shipped as Feature 3).

**Depends on:** Feature 3 (the shipped `controls-components.ts` is the yardstick: a leaf
takes a semantic value, owns the single styling effect it governs via `up(self|root, …)`,
holds no bare callbacks). This is a *redistribution* of `view.ts`'s central styling pass into
the dial leaves plus a rename of the bare-prop event channel to the standard `events` shape —
not new page surface.

**Feature test:** `src/components/astrolabe/frame-render.feature.test.ts` (extended with two new
assertions — see Step 4). The companion guards stay green throughout:
- `frame-render.feature.test.ts` (the per-frame data-projection tripwire — held green every step)
- `no-raw-dom.feature.test.ts` (`view.ts` + `components.ts` stay clean; every change via `up()`/FCC)
- `frame-roundtrip.feature.test.ts` (SSG serialize→reparse→adopt; dial-root `up()` graft stays)
- `astrolabe.feature.test.ts` (SSG build; same markup, only construction moves)

**User story:** the dial looks and behaves exactly as on `main`, but `view.ts` makes **zero**
styling decisions — each visibility/mode effect is owned by the leaf that renders it (mirroring
`CheckControl` owning its `hide-*` class), and `view.ts` shrinks to a pure fan-out of `Scene`
slices. Events ride the standard `events` prop forwarded to a named hit-child slot, not a bespoke
`hitEvents`/`signEvents` channel.

**The two axes already aligned (no work):** *State* (`simulate()` → `Scene`, fanned by
`view.update`) and *events flowing down, controller-authored* match the controls model. `Scene`
keeps carrying `visibility.*`, `hands.visible`, `ptolemaic` — that is **data**. What moves is the
**decision of how a boolean becomes a class/style**, and the **prop shape** of the event channel.

## Steps

- [ ] Step 0: API surface area — the new leaf prop shapes (`SunDisc`/`Spokes`/`SunCenter`/`Hands`
      visibility ownership; `DialRoot` mode-class owner; `events` forwarded to a named hit-child) —
      types/signatures only, no behavior change.
- [ ] Step 1: Distribute one visibility effect (`Spokes`) from `view.ts` into its FCC; prove with a
      new feature-test assertion. `frame-render` stays green.
- [ ] Step 2: Repeat for `SunDisc`, `SunCenter`, `Hands`, and the `ptolemaic` mode class until
      `view.ts` makes **zero** styling decisions (no `up(…, {style/class})` for show-hide/mode left
      in the seam).
- [ ] Step 3: Assess the event channel against the contract; honor the non-bubbling-hover exception
      (keep the per-child forwarding, documented as the sanctioned exception). No literal `events` key
      on the group boundaries — see the mechanism note in Step 3.
- [ ] Step 4: Extend `frame-render.feature.test.ts` with the two redesign assertions (distributed
      styling owned by the leaf; event-prop wiring folds loop state); fold in the `review.md` naming
      ride-along where it is mechanical and safe. Full suite green.

---

## Step 0: API surface area

The leaves stop receiving pre-decided style strings and start receiving the **semantic slice**;
each owns the `up()` that turns the slice into a class/style. Signatures only.

```ts
// components.ts — each visibility-governing leaf takes the boolean, not a style string.
// It applies its own `up()` on render and scrubs the boolean so it never lands as a junk
// boundary attribute (update() would otherwise setAttribute("visible","visible")).
interface SunDiscProps   { transform: string; visible: boolean }              // owns display
interface SunHitProps    { x: number; y: number; hitEvents?: EventMap }       // KEEP — forwarded to .hit child (see Step 3 mechanism)
interface DiscProps      { transform: string; hitEvents?: EventMap }          // KEEP — forwarded to .hit child
interface ZodiacProps    { zodiac: Scene["zodiac"]; zhitsTransform: string;
                           signEvents?: (i: number) => EventMap }             // KEEP — per-zhit forwarding (hover doesn't bubble)

// A thin effect FCC that owns a host-group's show/hide (Spokes geometry group, sunCenter, hands)
// — the dial analog of CheckControl owning a passed `root`'s class. Boundary renders nothing;
// it applies `up(root, {style})` from `visible`.
interface VisibilityProps { root: SVGElement; visible: boolean }
const Visibility: FCComponentCtor<VisibilityProps>;

// The dial root's mode class owner (ptolemaic ⇒ "ptolemaic", else "!ptolemaic").
interface DialRootProps { root: SVGSVGElement; ptolemaic: boolean }
const DialRoot: FCComponentCtor<DialRootProps>;
```

`view.ts`'s `ViewEvents`/`bindEvents` shape is unchanged at the controller seam (still
`{ body, sunHit, sign }` authored in `animation.ts`); only the *prop name* each handle receives
changes from `hitEvents`/`signEvents` to the standard `events`. `bindEvents` stays a path separate
from per-frame `update(scene)` — event maps are stable; re-fanning them at 60fps is wasteful (design
"the alignment is the prop shape, not the cadence").

---

## Step 1: Distribute the `Spokes` visibility effect

**Enables:** the feature test's new "toggling `scene.visibility.spokes` produces `display:none` on the
component that owns it, with `view.ts` making no styling decision."

`view.ts` today: `up(dial.spokes, { style: scene.visibility.spokes ? "" : "display:none" })`. Move the
decision out: introduce the `Visibility` effect FCC, hand it `dial.spokes` as `root`, and per frame call
`spokesVis.update({ visible: scene.visibility.spokes })`. `Visibility` render does
`up(attrs.root, { style: attrs.visible ? "" : "display:none" })` and returns `[]`. Delete the
`up(dial.spokes, {style})` line from the seam.

**Tests:** new assertion in `frame-render` — build the stage, run a `ptolemaic:false` frame (spokes
hidden) and a `ptolemaic:true` frame (spokes shown), assert `dial.spokes` style toggles. `frame-render`
+ `no-raw-dom` + roundtrip stay green.

---

## Step 2: Distribute the rest until the seam is styling-free

**Enables:** "`view.ts` makes zero styling decisions."

Repeat the Step-1 move for every remaining central style/class decision in `update(scene)`:
- `SunDisc`: change `{transform, style}` → `{transform, visible}`; render applies
  `up(el, { style: visible ? "" : "display:none", visible: false })` (the `visible:false` scrubs the
  junk attr applyUpdate set). Drop the `style:` computation from view.ts.
- `dial.sunCenter`, `dial.hands`: own via a `Visibility` effect FCC each (as Spokes). Drop the two
  `up(dial.sunCenter/hands, {style})` lines.
- `ptolemaic` mode class: `DialRoot` effect FCC owns `up(root, {class})`; drop the
  `up(dial.svg, {class: scene.ptolemaic ? …})` line.

After this step `view.ts`'s `update(scene)` contains **no** `up(…, {style|class})` for show-hide/mode
— only data fan-out (`transform`, `d`, zodiac, guilloche, date, clocks/tooltip/sign-card which are
content, not dial styling). Verify by inspection + the `no-raw-dom` and `frame-render` greens.

**Honored boundary (design Wrinkles):** the tooltip/sign-card `class:"show"/"!show"` and the
`left/top` positioning are **overlay content state**, not dial styling — they stay in the seam (they
have no leaf to own them and are the seam's own overlay job, like `simClock` text). Note this in the
step so it is not mistaken for a missed decision.

---

## Step 3: Assess the event channel; honor the non-bubbling-hover exception

**Enables:** the feature-test "event-prop wiring folds loop state" assertion.

**Mechanism finding (decides the whole step):** `applyUpdate` applies an FCC's props to the boundary
via `update()`, and `update()` has a hardcoded `attrs.events` branch that wires those handlers onto the
**boundary element**. So a prop *literally named* `events` on the disc/sun/zodiac group FCCs would wire
the handlers onto the orbit-ring `<g>` / `#zhits` group — enlarging the hit area to the group's bounding
box (a regression) and double-wiring. The dial's interactive children also use `pointerenter`/
`pointerleave` (hover), which **do not bubble** — so the controls' "events on the group boundary + read
`event.target`" trick cannot serve any dial target. Every dial event map must be forwarded to the
specific interactive child.

**Therefore the dial is already at the design's "honored exception"** (the analog of controls' cssText
`sink`): the controller authors the maps, they flow down, and each FCC forwards its map to the named
interactive child's `events:` — never the group boundary. The `hitEvents` / `signEvents` prop names are
*kept* precisely because they are NOT the auto-wiring `events` key; renaming them would be the
regression above. The conformance verdict is: keep the channel, tighten the doc comments to cite the
honored-exception rationale (hover non-bubbling + generous child hit), confirm the controller
(`animation.ts`) is the sole author and nothing holds a raw ref.

No behavior change. `no-raw-dom` stays green (no element `addEventListener` — all via `events:`).

---

## Step 4: Feature-test assertions + naming ride-along

**Enables:** definition of done.

Extend `frame-render.feature.test.ts` with two new `it`s (kept behavior-scoped — read nodes by
class/id, never a ref):
1. **Distributed styling:** toggling a scene boolean produces the effect on the owning leaf — e.g.
   a `ptolemaic:false` frame ⇒ `#spokes` `display:none` and `dial.svg` lacks `.ptolemaic`; a
   `ptolemaic:true` frame ⇒ spokes shown, `.ptolemaic` present, sun-center hidden. (Asserting the
   effect appears proves the leaf owns it; `no-raw-dom` proves the seam didn't.)
2. **Event-prop wiring:** wire events (`view.bindEvents({ body, sign, sunHit })` with spy maps),
   dispatch a `click` on `.disc-mars .hit` and assert the controller-authored handler (arrived via the
   standard `events` prop) ran — i.e. the named hit-child carries the listener. No raw listener, no
   bare-callback channel.

Naming ride-along (`review.md`, only the mechanical/safe subset): semantic names in the math layer
where unambiguous; `prop?: T` over `T | null` at boundaries; verb→noun at boundaries
(`buildDefs`→`DialDefs`, leave `makeDisc`). **Leave** the stateful `for` accumulators at
`simulate.ts:214/225/459/461`. Skip anything that risks a frame-render byte change — the tripwire wins
ties.

**Done = both new assertions green; `view.ts` makes zero styling decisions (each effect owned by its
leaf); events ride the standard `events` prop (bar the honored hit-child forwarding); existing suite
stays green.**
