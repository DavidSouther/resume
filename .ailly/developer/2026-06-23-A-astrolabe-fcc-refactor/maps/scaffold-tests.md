# Map — Page scaffold, the test contract, and the controls surface

Read-only reconnaissance for the Astrolabe FCC refactor (parity). Two products:
(1) the exact selectors/ids/classes/text the live tests read — the **projection
contract** the new `view.ts` must satisfy; (2) the Feature-2 inventory of every
form construction, value binding, listener, and class/style/dataset write in
`controls.ts` + `pages/astrolabe/page.ts`.

---

## 1. The page scaffold (`pages/astrolabe/page.ts`)

`default()` returns a `div#stage-wrap` built from jiffies `html.ts` builders,
containing in order:

- `div#strap[aria-hidden]` → `.strap-band.strap-top`, `.strap-band.strap-bottom`
- `button#gear[aria-label="Toggle controls"]` text `☰` (the pancake toggle)
- `buildControlsPanel()` → `div#controls[aria-label="Controls"]` (see §3)
- `div#tip` (tooltip host — document overlay)
- `div#signcard` (sign-card host — document overlay)
- `buildDial()` → the `svg#dial` (see §2)

`head()` injects `pageHead("Astrolabe")`, `<style>ASTROLABE_CSS</style>`, and the
astronomy-engine CDN `<script src=...>`. `clientModules: ["/src/components/astrolabe/client.ts"]`.

The page is rendered by SSG; `astrolabe.feature.test.ts` runs a real `npm run build`
and asserts the emitted HTML contains `viewBox="0 0 1000 1000"`, a `<g`, `id="controls"`,
the `astronomy-engine` CDN, an `/assets/*.js` bundle, and **not** `window.claude`.
NOTE: SSG auto-emits `#__hydration` + capture stub only for `data-fc` boundaries —
introducing FCCs changes the emitted HTML but the assertions above are substring/regex
and stay satisfied (an FCC `<g data-fc>` still matches `<g`).

### `buildDial()` (`src/components/astrolabe/dial.ts`) — the static SVG skeleton

`svg#dial[viewBox="0 0 1000 1000" preserveAspectRatio="xMidYMid meet"]`. CX=CY=500.
Children in z-order (the contract the frame test and animation both depend on):

| node | id / class | role |
|---|---|---|
| `defs` | — | `clipPath#dialClip` (circle r470); `clipPath#guillocheClip` → `path#guillocheClipPath[fill-rule=evenodd][d=""]` (d set per frame); `radialGradient#twilightGrad`, `#vignette`, `#sunGlow` (stops `.sg0`/`.sg1`); `linearGradient#caseMetal` (6 stops, `stop-color:var(--case)`) |
| `circle.ground` r470 | background |
| `path#zbandBg.zband-bg` | `d=ZBAND_BG_D` const, `fill-rule=evenodd` |
| `g#guilloche[clip-path=url(#guillocheClip)]` | **dynamic host** — guilloche lines appended per frame |
| `g#spokes[clip-path=url(#dialClip)][style=display:none]` | **dynamic host** — Ptolemaic radial spokes (built once) |
| `g#texture`, `g#sparkles` | **render-once hosts** — 120 lines + 160 sparkles (initTexture) |
| `circle fill=url(#vignette)` | overlay |
| `g#zodiac` | **dynamic host** — wedges/arcs/glyphs/dividers (buildZodiac) |
| `g#discs` | **dynamic host** — planet groups (buildPlanets) |
| `path#twilightCone[fill=url(#twilightGrad)][clip-path=url(#dialClip)][opacity=0.25]` | d set per frame |
| `g#conj` | (unused host) |
| `g#sunCenter` → `circle fill=url(#sunGlow)` + `circle.sun-core` | center glow (Sun-centered frames) |
| `circle.bezel-ring stroke=url(#caseMetal)`, two `circle.bezel-edge` | bezel |
| `g#hands` → `path#handHour.hand-hour`, `path#handMin.hand-min`, `circle.hub`, `circle.hub-dot` | watch hands |
| `g#dial-g` | (unused host) |

