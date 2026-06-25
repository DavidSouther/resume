# Design — Astrolabe: drive all rendering through Jiffies FCCs

**Project State:** Implement *(both features built 2026-06-24; awaiting Closing Bell)*
**Closing Bell:** `.ailly/developer/2026-06-23-A-astrolabe-fcc-refactor/closing-bell.md`
**Project release flag:** none required — see *Release Flagging* below.

This is a **project** design doc (per `developer/references/project-cycle.md`): one
umbrella spec covering two sequential features that deliver the refactor only as a
whole. It is long-lived and moves Review → Implement → Completed.

---

## Purpose

The Astrolabe dial and its controls drawer are rendered today by a 60fps animation
loop and an init pass that reach into the live DOM by hand: `setAttribute`,
`appendChild`/`insertBefore`/`removeChild`, `createElementNS`, `classList.toggle`,
`.style.setProperty`, `innerHTML`/`textContent =`, and `dataset.*`. Refs to deep
descendants (`#handHour`, `grads[i]`, the `#guilloche` host, each planet group) are
captured once and mutated forever. The per-frame math and the DOM writes are braided
together in [animation.ts](../../../src/components/astrolabe/animation.ts) lines
465–808.

This braiding is the problem. There is no seam at which "what the frame *is*" (pure
state) can be inspected, tested, or reasoned about apart from "how it reaches the
screen" (DOM mutation). The math is already pure in `src/lib/astrolabe/`, but the
*projection* of that math into per-frame transforms, path `d` strings, gradient
stops, occupancy flags, and clock text lives inside the imperative loop and is
only observable by reading the rendered SVG back out.

The project introduces a clean architectural break:

- A pure **`simulate(input) → Scene`** in `src/lib/astrolabe/` that produces every
  per-frame string and flag, with no DOM access — fully unit-testable.
- A tree of **Jiffies Function Components (FCC)** that render the dial and the
  controls drawer. The animation loop calls `view.update(scene)` from the root; the
  engine reconciles. No code holds a retained DOM ref deeper than an FCC's immediate
  children, and **no raw DOM mutation call survives** in the in-scope modules.

The features deliver value only together: a half-converted dial (pure simulation but
hand-mutated DOM, as the reference branch left it — see Prior Art) meets neither the
"no raw DOM" bar nor the architectural intent. The whole is "every DOM interaction in
the Astrolabe flows through Jiffies."

## Prior Art

- **Jiffies FCC** (`@davidsouther/jiffies/dom/fc.ts`, v2026.25.0) is the off-the-shelf
  tool, already a dependency. `FCC(name, boundary, render)` builds a containerless
  component whose boundary is a single real element marked `data-fc` — valid inside
  `<svg>`, where an HTML custom element is not. `el.update(attrs, ...children)` merges
  attrs, re-runs `render`, and reconciles the output against live children by
  identity/`nodeName`. Events are first-class attrs (`events: { pointerdown: fn }`),
  classes via `class` (`"!x"` removes), styles via `style` (object or cssText). A
  parent reconcile does **not** descend into a child FCC — each FCC is an opaque
  subtree boundary, which *is* the "no refs past immediate children" guarantee,
  enforced by the engine. SVG/HTML builders (`dom/svg.ts`, `dom/html.ts`) share the
  same `update` mechanics.
- **Jiffies hydration** (`dom/hydrate.ts` + `ssg/ssg.js`, verified): when SSG renders
  `data-fc` boundaries, `ssg.js` auto-emits a `#__hydration` payload and an inline
  capture stub that queues pre-hydration events. The client calls `hydrate.start()`,
  which re-wires each FCC's shared `update` from the module registry (`getFCC`),
  clears server children, and re-renders. This replaces the `getElementById` rebuild
  in [client.ts](../../../src/components/astrolabe/client.ts).
