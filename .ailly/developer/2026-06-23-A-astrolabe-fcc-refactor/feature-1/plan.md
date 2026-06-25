# Implementation Plan: Feature 1 — Dial render pipeline

*Draft 2026-06-24*

**Feature tests:**
- `src/components/astrolabe/frame-render.feature.test.ts` (behavioral projection)
- `src/components/astrolabe/no-raw-dom.feature.test.ts` (source-scan guard, dial scope)

**User story:** the Astrolabe dial renders identically to `main`, but every per-frame
string/flag is computed by a pure `simulate(input) → Scene` and applied through a
Jiffies FCC tree (`astrolabeView(svg).update(scene)`), so no raw DOM mutation survives
in the dial modules and no retained ref reaches past an FCC's immediate children.

**Steps:**
- [ ] Step 0: API surface area (the shared contract — `FrameInput`/`Scene`/`simulate`/`astrolabeView`)
- [ ] Step 1: Pure `simulate(input) → Scene` extracted from the animation loop
- [ ] Step 2: Static + dynamic dial FCC subsystems and the `astrolabeView` root seam
- [ ] Step 3: Document-overlay FCCs (clocks, tooltip, sign card with built glyph svg)
- [ ] Step 4: Rewrite `animation.ts` to capture interaction via `events:` and drive `simulate`→`view.update`
- [ ] Step 5: Hydration mount; drop the `client.ts` `getElementById` rebuild; express `sizeDial` host sizing

---

## FCC granularity decision (the deferred design decision, settled here)

The design fixed only the root seam and the static/dynamic split. This plan settles the
per-subsystem FCC list. Each dynamic FCC owns exactly one Scene slice; `astrolabeView`
retains only these immediate child handles and fans slices to them.

**Render-once static FCCs** (constructed at mount, `.update()` never called again):
`astro-defs` (gradients/clips), `astro-texture` (120 `tline` + sheen), `astro-sparkles`
(160 `sparkle`, CSS vars via `style` object attr), `astro-bezel` (ground/zbandBg/vignette/
bezel-ring/2 bezel-edges/hub/hub-dot), `astro-spokes-geom` (the Ptolemaic radial-spoke
`line`s from `radialSpokes(120,14,197.5,422)` — group *display* is dynamic, owned by the
spokes-visibility FCC below). `dial.ts` `buildDial()` stays as today's pure-builder
static scaffold (it already passes the guard); the render-once FCCs replace the
`appendChild`-based init in `planets.ts`/`zodiac.ts`/`texture.ts`/`guilloche.ts`.

**Dynamic FCCs** (one Scene slice each, names unique per the FCC registry):
- `astro-disc-<key>` — one per `BODIES` entry; boundary carries `class="disc disc-<key>"`
  + per-frame `transform`. Children (orbit-ring/spoke/optional saturn-ring/earth-ring/
  planet/hit) are builder leaves. Hit child gets `events:` (Step 4). **The frame test
  reads `.disc-mars`'s `transform` directly off this boundary.**
- `astro-disc-sun` — the Ptolemaic sun disc (`disc disc-sun` + orbit-ring + `sun-disc-dot`),
  boundary `transform` from `scene.bodies.sun.transform`.
- `astro-sun-hit` — `circle.hit`, `cx`/`cy` from `scene.sun.hit`.
- `astro-zodiac` — owns the four 12-arrays under `#zwedges`/`#zarcs`/`#zdivs` + 12 `zglyph`
  groups + 12 `linearGradient#zgrad{i}` (in defs) + the `#zhits` group transform. Per frame
  maps `scene.zodiac[]` → wedge `d`+`class`(active), arc `d`+`class`, div `d`, glyph
  `transform`+`class`, gradient `stop()` children from `gradientStops`, and `#zhits`
  `transform` from `scene.zhitsTransform`. (May internally split wedges/arcs/divs/glyphs/
  grads/zhits into sub-FCCs for clarity; the root only holds the `astro-zodiac` handle.)
  **Frame test reads `#zdivs .zdiv[d]` and `#zwedges .zwedge.active`.**
- `astro-guilloche` — `#guilloche` host; children = `scene.guilloche.lines.map(path)`;
  clip path `d` = `scene.guilloche.clipD`.