Elements **created later by `animation.ts`** (not in dial.ts), which the new view
must own as FCC children: `text.date-month`, `text.date-day`, `circle.hit` sun-hit,
`g.disc.disc-sun#—` (Ptolemaic Sun disc, with `circle.orbit-ring` + `circle.planet.sun-disc-dot`),
the `#spokes` line children, and the `#zhits` group (created in zodiac.ts, appended to svg).

---

## 2. The projection contract — what each STAYING-GREEN test reads

These selectors/ids/classes/text are the fixed API the new `view.ts` + `simulate.ts`
must reproduce exactly. Grouped by test file.

### `frame-render.feature.test.ts` (the NEW behavioral contract — design F2-adjacent, do not weaken)
Drives: `mount(page.default())` → `svg = getElementById("dial")` → `astrolabeView(svg)`
→ `simulate(frameInput())` → `view.update(scene)`. Asserts:

- **Imports that must exist:** `simulate`, `FrameInput` from `src/lib/astrolabe/simulate.ts`;
  `astrolabeView` from `src/components/astrolabe/view.ts`; `BODIES` from `bodies.ts`;
  `Config`, `GALILEAN` from `types.ts`.
- For every `b of BODIES` (keys: neptune, uranus, saturn, jupiter, mars, earth, venus,
  mercury, moon): `typeof scene.bodies[b.key].transform === "string"` AND
  `svg.querySelector(".disc-" + b.key)` is non-null.
- `scene.sunSign` in `[0,12)`; `scene.occupancy[scene.sunSign]` contains `"earth"`.
- `scene.simClock` matches `/^\d{1,2} [A-Z]{3} \d{4}\s+·\s+\d{2}:\d{2}$/`
  (matches `fmtClock`: `DD MON YYYY  ·  HH:MM`, U+00B7 middle dot, two spaces each side).
- `svg.querySelector(".disc-mars").getAttribute("transform") === scene.bodies.mars.transform`
  → **no DOM math in view**: the disc transform is the literal Scene string.
- `svg.querySelectorAll("#zdivs .zdiv")` length 12; `#zwedges .zwedge` length 12.
- For i in 0..11: `divs[i].getAttribute("d") === scene.zodiac[i].dividerD`;
  `wedges[i].classList.contains("active") === scene.zodiac[i].active`.
- `getElementById("simClock").textContent === scene.simClock` (document-overlay FCC).

`FrameInput` shape the test constructs (this fixes the interface):
`{ config: Config, simT, bootMs, wallNow: Date, caseOffset, prevEarthMode,
mouse:{nx,ny}, interaction:{hovered,pinned,hoveredSign,pinnedSign,dragging},
layout:{rect:{left,top,width,height}, viewport:{width,height}}, color:(key)=>string }`.
Test feeds Galilean, speed 0, parallaxOn false, all interaction null/false, color stub `()=>"#888"`.

### `astrolabe.feature.test.ts` (SSG build — emitted HTML substrings)
Real `npm run build`; asserts `docs/astrolabe/index.html` contains `viewBox="0 0 1000 1000"`,
`<g`, `id="controls"`, `astronomy-engine`, `/assets/*.js`, and NOT `window.claude`.
→ The dial root must stay `svg#dial[viewBox="0 0 1000 1000"]` with at least one `<g`,
and `div#controls` must keep its id, even after the FCC rebuild.

### `control-menu.feature.test.ts` (controls drawer structure — Feature 2 must preserve)
After `mount(page.default()); initControls()`; `drawer = getElementById("controls")`:
- `getElementById("always-controls")` is **null** (no separate surface).
- `drawer.contains(getElementById(id))` true for ids: `realClock`, `simClock`,
  `earthMode`, `caseSize`, `speed`.
- `drawer.querySelectorAll("button.material-swatch").length > 0`.
- `drawer.contains(getElementById("t_orbits"))` true.
- Toggle: `getElementById("gear")` is a button; its `textContent.toUpperCase()` never
  contains `CONTROLS` or `CLOSE` (open or closed). `gear.click()` flips
  `drawer.classList.contains("open")` and sets `gear.getAttribute("aria-expanded")`
  to `String(open)`.