- **The reference branch** `origin/2026-06-17-B-astrolabe-refactor` (commit `ea37d85`)
  proved the simulation seam: a pure `simulateFrame(FrameInput) → FrameState` (~90%
  complete) and a `frame-render.feature.test.ts`. But its `view.ts` still used
  `querySelector` + retained refs + `setAttribute`/`innerHTML`/`classList` — it never
  reached FCCs. **We design fresh on `main`** and borrow only the *shape* of
  `FrameState`/`FrameInput` as a sanity check. The branch also carried a `BODIES→Map`
  refactor and a `guilloche.ts` extraction we explicitly **do not** adopt: on `main`
  `BODIES` is an array and `b.key` is a `string`, and the Scene keeps string keys.

## User Journey and Metrics

The Astrolabe is a public, interactive page. The end-to-end journey is unchanged by
this project — that is the point. A visitor opens `/astrolabe/`, watches the orrery
animate, drags a planet to wind time, switches Earth frame (Ptolemaic/Galilean/
Keplerian), opens the controls drawer, toggles layers, recolors materials, resizes
the case, and reloads to find their settings persisted.

**The measure of done is the Closing Bell** (recorded above): a competent first-time
visitor performs the canonical tasks and an evaluator confirms the dial *looks and
behaves identically* to `main` and the controls drawer is unchanged to the user.
There is no new user-visible capability; the acceptance bar is **parity**, judged
qualitatively, backed by the existing automated feature tests staying green.

Engineering-facing metrics that gate each feature (the executable artifacts written
in this session, see *Specification*):

- **Zero forbidden raw-DOM calls** in the in-scope modules (source-scan guard).
- **Faithful projection**: a simulated frame's `Scene` is rendered exactly onto the
  SVG with no DOM math in the component (behavioral frame test).
- **No regression**: every existing `*.feature.test.ts` and `*.test.ts` stays green.

## Specification

### The simulation/render split (the shared contract)

The seam both features and all tests depend on:

```
FrameInput  ──simulate()──▶  Scene  ──view.update(scene)──▶  DOM (via FCC reconcile)
 (pure)        (pure, lib)   (data)     (FCC tree, components)
```

- **`src/lib/astrolabe/simulate.ts`** (new, pure, no DOM import):
  - `export interface FrameInput` — `config`, `simT`, `bootMs`, `wallNow: Date`,
    `caseOffset`, `prevEarthMode`, `mouse: { nx, ny }`,
    `interaction: { hovered, pinned, hoveredSign, pinnedSign, dragging }`,
    `layout: { rect: {left,top,width,height}, viewport: {width,height} }`, and
    `color: (key: string) => string`. The `color` field is the CSS-custom-property
    resolver. Injecting it keeps `simulate` DOM-free: the controller supplies a
    `getComputedStyle`-backed resolver, and tests supply a stub.
  - `export interface Scene` — the complete per-frame projection. Every string the
    DOM needs is computed here: per-body `{ transform, world }` (keyed by string body
    key), the Ptolemaic `sun` disc transform + hit point, `zhitsTransform`, a
    `zodiac[12]` array of `{ wedgeD, arcD, dividerD, glyphTransform, active,
    gradientStops: {offset,color}[] }`, `occupancy: Record<number, string[]>`,
    `sunSign`, `visibility: { sunCenter, sunDisc, spokes }`, `coneD`,
    `guilloche: { clipD, lines: {d, opacity?}[] }`, `hands: { hourTransform,
    minuteTransform, visible }`, `dateComplication: { x, y, month, day }`,
    `simClock`, `realClock`, `tooltip: { shown, point, text }`,
    `signCard: { shown, sign, occupants, point }`, and
    `next: { caseOffset, prevEarthMode }` (the fold-forward of mutable loop state).
  - `export function simulate(input: FrameInput): Scene`.
  - **The two holes the reference branch left for the view are filled in the pure
    layer**: gradient-stop **colors** (resolved through the injected `color` field
    above and emitted as `gradientStops` data; the view builds `stop()` children from
    them, never `appendChild`) and the **guilloche line list** (`guillochePoints`
    already lives in lib; the line/opacity list is computed here, not in the view).

