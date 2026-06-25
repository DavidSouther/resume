# Research — Astrolabe: drive all rendering through Jiffies FCCs

## Topic and Intent

Refactor the Astrolabe so that **every** DOM interaction flows through Jiffies,
with a clean architectural break between **simulation** (pure state) and
**rendering** (Jiffies Function Components). In the user's framing:

- The rendering layer holds **no retained DOM refs deeper than an FCC's
  immediate children**. Each FCC owns its own subtree and rebuilds it from
  attributes; the animation loop never reaches into descendants.
- **FCCs drive the entire SVG rendering process.** The dial is a tree of
  components updated from the root each frame.
- **Hard constraint — any raw DOM call is a failure.** No `appendChild`,
  `insertBefore`, `removeChild`, `createElement(NS)`, `setAttribute`,
  `removeAttribute`, `addEventListener`, `removeEventListener`, `innerHTML`,
  `textContent`, `classList.*`, `style.*`, `dataset.*`, `toggleAttribute`,
  `setPointerCapture`-adjacent wiring done by hand, or DOM strings. The **only**
  permitted hand-written values are SVG attribute payloads — `d`, `transform`,
  gradient stop offsets, etc. — and only as *string values passed to a Jiffies
  builder/`update` call* inside an FCC's render code.
- **Decided scope (this session): SVG rendering AND the HTML controls drawer.**
  `controls.ts` form wiring and `pages/astrolabe/page.ts` markup are in scope —
  every DOM interaction routes through Jiffies, not only the dial.

Source: `src/components/astrolabe/*` (rendering + controls), `src/lib/astrolabe/*`
(math/bodies/geometry — already pure), `pages/astrolabe/page.ts` (SSG markup).

## Search/Expand (general lens)

**Jiffies already ships the exact tool.** `@davidsouther/jiffies/dom/fc.ts`
exports `FCC(name, boundary, render)` — a *containerless* function component
whose boundary is a single real element marked `data-fc`, so it can root an
SVG-namespace subtree (an HTML custom element is not valid inside `<svg>`).
Verified contract (`lib/esm/dom/fc.d.ts`, `dom.js`):

- `FCC<Props>("name", g, (el, attrs, children) => Element | Element[])` returns a
  constructor. `render` returns the boundary's **children** (flat list); the
  factory builds the parent. Per-instance state lives on `el` (`el[State]`), so
  one shared `update` serves every instance.
- The element carries `.update(attrs?, ...children)`. Calling it **merges** attrs,
  re-runs `render`, and **reconciles** the output against the live children
  (`reconcileChildren`): nodes are matched by identity, then unclaimed mounted
  element nodes are patched in place when `nodeName` matches (`patchNode` copies
  attributes + events and recurses — but treats nested units as opaque). So
  re-running render each frame **patches attributes onto kept nodes** rather than
  recreating them.
- **Events are first-class attrs**, not `addEventListener`: `events: { click: fn,
  pointerdown: fn }`. `update` diffs the element's `[Events]` map and
  rebinds/clears so each type has exactly one live handler. `null` clears a
  handler. This is the sanctioned replacement for every `addEventListener`.
- **`class`** accepts a string or array; `"!foo"` removes a class (sanctioned
  replacement for `classList.toggle`). **`style`** accepts a string (`cssText`)
  or a `Partial<Properties>` object (replacement for `style.setProperty` /
  `style.display = ...`). Truthy attr values `setAttribute`; falsy
  `removeAttribute`; `true` sets a boolean attribute.
- `isUnit` / `data-fc`: a parent reconcile does **not** descend into a child FCC.
  Each FCC is an opaque subtree boundary — this is precisely the "no retained
  refs past immediate children" guarantee, enforced by the engine.

**SVG builders** (`dom/svg.ts`): `svg, g, circle, line, path, ellipse, text,
tspan, defs, clipPath, linearGradient, radialGradient, stop, rect, polygon,
use, …` — each `(attrs?, ...children) => Element`, namespace-correct, sharing the
same `update` mechanics. **HTML builders** (`dom/html.ts`): `div, button, input,
label, span, details, summary, …` for the controls drawer.

**Established practice this matches:** retained-mode → data-driven immediate-ish
rendering with reconciliation (React/Elm/lit-html lineage). The standard split is
*pure view-model → declarative render → diff/patch*. Jiffies' reconcile is the
patch step; the FCC tree is the declarative render; a pure `simulate(input) →
scene` is the view-model.

## Falsification/Refine (specific lens)

**Size: a project (decided).** Two largely-independent surfaces sit under one
intent, so this runs as a project cycle (`developer/references/project-cycle.md`),
with a development cycle per feature and a Closing Bell usability study as the
exit criterion rather than a single executable test. Provisional feature
breakdown (design confirms/sequences):