- `ASTROLABE_CSS` matches `/@media[^{]*min-width:\s*768px/`.

### `persistence.feature.test.ts` (controls persistence — Feature 2 must preserve)
`STORAGE_KEY = "astrolabe.controls.v1"`. Selectors it drives/reads:
- `#earthMode button[data-value="keplerian"]` (click); `getElementById("earthMode").dataset.value`.
- `getElementById("parallax")` (range; set `.value`, dispatch `input`).
- `getElementById("t_spokes")` (checkbox; set `.checked`, dispatch `change`).
- `button.material-swatch[data-material="gold"]` (click); gold sets root `--case = #d9a441`.
- `input[type=color][data-var="--ground"]` (set value, dispatch `input`).
- `getElementById("resetBtn")` (click) → `localStorage` STORAGE_KEY becomes null.
- Reads `document.documentElement.style.getPropertyValue("--case")`.
- Storage holds ONLY the STORAGE_KEY; the JSON never contains `simT`/`bootMs`/`caseOffset`.
- Malformed-blob fallback: `initControls()` does not throw; earthMode stays `galilean`.

### lib tests (PURE — `simulate.ts` must reuse these helpers, not reimplement)
All under `src/lib/astrolabe/`, environment-agnostic, no DOM:
- `math.test.ts` / `drag.feature.test.ts` / `size.feature.test.ts` /
  `mode-switch.feature.test.ts` / `reset-sim.feature.test.ts` / `hands.feature.test.ts`:
  cover `dialAngle`, `wrap180`, `displayedRate`, `dragTimeStep`, `dialSizePx`, `mmToPx`,
  `dialRotation`, `caseOffsetPreservingRot`, `helioA`, `handAngles`, `handsHidden`,
  `simTimeForNow`, `speedToMul`/`speedLabel`, `pt`, `ZODIAC_DRAG_RATE`, `SPEED_STEPS`.
- `geocentric.test.ts` / `ptolemaic.feature.test.ts`: `geoDirection(body,simT)`,
  `radialSpokes(inner,rInner,rMid,rOuter)`.
- `materials.feature.test.ts`: `MATERIALS`, `materialVars(id)`.
→ `simulate()` must call `helioA`, `geoDirection`, `dialRotation`,
`caseOffsetPreservingRot`, `handAngles`, `pt`, `guillochePoints`/`pointsToPathD`,
`radialSpokes`, `fmtClock`-equivalent — never re-derive them. None of these tests
import anything new; they stay green as long as the lib signatures are untouched.

---

## 3. Feature 2 inventory — controls forbidden-DOM call sites

The no-raw-dom guard (`EXCLUDE = {client.ts, controls.ts}`) does NOT cover controls
in Feature 1, but Feature 2 widens to `controls.ts` + `pages/astrolabe/page.ts`. Every
call below is a guard target and must be routed through a jiffies builder / `events:` /
`class` / `style` attr. `localStorage` (read/write/clear/captureSnapshot) STAYS — not DOM.

### `pages/astrolabe/page.ts` — construction-time DOM writes (move into builder attrs)
- `row()`: `lbl.setAttribute("for", forId)` → pass `{ for: forId }` to `label(...)`.
- `colorSwatch()`: `inp.dataset.var = varName`, `inp.dataset.def = defaultColor`
  → `input({ "data-var": ..., "data-def": ... })`.
- `materialButton()`: `chip.style.setProperty("--chip", swatch)` → `span({ style: { "--chip": swatch } })`;
  `btn.dataset.material = id` → `button({ "data-material": id, ... })`.
- `segGroup()`: `grp.setAttribute("role","group")` → `{ role:"group" }`;
  `grp.dataset.value = active` → `{ "data-value": active }`;
  `b.dataset.value = value` → `{ "data-value": value }`;
  `grp.appendChild(b)` → pass buttons as children to `div(...)`.
- (color pickers in `colorSwatch` and seg-group buttons are the only dataset/style/append
  sites; everything else in page.ts is already declarative builder calls.)