- **`src/components/astrolabe/view.ts`** (new):
  `export function astrolabeView(svg): { update(scene: Scene): void }`. It owns the
  dynamic FCC subsystem tree (bodies/discs, zodiac, guilloche, twilight cone, spokes,
  hands, sun disc, date complication) and the document-overlay FCCs (clocks, tooltip,
  sign card). `update(scene)` fans each scene slice to the child FCC it owns and calls
  `child.update(slice)`. The controller retains **only these immediate child FCC
  handles** — the sanctioned "immediate children". Static subsystems (texture: 120
  lines + 160 sparkles, bezel, defs/gradients) are **render-once FCCs** that
  `update()` runs once at mount and the loop never touches again.

### Feature decomposition (project plan)

```
Closing Bell: .ailly/developer/2026-06-23-A-astrolabe-fcc-refactor/closing-bell.md
Features:
- [x] Feature 1: Dial render pipeline       (built 2026-06-24)
- [x] Feature 2: Controls drawer             Depends on: Feature 1
                                              (shared contract: the no-raw-DOM guard
                                               allowlist + the FCC/hydration mount
                                               pattern established by Feature 1)
```

### Mount mechanism, as built (supersedes the "hydration" wording above)

The design called for `hydrate.start()`. As built, the dial mounts **without**
`hydrate.start()`: `client.ts` queries `#dial` and constructs the dynamic dial
client-side. The dynamic subsystems (discs, zodiac, guilloche, sun disc, date,
texture, sparkles) are built at runtime as FCC handles and carry a live `.update`.
The page-emitted static-id elements (`#twilightCone`, `#guillocheClipPath`, hands,
`#sunCenter`, `#spokes`, clocks, `#tip`, `#signcard`, and the `#dial` svg itself for
its class + parallax/clear-pin events) are driven through **Jiffies `up()`** — the
same write path `controls.ts` uses on `document.documentElement`.

This matters because a build-time-grafted `el.update()` is **lost when the browser
re-parses the serialized SSG markup**; `up()` works on any raw element and is the
correct production-faithful path. An initial build wired those elements via the
grafted `.update`, which silently no-op'd in production (tooltips, sign card,
hands-hide-on-drag, twilight cone, Ptolemaic visibility toggles, and parallax were
all dead) while passing the in-memory `frame-render` test. A third feature test,
`src/components/astrolabe/frame-roundtrip.feature.test.ts`, now serializes→reparses
the page before driving the view, locking this blind spot shut.

### Mount mechanism, post code-review (supersedes the two sections above)

Code review (`review.md`) ruled the render pipeline must contain **no DOM methods at
all — not just no mutation, but no `querySelector`/`getElementById` reads either**.
"You can't just hide them in a helper. None means none." That overturns the earlier
"reads permitted" stance baked into the no-raw-dom guard.

As re-built: a single `buildStage()` (`src/components/astrolabe/stage.ts`) constructs
the entire interactive subtree — strap, gear, controls drawer, tooltip, sign card,
and the dial (`Dial()` returns its svg plus typed handles) — and returns the root
alongside typed handles to **every** element the pipeline touches. The SSG page
(`pages/astrolabe/page.ts`) renders `buildStage().root` for first paint. The client
bootstrap (`client.ts`, the one module excluded from the guard) runs the same
`buildStage()`, then performs the one sanctioned mount swap —
`getElementById("stage-wrap").replaceWith(stage.root)` — adopting the freshly-built
tree (identical markup, so first paint is unchanged) in place of the inert reparsed
server markup. It then hands the typed handles to `astrolabeView(dial, overlays)` and
`initControls(controls)`.

Because the live DOM is now the client-built stage (whose elements carry working
grafts), the "graft lost on reparse" hazard is gone — the pipeline holds references
it built, the jiffies-native model, and never queries. `view.ts` and `controls.ts`
contain zero `querySelector`/`getElementById`; the guard's `FORBIDDEN` set is widened
to trip on those (plus `closest`/`getElementsBy*`/`replaceWith`/`replaceChildren`).
`frame-roundtrip.feature.test.ts` is repurposed to prove the adopt-swap: it reparses
the SSG output, runs the bootstrap adoption, and asserts the live `#dial` *is* the
held handle and that per-frame values reach it.