1. **Dial render pipeline** — pure `simulate(input) → Scene` + the SVG subsystem
   FCC tree + the per-frame loop rewrite + document overlays (clocks/tip/card).
2. **Controls drawer** — `controls.ts` + `pages/astrolabe/page.ts` rebuilt so all
   form construction, binding, listeners, `class`/`style`/`dataset` go through
   Jiffies; `localStorage` persistence preserved.
Sequence dial-first, controls-second; the source-scan guard starts scoped to the
dial modules and widens to the controls modules in the second feature.

**Off-the-shelf?** Yes, and it is already a dependency: **Jiffies FCC is the
tool.** No new library. The work is applying it, plus extracting a pure
simulation seam.

**Smallest version that still meets the intent:**
1. A pure `simulate(input) → Scene` in `src/lib/astrolabe/` — no DOM, fully unit-
   testable — that produces *all* per-frame strings/flags (transforms, path `d`s,
   gradient stops, active flags, clock text, tooltip/sign-card text + screen
   points, visibility). The current per-frame math in `animation.ts` lines
   465–805 moves here verbatim; the **gradient-stop colors and guilloche line
   list must be computed in the pure layer** (the two holes the reference branch
   left for the view to fill).
2. An FCC tree rooted at the dial. `update(scene)` from the root each frame;
   reconcile patches. Static-but-numerous content (texture: 120 lines + 160
   sparkles; bezel; defs/gradients; sparkle keyframe vars) renders **once** —
   either as render-once FCCs the loop never re-`update`s, or behind a memo guard
   — so the 60fps path does not rebuild hundreds of inert nodes.
3. Input (pointer drag/hover/pin, parallax mouse, resize) captured through
   `events:` attrs into a plain input/interaction state object, fed to `simulate`.
4. The controls drawer (`controls.ts` + `page.ts`) rebuilt so form construction,
   value binding, `classList`/`style`/`dataset` writes, and listeners all go
   through Jiffies builders + `events:` + `class`/`style` attrs. `localStorage`
   persistence logic stays (it is not a DOM call).

**Reference-only prior art** (`origin/2026-06-17-B-astrolabe-refactor`, commit
`ea37d85`, *not* to be rebased per decision): proves the seam works. It built a
pure `simulateFrame(FrameInput) → FrameState` (≈90% complete) and a
`frame-render.feature.test.ts`, but its `view.ts` **still** used
`querySelector` + retained refs + `setAttribute`/`innerHTML`/`classList` — it
never reached FCCs, which is exactly the bar this session adds. It also carried a
`BODIES`→`Map` refactor and a `lib/astrolabe/guilloche.ts` extraction. We design
fresh on `main` and may borrow the `FrameState` *shape* as a sanity check only.

**Risks / things to verify in design:**
- **Per-frame event rebinding cost.** Re-running render every frame rebinds
  handlers on hit targets via `patchNode`. ~20 hit elements at 60fps is likely
  fine (remove+add), but the design should confirm or isolate static hit targets
  from the hot path.
- **Document-level overlays** (`#simClock`, `#realClock`, `#tip`, `#signcard`)
  live in HTML outside the `<svg>`. They must also become FCCs (they currently
  take `textContent`/`innerHTML`/`style`). `#signcard` builds an inline glyph
  `<svg>` via an HTML string today — that must become a built subtree.
- **`getComputedStyle` for body colors** (`bodyColor`) reads CSS custom props —
  that is a read, not a DOM mutation; permitted, but the *gradient stops* it
  feeds must be emitted as built `stop()` children, not `appendChild`'d.
- **`getBoundingClientRect`** reads (layout) are permitted; they feed `simulate`'s
  layout input.
- **`requestAnimationFrame`**, `localStorage`, `matchMedia`, `performance.now`,
  `Date.now` are not DOM-element mutations and stay.

## Scope

**In scope (design phase):**
- New pure `src/lib/astrolabe/simulate.ts` (name TBD) producing a complete `Scene`.
- FCC rewrite of the SVG dial: `dial.ts`, `planets.ts`, `zodiac.ts`, `texture.ts`,
  `guilloche.ts`, and the rendering half of `animation.ts`.
- FCC/Jiffies rewrite of document overlays (clocks, tooltip, sign card).
- Jiffies rewrite of the controls drawer: `controls.ts` listeners/`classList`/
  `style`/`dataset` and `pages/astrolabe/page.ts` markup helpers
  (`segGroup` `appendChild`, `lbl.setAttribute`, `dataset.*`, `style.setProperty`).
- Per-feature behavioral feature test ("done" for each cycle): a no-interaction
  frame flows `simulate → FCC.update`, the SVG is a faithful projection of the
  scene (implementation-unaware — reads rendered nodes by class/id, not refs).