- **Contract preserved:** ids/classes/data-* must be byte-identical — every selector in
  §2 (`#earthMode`, `[data-value]`, `.material-swatch[data-material]`, `[data-var]`,
  `.btn-group[id]`, `#t_*`, `#parallax`, `#realClock`, `#simClock`, `#gear`, `#resetBtn`,
  `#closeBtn`) reads these exact strings.

### `controls.ts` — runtime DOM mutations (route through FCC update/attrs/events)
classList toggles (forbidden `.classList`):
- `updateHands`: `documentElement.classList.toggle("hide-hands", ...)`.
- `togglePanel`: `panel.classList.toggle("open", o)`, `gear.classList.toggle("open", o)`,
  `gear.setAttribute("aria-expanded", ...)`.
- `panel.classList.add("ready")`.
- bindCheck applies: `documentElement.classList.toggle("hide-orbits"/"hide-spokes"/
  "hide-twilight"/"hide-moon"/"hide-guilloche", !v)`; `caseGroup`: `toggle("full-screen", v==="full")`.
- `bindGroup.set`: `b.classList.toggle("active", ...)`.
- `applyMaterial`: `b.classList.toggle("active", ...)`.

style writes (forbidden `.style`):
- color pickers + `applyMaterial` + reset: `documentElement.style.setProperty(var, value)`.

dataset writes (forbidden `.dataset.`):
- `applySnapshot`: `grp.dataset.value = v`.
- `bindGroup.set`: `grp.dataset.value = value`.
- reads of `.dataset.value` / `.dataset.material` / `.dataset.var` are READS — but the
  guard pattern `/\.dataset\./` flags reads too, so even reads must move to
  `getAttribute("data-...")` (a READ, permitted) or be captured via builder state.
  NOTE: `getAttribute` is NOT in the forbidden list; only `setAttribute`/`removeAttribute`/
  `toggleAttribute` are. So dataset READS become `getAttribute("data-value")`.

addEventListener (forbidden on elements):
- `gear`, `#closeBtn`, range inputs (`input`), checkboxes (`change`), seg buttons (`click`),
  material buttons (`click`), color pickers (`input`), `#resetBtn` (`click`), every
  `input[id]` (`input`+`change`), every `.btn-group button` (`click`) → all via `events:`.

innerHTML (forbidden):
- `bindRange.upd`: `out.innerHTML = fmt(v)` → text-node child via `el.update`.

synthetic dispatch (`el.dispatchEvent(new Event(...))`): NOT in the forbidden list, but
the architecture should drive `apply` directly instead of round-tripping through the DOM.

PERMITTED, keep: `getElementById`/`querySelector(All)` (reads), `localStorage.*`,
`window.matchMedia`, `window.dispatchEvent(new Event("resize"))` (window, not element),
`getComputedStyle`.

### `client.ts` (out of Feature 1 guard; revisited in Feature 2)
- `dial.style.width/height` (host `<svg>` sizing) — design says this stays a host style
  write OR routes through a root FCC `style` attr (Feature 1 plan choice).
- `documentElement.style.setProperty("--dial-px", ...)`.
- `window`/`window.visualViewport` `addEventListener` — PERMITTED page-lifecycle wiring.
- The `getElementById` rebuild (`buildZodiac`/`buildPlanets`/`initTexture`/`startAnimation`
  wiring) is replaced by hydration (`hydrate.start()`); `client.ts` then only does sizing
  + `initControls()` + start the loop.

---

## 4. The no-raw-dom guard mechanics (`no-raw-dom.feature.test.ts`)

- Scans `import.meta.dirname` (`src/components/astrolabe/`), every `*.ts` minus `*.test.ts`
  minus `EXCLUDE = {client.ts, controls.ts}`. New files (e.g. `view.ts`) auto-included.