The dial leaf elements (`#twilightCone`, `#guillocheClipPath`, hands, `#sunCenter`,
`#spokes`, clocks, `#tip`, `#signcard`, and the `#dial` svg) are still driven through
Jiffies `setAttrs()` (consolidated into `src/jiffies.ts`, which wraps `up()` with the
typed-attr widening — see `jefri/jiffies#42`), on the held handles rather than on
queried elements.

**Feature 1 — Dial render pipeline.** Extract pure `simulate(input) → Scene`; build
the dial FCC tree (`view.ts` + per-subsystem FCCs replacing `dial.ts`/`planets.ts`/
`zodiac.ts`/`texture.ts`/`guilloche.ts`'s DOM-building roles); rewrite the
[animation.ts](../../../src/components/astrolabe/animation.ts) loop to capture input
through `events:` attrs into a plain interaction object, call `simulate`, then
`view.update(scene)`; convert the document overlays (clocks, tooltip, sign card —
including the sign card's inline glyph `<svg>`, today built from an HTML string) to
built FCC subtrees; mount via hydration so [client.ts](../../../src/components/astrolabe/client.ts)
drops its `getElementById` rebuild. The source-scan guard is scoped to the dial
modules for this feature.

**Feature 2 — Controls drawer.** Rebuild
[controls.ts](../../../src/components/astrolabe/controls.ts) and
[pages/astrolabe/page.ts](../../../pages/astrolabe/page.ts) so every form
construction, value binding, listener, and `classList`/`style`/`dataset` write goes
through Jiffies builders + `events:`/`class`/`style` attrs. The `localStorage`
persistence logic (`readSnapshot`/`writeSnapshot`/`captureSnapshot`) stays — it is not
a DOM call. The source-scan guard widens to the controls modules. Depends on Feature 1
because it reuses the guard harness/allowlist and the hydration mount pattern Feature 1
establishes.

Each feature runs its own design→plan→build→cleanup cycle (its own session folder,
its own `design.md`, its own behavioral feature test). This umbrella doc fixes the
shared contract and the project exit; it does not pre-empt each feature's detailed
plan.

### Permitted vs. forbidden (the no-raw-DOM bar)

**Forbidden anywhere in scope** (each is a guard failure):
`createElement`/`createElementNS`, `appendChild`/`insertBefore`/`removeChild`/
`replaceChild`, `setAttribute`/`removeAttribute`/`toggleAttribute`,
`addEventListener`/`removeEventListener`, `el.classList.*`, `el.style.*` (assignment
or `setProperty`/`removeProperty`), `innerHTML`/`outerHTML`/`textContent =`,
`el.dataset.*`, and HTML-string construction of DOM.

**Permitted** (reads and non-element APIs — documented allowlist):
`getBoundingClientRect`, `getComputedStyle`, `window.Astronomy`,
`setPointerCapture`/`releasePointerCapture` (pointer routing, not DOM mutation; called
inside `events:` handlers), `requestAnimationFrame`, `localStorage`, `matchMedia`,
`performance.now`, `Date.now`. The only hand-written *values* are SVG attribute
payloads (`d`, `transform`, gradient offsets, …) passed as **string values to a
Jiffies builder/`update` call**.

### Executable artifacts written in this session

Per the project decision, two executable tests are written now (both red against
`main`), complementing the qualitative Closing Bell:

1. **Source-scan guard** —
   `src/components/astrolabe/no-raw-dom.feature.test.ts`. Asserts zero forbidden
   raw-DOM call sites across the in-scope modules, with the allowlist above. Scoped to
   the **dial** modules now (Feature 1's bar); Feature 2 widens the module list. Red
   today because the dial modules are full of `setAttribute`/`appendChild`/etc.

2. **Behavioral frame test** —
   `src/components/astrolabe/frame-render.feature.test.ts`. Mounts the page scaffold,
   builds `astrolabeView(svg)`, computes one deterministic no-interaction frame via
   `simulate(frameInput())`, pushes it with `view.update(scene)`, and asserts the SVG
   is a faithful projection of the `Scene` (read by class/id, never by ref). Red today
   because `simulate.ts` and `view.ts` do not exist.

### Out of scope

Visual/behavioral change (parity is required); simulation physics
(`math.ts`/`geocentric.ts`/`bodies.ts` stay); the reference branch's `BODIES→Map` and
`guilloche.ts` extraction; rebasing the prior branch; new build tooling or deps.

## Alternatives

- **A — Pure `simulate → Scene` + FCC tree, controller holds dynamic child handles
  (chosen).** Clean split, engine-enforced subtree boundaries, fully testable pure
  layer. Matches the research's resolved decision and the reference branch's proven
  seam shape. Node count (a few hundred static + ~30 dynamic) does not tax 60fps, so
  the static/dynamic FCC split is for architectural cleanliness, not perf.
- **B — One monolithic root FCC taking the whole Scene.** Simpler call surface (one
  `update`), but reconciles the entire tree (hundreds of nodes) every frame and treats
  the whole dial as one unit, weakening the "no refs past immediate children" boundary
  into a single giant boundary. Rejected for per-frame cost and coarse granularity.
- **C — Keep the imperative client build; swap raw DOM calls for builder `.update()`
  on retained deep refs.** Smallest diff, satisfies the *letter* of "no raw DOM", but
  keeps retained refs deep in the tree and never extracts a simulation seam — fails
  the architectural intent. Rejected.
- **Off-the-shelf:** Jiffies FCC *is* the off-the-shelf tool, already a dependency. No
  new library is warranted; React/lit would add a runtime and a build step for a
  static SSG site that already ships its own FC engine and hydration.
- **Sizing:** a two-feature *feature-loop sequence* (no project umbrella) was
  considered. Promoted to a **project** (resolved with the human 2026-06-23) because
  the two surfaces share one contract and exit, and parity across both is judged once
  by the Closing Bell rather than two independent feature tests.

## Release Flagging

No project-level release flag. This is an internal refactor with a **parity**
acceptance bar and no user-visible change at any intermediate point: Feature 1 lands a
fully-working dial (identical behavior, FCC-rendered) and Feature 2 lands a
fully-working drawer. Neither ships a half-built user-visible capability, so
continuous deploy is safe without gating. (Recorded explicitly per project-cycle,
which asks every project to state its flag decision.)

## Summary

The project replaces the Astrolabe's hand-mutated DOM with a pure `simulate(input) →
Scene` feeding a Jiffies FCC tree, in two sequential features (dial, then controls),
exiting on a qualitative parity Closing Bell plus a source-scan guard and a behavioral
frame test (both written now, red against `main`).

**Deferred decisions** (to `TASKS.md` at cleanup):
- Exact per-subsystem FCC granularity within the dial (settled in Feature 1's own
  plan; this doc fixes only the root `astrolabeView` seam and the static/dynamic
  split).
- `client.ts` (bootstrap) is **out of Feature 1's source-scan guard scope**: its
  window/`visualViewport` listeners are permitted page-lifecycle wiring, and
  `sizeDial` writes to the `<svg>` *host* element, not a descendant. How `sizeDial`'s
  host sizing is expressed (kept as a host `style` write, or routed through a root FCC
  `style` attr) is a Feature 1 plan choice; Feature 2 revisits whether `client.ts`
  joins the guarded set once the controls drawer's mount is FCC-based.

**Feature tests (recorded for the plan phase):**
- `src/components/astrolabe/no-raw-dom.feature.test.ts` (source-scan guard, dial scope)
- `src/components/astrolabe/frame-render.feature.test.ts` (behavioral frame projection)