- `astro-cone` — `#twilightCone` `d` = `scene.coneD`.
- `astro-hands` — `#handHour`/`#handMin` `transform`; group `#hands` `display` from
  `scene.hands.visible`.
- `astro-suncenter` — `#sunCenter` `display` from `scene.visibility.sunCenter`.
- `astro-spokes` — `#spokes` group `display` from `scene.visibility.spokes`.
- `astro-date` — `date-month`/`date-day` `text` `x`/`y` + text-node child from
  `scene.dateComplication`.
- Document overlays (Step 3): `astro-simclock`, `astro-realclock`, `astro-tooltip`,
  `astro-signcard`.

`scene.visibility.sunDisc` toggles the `astro-disc-sun` boundary `display`; the root
`ptolemaic` class is set on the `<svg>` via the root's own `update` (svg is the boundary
of a thin root FCC OR `astrolabeView` updates a `class` attr through a builder-grafted
`update` on the svg element — choose builder-grafted update at build, since svg is static
from `buildDial`).

## Step 0: API surface area

New module `src/lib/astrolabe/simulate.ts` (PURE, no DOM import — relative `.ts` imports
only; `~/` is typecheck-only). New module `src/components/astrolabe/view.ts`. Signatures
fixed by `frame-render.feature.test.ts` (`frameInput()` shape) and the design contract:

```ts
// src/lib/astrolabe/simulate.ts
import type { Config, EarthMode } from "./types.ts";

export interface FrameInput {
  config: Config;
  simT: number;
  bootMs: number;
  wallNow: Date;
  caseOffset: number;
  prevEarthMode: EarthMode;
  mouse: { nx: number; ny: number };
  interaction: {
    hovered: string | null;     // body key
    pinned: string | null;
    hoveredSign: number | null; // 0..11
    pinnedSign: number | null;
    dragging: boolean;
  };
  layout: {
    rect: { left: number; top: number; width: number; height: number };
    viewport: { width: number; height: number };
  };
  color: (key: string) => string; // CSS-var resolver (getComputedStyle-backed; test stub)
}

export interface BodyScene { transform: string; world: { x: number; y: number; a: number } }
export interface ZodiacSlice {
  wedgeD: string; arcD: string; dividerD: string; glyphTransform: string;
  active: boolean; gradientStops: { offset: string; color: string }[];
}
export interface Scene {
  bodies: Record<string, BodyScene>;          // keyed by b.key (string)
  sun: { transform: string; hit: { x: number; y: number } };
  zhitsTransform: string;
  zodiac: ZodiacSlice[];                       // length 12
  occupancy: Record<number, string[]>;         // sign index -> body keys ("earth" first on sunSign)
  sunSign: number;                             // [0,12)
  visibility: { sunCenter: boolean; sunDisc: boolean; spokes: boolean };
  coneD: string;
  guilloche: { clipD: string; lines: { d: string; opacity?: number }[] };
  hands: { hourTransform: string; minuteTransform: string; visible: boolean };
  dateComplication: { x: number; y: number; month: string; day: string };
  simClock: string;
  realClock: string;
  tooltip: { shown: boolean; point: { x: number; y: number }; text: string };
  signCard: { shown: boolean; sign: number; occupants: string[]; point: { x: number; y: number } };
  next: { caseOffset: number; prevEarthMode: EarthMode };
}

export function simulate(input: FrameInput): Scene; // body in Step 1
```

```ts
// src/components/astrolabe/view.ts
import type { Scene } from "../../lib/astrolabe/simulate.ts";
export function astrolabeView(svg: SVGSVGElement): { update(scene: Scene): void };
```

Stub both: `simulate` returns a zero/empty Scene of the right shape; `astrolabeView`
returns `{ update() {} }`. After Step 0 the test imports resolve and the suite fails on
assertions, not on missing modules. `tsc`/biome/all other tests stay green.

## Step 1: Pure `simulate(input) → Scene`

**Enables:** `typeof scene.bodies[b.key].transform === "string"`, `scene.sunSign ∈ [0,12)`,
`scene.occupancy[sunSign]` contains `"earth"`, `scene.simClock` format, and provides the
exact strings the later view assertions compare against.