- Requires ≥4 modules scanned (guard-the-guard).
- FORBIDDEN regexes (method-call syntax): `.appendChild(`, `.insertBefore(`, `.removeChild(`,
  `.replaceChild(`, `.createElement(NS)?(`, `.setAttribute(`, `.removeAttribute(`,
  `.toggleAttribute(`, `.classList`, `.innerHTML`, `.outerHTML`, `.textContent =` (not `==`),
  `.dataset.`, `.style`.
- LISTENER: any `.add/removeEventListener(` after stripping
  `window|document|globalThis|visualViewport.add/removeEventListener` is a failure.
- Currently RED for: animation.ts, planets.ts, zodiac.ts, texture.ts, guilloche.ts
  (all full of setAttribute/appendChild/createElementNS/classList/.style/innerHTML/
  textContent=). dial.ts is already builder-only (passes today). These dial modules'
  DOM-building roles are replaced by `view.ts` + per-subsystem FCCs.
- **The only sanctioned test edit** (design F2 guard widening) is appending `controls.ts`
  + `pages/astrolabe/page.ts` to the scan set in Feature 2; do not touch the test otherwise.

---

## 5. The Scene contract (per design + frame test) — what `simulate()` must emit

`Scene` fields, every DOM string computed in the pure layer:
- `bodies: Record<string,{transform:string, world:{x,y,a}}>` — per-body group transform
  (the exact `translate(...)`/`translate(...) rotate(...)` string animation.ts builds,
  incl. parallax px/py and the Ptolemaic earth-centered / moon cases) keyed by `b.key`.
- `sun` Ptolemaic disc `{transform, hit:{x,y}}`; `zhitsTransform: string`.
- `zodiac[12]`: `{wedgeD, arcD, dividerD, glyphTransform, active, gradientStops:{offset,color}[]}`
  — gradient COLORS resolved via injected `color()` (FILLED HOLE #1).
- `occupancy: Record<number,string[]>`; `sunSign:number`; `visibility:{sunCenter,sunDisc,spokes}`.
- `coneD:string`; `guilloche:{clipD, lines:{d, opacity?}[]}` — line list computed pure
  via `guillochePoints` (FILLED HOLE #2; `updateGuilloche`'s cache+addLine logic moves here,
  emitting `{d, opacity}` instead of appending `<path>`).
- `hands:{hourTransform, minuteTransform, visible}`; `dateComplication:{x,y,month,day}`.
- `simClock`, `realClock` (strings via `fmtClock` logic, pure).
- `tooltip:{shown, point:{x,y}, text}`; `signCard:{shown, sign, occupants:string[], point:{x,y}}`
  — note these consume `layout.rect`/`viewport` (passed in FrameInput, NOT read from DOM).
- `next:{caseOffset, prevEarthMode}` — fold-forward of the loop's mutable state
  (computed by `caseOffsetPreservingRot` on a mode switch).

`simulate` is DOM-free: `bodyColor` (getComputedStyle) becomes the injected `color()`;
`new Date()` for real clock and `Date.now()` come in via `wallNow`/`bootMs`; layout via
`layout`. The 60fps `frame()` math (lines 465–808 of animation.ts) is the body to port,
swapping every `setAttribute`/`classList`/`innerHTML` for a Scene field and every
`getBoundingClientRect`/`getComputedStyle`/`new Date()` for a FrameInput field.

---

## Key invariants for the implementer

1. `b.key` is a **string** and `BODIES` is an **array** (NOT the reference branch's Map).
2. Scene keys are string body keys; `.disc-<key>` is the class selector the frame test reads.
3. `fmtClock` format is load-bearing: `DD MON YYYY␣␣·␣␣HH:MM` (MONTHS abbrevs, U+00B7).
4. The sun-direction sign always lists `"earth"` first in `occupancy` (animation pushes it).
5. `~/` alias is typecheck-only — `simulate.ts`/`view.ts` value imports must be relative `.ts`.
6. jiffies FCC: `el.update(attrs, ...children)` reconciles children by identity/nodeName;
   a parent reconcile does NOT descend into a child FCC (the "no refs past immediate
   children" guarantee). `FCC(name, boundary, render)`; events `events:{...}`, classes
   `class` (`"!x"` removes), styles `style` (object or cssText), text via text-node child.