- A **source-scan guard test** asserting zero forbidden raw-DOM call sites across
  the in-scope modules (dial first, widened to controls), with an allowlisted set
  of permitted reads.
- Project exit: a Closing Bell usability study (dial looks/behaves identically;
  controls drawer unchanged to the user) plus the final human code review.

**Out of scope:**
- Visual/behavioral change. The dial must look and behave identically (existing
  feature tests in `src/lib/astrolabe/*` and `src/components/astrolabe/*` stay
  green): drag winding, mode switch continuity, persistence, size, materials,
  ptolemaic retrograde, hands.
- Simulation physics changes; the math in `lib/astrolabe/math.ts`,
  `geocentric.ts`, `bodies.ts` is already pure and stays.
- Rebasing/continuing the prior refactor branch.
- New build tooling or dependencies.

## Resolved Decisions

**Answered by research/user:**
- *How wide is the zero-DOM bar?* → **SVG rendering AND the HTML controls drawer.**
- *Use the prior branch's simulateFrame?* → **No — design fresh on main**, branch
  is reference only.
- *Is there an off-the-shelf tool?* → Yes, **Jiffies FCC**, already a dependency.
- *What is the engine contract for re-render?* → `update()` merges attrs, re-runs
  render, reconciles by nodeName/identity; events via `events:` attr; classes via
  `class` (`"!x"` removes); styles via `style` object/string; child FCCs are
  opaque units. (Confirmed against `lib/esm/dom/{fc,dom,svg}.d.ts` + `dom.js`.)

**Resolved with the human (2026-06-23):**
- **FCC granularity & the static hot path** → **one FCC per visual subsystem,
  built once; the controller retains only the dynamic child FCC handles (the
  sanctioned "immediate children") and calls `.update(sceneSlice)` on each per
  frame; static subsystems (texture/sparkles/bezel/defs) are render-once FCCs
  never updated.** No memoization gymnastics required — this node count does not
  tax a 60fps loop, so the static/dynamic split is for architectural cleanliness
  (and the "no refs past immediate children" rule), not a perf optimization.
  Mount via Jiffies **hydration** (SSG renders the `data-fc` FCCs; the client
  re-attaches `update` through the registry) so `client.ts` needs no
  `getElementById` rebuild.
- **"Done" guard mechanism** → **all three.** (1) Keep the implementation-unaware
  behavioral feature test (simulate → `update` → SVG is a faithful projection of
  the scene). (2) Add a **high-level source-code scan** asserting zero forbidden
  raw-DOM call sites (`createElement(NS)`, `appendChild`/`insertBefore`/
  `removeChild`, `setAttribute`/`removeAttribute`, `addEventListener`,
  `classList`, `.style.`, `innerHTML`/`textContent =`, `dataset.`) across the
  in-scope modules, with a documented allowlist for permitted reads
  (`getBoundingClientRect`, `getComputedStyle`, `window.Astronomy`). (3) Final
  human code review.
- **One feature vs. project cycle** → **project.** Run as a project cycle with a
  development cycle per feature (dial render; controls drawer), per the Size
  decision above.

## Sources

[1] D. Souther, "@davidsouther/jiffies," `lib/esm/dom/fc.d.ts`,
`lib/esm/dom/dom.js`, `lib/esm/dom/dom.d.ts`, `lib/esm/dom/svg.d.ts`, v2026.25.0,
`node_modules/`. (FCC/FC contract, reconcile engine, events/class/style attr
handling, SVG/HTML builders.)
[2] Astrolabe source at `main` (commit `c595692`): `src/components/astrolabe/`
{`animation.ts`, `dial.ts`, `planets.ts`, `zodiac.ts`, `texture.ts`,
`guilloche.ts`, `controls.ts`, `client.ts`}, `pages/astrolabe/page.ts`,
`src/lib/astrolabe/` {`math.ts`, `bodies.ts`, `geocentric.ts`, `types.ts`}.
(Current architecture, retained-ref + `setAttribute` animation loop, raw-DOM
inventory.)
[3] Prior refactor branch `origin/2026-06-17-B-astrolabe-refactor`, commit
`ea37d85` "refactor(astrolabe): pure simulateFrame + astrolabeView component
tree": `src/lib/astrolabe/simulation.ts`, `src/components/astrolabe/view.ts`,
`src/components/astrolabe/frame-render.feature.test.ts`. (Reference: proves the
pure-simulation seam; demonstrates the view layer that did *not* reach FCCs.)
[4] Existing Astrolabe feature tests, `src/lib/astrolabe/*.feature.test.ts` and
`src/components/astrolabe/*.feature.test.ts`. (Behavior that must stay green:
drag, mode-switch, persistence, size, materials, ptolemaic, hands, control-menu.)