Port `frame()` math (animation.ts 465–808, per `map:animation-loop` §C) into a DOM-free
function, swapping every read of the world for a `FrameInput` field and every write to the
DOM for a `Scene` field. **Reuse lib helpers, never re-derive** (`map:scaffold-tests` §lib):
`helioA`, `geoDirection`, `dialRotation`, `caseOffsetPreservingRot`, `handAngles`, `pt`,
`radialSpokes`, `guillochePoints`/`pointsToPathD`. Move `fmtClock`, `MONTHS`,
`setGradientStops`'s color logic, and `updateGuilloche`'s line/opacity/cache math out of
`animation.ts`/`guilloche.ts` into the pure layer.

Fill the two reference-branch holes here:
1. **Gradient stops** — instead of `appendChild(stop(...))` colored by `getComputedStyle`,
   emit `zodiac[i].gradientStops: {offset,color}[]` using the injected `input.color(key)`.
2. **Guilloche line list** — port `updateGuilloche`'s 3 line families over `uniformPhis`
   with `opacityFor` fade into `guilloche.lines: {d,opacity?}[]`; `clipD` = `DIAL_CIRCLE`.

`new Date(bootMs + simT*1000)` for the sim clock; `wallNow` for `realClock`/`handAngles`.
`tooltip`/`signCard` positions consume `input.layout.rect`/`viewport`, never the DOM. Fold
`caseOffset`/`prevEarthMode` forward via `caseOffsetPreservingRot` on a mode switch into
`scene.next`. Keep `b.key` string-keyed (`BODIES` is an array on `main`); `occupancy[sunSign]`
always lists `"earth"` first.

**Tests** (unit, pure — no DOM): happy path drives `frameInput()` and asserts the same
invariants the feature test reads (sunSign range, earth-in-sunSign, simClock regex, every
body transform is a string). Edge cases: Ptolemaic mode (`sun.transform`/`coneD=""`/`spokes`
visible/`guilloche.lines=[]`); Keplerian; `dragging:true` (dt path); single-key vs multi-key
gradient stop interpolation; sign-card/tooltip hidden when interaction null.

**Implementation outline:** compute `aE`, `rot=dialRotation(mode,aE,caseOffset)`, `ptolemaic`;
per body `da` and the `translate(...)`/`translate(...) rotate(...)` string (parallax px/py,
earth-centered + moon special cases); occupancy from `geoDirection`; per-sign wedge/arc/div
`d` (curved via `guillochePoints`, radial fallback) + glyph transform + active + gradient
stops; visibility/cone/guilloche/hands/date/clocks/tooltip/signCard; assemble `Scene`.

## Step 2: Dial FCC subsystems + `astrolabeView` root

**Enables:** `svg.querySelector(".disc-<key>")` non-null for every body; `.disc-mars[transform]
=== scene.bodies.mars.transform`; `#zdivs .zdiv` ×12 with `d === scene.zodiac[i].dividerD`;
`#zwedges .zwedge` ×12 with `.active === scene.zodiac[i].active`.

Build the static + dynamic FCCs listed under *FCC granularity* using
`@davidsouther/jiffies/dom/svg.ts` builders + `FCC`/`getFCC` from `dom/fc.ts`. Replace the
`appendChild`-based init bodies of `planets.ts`/`zodiac.ts`/`texture.ts`/`guilloche.ts` with
FCC definitions (these files become builder-only or are folded into `view.ts`; whatever
remains in the dial dir must pass the guard). `astrolabeView(svg)` constructs each dynamic
FCC once, appends its root into the right `#discs`/`#zodiac`/`#guilloche`/etc. host group,
retains the handles, and `update(scene)` fans slices: `discHandles[key].update({class:`disc disc-${key}`, transform})`,
`zodiacHandle.update({zodiac: scene.zodiac, zhitsTransform})`, etc. **No DOM math in the
view** — every value is a literal `Scene` string. Emit identity transforms/`d`, never `""`
(falsy removes the attr). Render-once FCCs are constructed and never updated again.

**Tests:** a view-level unit test mounts `buildDial()`, builds `astrolabeView`, pushes a
hand-built minimal `Scene`, and asserts the projection (disc transforms, `#zdivs` `d`,
`#zwedges.active`). Edge cases: re-update patches in place (stable node identity across
frames); a sign flipping `active` true→false toggles the class via `"!active"`; gradient
stops rebuild as `stop()` children without `appendChild`.

## Step 3: Document-overlay FCCs

**Enables:** `getElementById("simClock").textContent === scene.simClock`; preserves the
tooltip + sign-card behavior (parity).

Convert the three document overlays (`#tip`, `#signcard`, and the `#simClock`/`#realClock`
clock-value spans built by `page.ts`) to FCCs owned by `astrolabeView`. The sign card's
inline glyph — today an `innerHTML` HTML string from `glyphSVG` — becomes a **built `<svg>`
subtree** (`svg`/`path` builders mapping `GLYPHS[sign]`), never an HTML string. Tooltip/
sign-card `class` (`show`/`!show`), `style` (left/top from `scene.tooltip.point`/
`scene.signCard.point`), and text via text-node children. Clock FCCs take `scene.simClock`/
`scene.realClock` as a text child.

**Tests:** unit — push a Scene with `simClock` text and assert the clock FCC's text-node
child equals it; push `tooltip.shown=true` and assert `show` class + position style; push a
`signCard` with a sign and assert the built glyph `<svg>` has the right `path` count.
Edge cases: `shown=false` removes `show`; sign card glyph swaps cleanly on sign change.

## Step 4: Rewrite `animation.ts` (interaction → `events:`, loop → simulate→view.update)

**Enables:** removes every forbidden call from `animation.ts` (guard turns green for it)
while preserving drag/hover/pin/dblclick behavior (parity); produces the live `scene`
stream the overlay/dial FCCs render.

Replace the imperative loop: keep a plain mutable interaction object (`mouseNX/NY`,
`hovered`, `pinned`, `hoveredSign`, `pinnedSign`, `dragging`, `dragMoved`, `simT`,
`caseOffset`, `prevEarthMode`, `bootMs`). Wire all listeners as `events:` attrs on the FCC
boundaries (per-hit pointerenter/leave/click, per-sign, svg pointermove/leave/down, Earth
dblclick, and the drag handlers — `set/releasePointerCapture` stays permitted inside
handlers). Each frame: read layout via `getBoundingClientRect`/`innerWidth/Height`, build a
`getComputedStyle`-backed `color` resolver, assemble `FrameInput`, call `simulate`, call
`view.update(scene)`, write back `scene.next.caseOffset`/`prevEarthMode`. `requestAnimationFrame`
stays. `startAnimation` now takes `(svg, view, getConfig)` (no `ZodiacRefs`/`PlanetRefs`).

**Tests:** the feature test exercises the no-interaction projection; a small unit test
asserts an event handler mutating the interaction object changes the next `FrameInput`
(controller-level, no rAF). Edge cases: drag suppresses the pin click (`dragMoved`); mode
switch re-aims `caseOffset`; pointerleave zeroes mouse.

## Step 5: Hydration mount + `client.ts` cleanup + `sizeDial`

**Enables:** the SSG build test (`viewBox`, `<g`, `id="controls"`, `astronomy-engine`,
`/assets/*.js`, not `window.claude`) stays green with `data-fc` boundaries; removes the
imperative `getElementById` rebuild from `client.ts`.

`client.ts` drops `buildZodiac`/`buildPlanets`/`initTexture` imperative wiring. On
`DOMContentLoaded`: `hydrate.start()` re-wires FCC `update`s from the registry (`getFCC`);
then grab `svg = getElementById("dial")`, `const view = astrolabeView(svg)`, `initControls()`,
`startAnimation(svg, view, getConfig)`. **`sizeDial` host sizing decision:** keep it as a
host `style` write on the `<svg>` element and `--dial-px` on `documentElement` — `client.ts`
is explicitly out of the Feature-1 guard scope (`EXCLUDE`), and these target the host, not a
descendant. (Feature 2 revisits whether `client.ts` joins the guarded set.) Static FCCs are
constructed eagerly at mount inside `astrolabeView`, so server-rendered `data-fc` children
are cleared and re-rendered consistently.

**Tests:** `astrolabe.feature.test.ts` (real `npm run build`) is the gate. Edge cases:
hydration payload index alignment for nested units; capture stub does not queue pointer
events (fine for the dial).
