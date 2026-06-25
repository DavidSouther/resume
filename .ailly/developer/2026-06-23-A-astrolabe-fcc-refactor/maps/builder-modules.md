# Map — Astrolabe static/builder modules (Feature 1 grounding)

Read-only survey of the SVG-building modules and their `src/lib/astrolabe`
dependencies. For each module: what SVG structure it builds, what is static
(built once) vs dynamic (mutated per frame), the ids/classes it emits, and which
Jiffies builders it already uses. Grounds the FCC subsystem decomposition and the
static-vs-render-once split, plus where `simulate.ts` must fill the two pure-layer
holes (gradient-stop colors, guilloche line list).

---

## CX/CY/viewBox conventions (shared)

All modules use `CX = CY = 500` on a `viewBox="0 0 1000 1000"`. `math.ts pt(c, R)`
maps a clock angle `c` (0 = top, clockwise) and radius `R` to dial coords. The
dial circle radius is 470; zodiac band is `ZIN=422 .. ZOUT=468`; zodiac glyph
label radius `ZLAB=445`; zodiac hit band `ZHIT_IN=410 .. ZHIT_OUT=472`.

---

## `dial.ts` — `buildDial(): SVGSVGElement`

The root scaffold, built **once** by `pages/astrolabe/page.ts` at SSG time.
Returns the `#dial` `<svg>` with all static structure plus empty host `<g>`s that
other modules / the animation loop populate. **Pure builder, no DOM mutation** —
already 100% Jiffies builders (`svg as buildSvg, circle, clipPath, defs, g,
linearGradient, path, radialGradient, stop`). No `appendChild`/`setAttribute`.

Builds, in document order:

- `<defs>` (all **static**, render-once content):
  - `clipPath#dialClip` → `circle r=470` (dial boundary clip)
  - `clipPath#guillocheClip` → `path#guillocheClipPath` with `fill-rule=evenodd`,
    **`d` mutated every frame** by animation (set to `DIAL_CIRCLE`, line 735).
  - `radialGradient#twilightGrad` (static stops)
  - `radialGradient#vignette` (static stops)
  - `radialGradient#sunGlow` → stops `class="sg0"/"sg1"` (static)
  - `linearGradient#caseMetal` (6 static stops, `var(--case)` tinted) — the bezel.
- `circle.ground r=470` — background
- `path#zbandBg.zband-bg` — hardcoded `ZBAND_BG_D` annulus (static)
- `g#guilloche clip-path=url(#guillocheClip)` — **dynamic host**, populated/cleared
  per frame by `updateGuilloche` (guilloche.ts).
- `g#spokes clip-path=url(#dialClip) style=display:none` — **dynamic host**; lines
  built once by animation (radialSpokes), `style.display` toggled per frame.
- `g#texture` — **dynamic host**, populated once by `initTexture`.
- `g#sparkles` — **dynamic host**, populated once by `initTexture`.
- `circle fill=url(#vignette)` — static overlay
- `g#zodiac` — **dynamic host**, populated once by `buildZodiac`.
- `g#discs` — **dynamic host**, populated once by `buildPlanets`; `#sunDisc`
  inserted before it by animation.
- `path#twilightCone fill=url(#twilightGrad) clip-path=url(#dialClip) opacity=0.25`
  — **dynamic**, `d` set per frame by animation (the twilight wedge).
- `g#conj` — host (currently unused/empty).
- `g#sunCenter` → `circle fill=url(#sunGlow)` + `circle.sun-core` — **dynamic
  visibility**: `style.display` toggled per frame (hidden in Ptolemaic).
- `circle.bezel-ring stroke=url(#caseMetal) stroke-width=28` (static)
- `circle.bezel-edge r=470` + `circle.bezel-edge r=498` (static)
- `g#hands` → `path#handHour.hand-hour` (static `d`, `transform` set per frame),
  `path#handMin.hand-min` (static `d`, `transform` set per frame),
  `circle.hub`, `circle.hub-dot` (static). The **group's `style.display`** is
  toggled `none`/`""` by the drag harness (hide hands while winding).
- `g#dial-g` — host (currently unused/empty).

**Static (render-once) vs dynamic in dial.ts's own output:**
- Render-once subsystems: defs (gradients/clips), ground, zbandBg, vignette
  overlay, bezel ring + 2 edges, hub + hub-dot, the static hand `d` paths.
- Dynamic targets dial.ts creates that the loop later mutates: `#guillocheClipPath`
  `d`, `#twilightCone` `d`, `#handHour`/`#handMin` `transform`, `#hands` group
  `display`, `#sunCenter` `display`, `#spokes` `display`.

**FCC implication:** the defs/gradients + bezel + ground + vignette are the
"render-once FCCs" the design names; the host `<g>`s become per-subsystem FCC
boundaries (`#guilloche`, `#spokes`, `#zodiac`, `#discs`, `#hands`, `#sunCenter`,
`#twilightCone`).

---

## `planets.ts` — `buildPlanets(grp: SVGGElement): PlanetRefs`

Populates `#discs` once with one `<g>` per body in `BODIES` (bodies.ts). Builders:
`circle, ellipse, g, line`. **Uses raw `grp.appendChild`/`group.appendChild`** —
forbidden; must move to FCC child lists.

Per body `b` (origin `ox,oy` = `(CX,CY)` for orbiting bodies, `(0,0)` for Moon;
dot at `dx = ox + b.r`):
- `g.disc.disc-${b.key}` ← **the `.disc-<key>` class the frame test asserts.**
  - `circle.orbit-ring cx=ox cy=oy r=b.r`
  - `line.spoke x1=ox y1=oy x2=dx y2=oy`
  - if `b.ring` (Saturn): `ellipse.saturn-ring` rx/ry off `b.dot`
  - if `b.key==="earth"`: `circle.earth-ring r=b.dot+3`
  - `circle.planet cx=dx cy=oy r=b.dot fill=var(--${b.key})`
  - `circle.hit r=max(16,b.dot+11)` — the hover/drag target.

Returns `PlanetRefs = Record<string, Element>` (key → the `<g>`). **All static
geometry** — only the group `transform` changes per frame (animation sets it). The
Moon group is special: animation sets a `translate(...) rotate(...)` placing it on
Earth each frame; non-Moon groups get `translate(parallax) rotate(da CX CY)`.

**Dynamic per frame (set by animation, NOT here):** `group.setAttribute("transform", ...)`
for every body. So the per-body FCC's only dynamic input is `transform` (plus the
disc-sun, see animation.ts). Everything inside (rings, spoke, planet dot, hit) is
render-once.

The `.hit` child is the event target the loop wires `pointerenter/leave/click`
(hover) and `pointerdown/move/up/cancel` (drag) onto — these become `events:` attrs
on the hit `circle` builder.

---

## `zodiac.ts` — `buildZodiac(grp: SVGGElement): ZodiacRefs`

Populates `#zodiac` (and appends `#zhits` to the svg) once with the 12-fold zodiac.
Builders: `g, linearGradient, path`; uses `pt` (math.ts) and `GLYPHS` (bodies.ts).
**Uses raw `appendChild` extensively** (to `defs`, to `grp`, to sub-groups, to svg)
— forbidden.

Structure emitted:
- `g#zwedges` → 12× `path.zwedge d=<curved wedge> fill=url(#zgrad{i})`.
  **`d` and `.active` class are dynamic per frame.** ← frame test asserts
  `#zwedges .zwedge` count 12 and `.active` matches `scene.zodiac[i].active`.
- `g#zarcs` → 12× `path.zarc d=<inner arc> stroke=url(#zgrad{i})`. `d` + `.active`
  dynamic per frame.
- 12× `linearGradient#zgrad{i}` appended to **`<defs>`** (via `svg.querySelector("defs")`).
  Stops are EMPTY at build; **animation fills stops each frame** via
  `setGradientStops` (the gradient-stop color hole the design moves into `simulate`).
  `grads[]` are the retained refs the loop mutates. x1/y1/x2/y2 are static
  (inner-edge endpoints `iA`,`iB`).
- `g#zdivs` → 12× `path.zdiv d=<radial line>`. **`d` dynamic per frame.** ← frame
  test asserts `#zdivs .zdiv` count 12 and `d` === `scene.zodiac[i].dividerD`.
- 12× `g.zglyph` (each holds the body-glyph `<path d>` strokes from `GLYPHS[k]`).
  **`transform` + `.active` dynamic per frame** (glyph rides label radius `ZLAB`).
- `g#zhits` appended to the **svg root** (not `#zodiac`) → 12× `path.zhit d=<hit wedge>`.
  Static `d`; the **group `#zhits` `transform` is set per frame** (`rotate(rot)`),
  and each `.zhit` is the sign hover/drag event target.

Returns `ZodiacRefs { wedges, arcs, glyphs, hits, grads, divs }` — six parallel
12-element arrays of retained refs. Maps directly onto the design's
`zodiac[12]` Scene slice `{ wedgeD, arcD, dividerD, glyphTransform, active,
gradientStops }`. The retained `grads[]` + `setGradientStops` is exactly the
gradient-color hole `simulate` fills (emit `gradientStops: {offset,color}[]`;
FCC builds `stop()` children).

**Static vs dynamic:** the 12 gradients' position attrs, the glyph path `d`s, the
zhit `d`s are render-once. Dynamic per frame: wedge `d`, arc `d`, divider `d`,
glyph `transform`, the `.active` class on wedge/arc/glyph, the gradient stop
children (color), and the `#zhits` group `transform`.

---

## `texture.ts` — `initTexture(svg): void`

Populates `#texture` and `#sparkles` (hosts from dial.ts) **once**, plus appends a
`radialGradient#dialSheen` to `<defs>`. Builders: `circle, line, radialGradient,
stop`; uses `pt`. **Uses raw `appendChild` and `c.style.setProperty`** — forbidden.

- `defs` ← `radialGradient#dialSheen` (3 static stops).
- `#texture` ← `circle r=468 fill=url(#dialSheen)`, then **120** `line.tline`
  (radial hairlines, `stroke-width=0.7 stroke-opacity=0.07`).
- `#sparkles` ← **160** `circle.sparkle` with per-sparkle CSS custom props set via
  `c.style.setProperty("--o1"/"--o0"/"--d"/"--dl", ...)`. These four `style`
  writes must become a `style` object attr on the `circle()` builder
  (`style: { "--o1": ..., ... }`), since the engine's `update` writes `style` keys
  directly (dom.js line 86).

**Entirely render-once** — the loop never touches texture/sparkles after init.
Clean fit for a render-once FCC (the design's "texture: 120 lines + 160 sparkles").

---

## `guilloche.ts` — pure helpers + `updateGuilloche` (the impure one)

Two layers:

1. **PURE (keep, used by simulate):**
   - `guillochePoints(Ex, Ey, phi, rFrom, rTo, samples): {x,y}[]` — the curve
     sampler (log-scale heliocentric→dial projection). **This is the
     `guillochePoints` source the design says already lives in lib's role** (it is
     in components/ today but is pure and DOM-free; `simulate` imports it).
   - `pointsToPathD(points): string` — points → `d` string.
   - `guillochePathD(...)` — convenience wrapper.
   - internal `angDelta`, `uniformPhis` (pure).
2. **IMPURE (`updateGuilloche(svg, Ex, Ey, n, visible, exCenter, exHalf)`):** the
   only DOM-mutating function here. It:
   - `querySelector("#guilloche")` host,
   - holds module-level frame cache (`_cacheEx/Ey/N/ExC/ExH`) to skip recompute,
   - computes the `opacityFor(phi)` fade ramp (twilight band),
   - **`while (host.firstChild) host.removeChild(...)`** then builds lines via
     **`document.createElementNS(SVGNS, "path")` + `setAttribute`** in `addLine`
     — all forbidden.
   - Emits up to `3n+...` `path.guilloche-line` (main curves B→MAX_R, inner curves
     R_SUN→B, interleaved outer curves R_MARS→MAX_R), each with optional `opacity`.

**Design split:** the **guilloche line list** (each `{ d, opacity? }`, the fade
math, the cache) moves into `simulate` as `scene.guilloche.lines`; the
`#guilloche` FCC just maps the list to `path()` children. `scene.guilloche.clipD`
carries the `#guillocheClipPath` `d` (the `DIAL_CIRCLE` set in animation line 735).
Constants to carry over: `A=69.5, B=168.4, R_MARS=197.5, MAX_R=422, SAMPLES=50,
R_SUN=40`, `FADE=10°`.

---

## `src/lib/astrolabe` dependencies (all pure, all kept as-is)

- **`bodies.ts`** — `BODIES: Body[]` (array; `b.key: string` — NOT a Map, per
  design's explicit non-adoption of the reference branch). `EARTH`, `SATURN`,
  `EARTH_YEAR`, `MAX_SPEED`, `SIGNS`, `SIGN_FULL`, `ABBR`, `FULLNAME`, and
  `GLYPHS: string[][]` (12 sets of stroke `d`s). `simulate` and the zodiac/discs
  FCCs read these.
- **`materials.ts`** — `MATERIALS`, `materialVars(id)` (color presets). Drawer/
  Feature 2 concern; not a dial-frame input.
- **`geocentric.ts`** — `geoDirection(body, simT): number` (Ptolemaic sight line),
  `radialSpokes(inner, rInner, rMid, rOuter): {x1,y1,x2,y2}[]` (the static
  Ptolemaic spokes the loop builds once into `#spokes`). Both pure; `simulate`
  uses them — `radialSpokes` output is render-once spoke geometry.
- **`math.ts`** — `dialAngle`, `wrap180`, `displayedRate`, `dragTimeStep`,
  `ZODIAC_DRAG_RATE`, `handAngles(date): {hour,minute}`, `mmToPx`, `dialSizePx`,
  `handsHidden`, `simTimeForNow`, `dialRotation(mode,aE,caseOffset)`,
  `caseOffsetPreservingRot`, `helioA(b,t)`, `pt(c,R)`, `dirToSign`, `SPEED_STEPS`,
  `speedToMul`, `speedLabel`. The core frame math `simulate` orchestrates.
- **`types.ts`** — `Body`, `SizeMode`, `EarthMode` (`PTOLEMAIC=1, GALILEAN=2,
  KEPLERIAN=3`), `Config`, `GeoPosition`. The `FrameInput.config` type.

---

## How gradient stops are built today (the hole to move)

`animation.ts setGradientStops(grad, keys)` (lines 85–101): clears the gradient
with `removeChild`, then for a single occupant emits two stops of the same color,
else N stops at `offset = i/(N-1)*100%` colored by `bodyColor(key)` =
`getComputedStyle(documentElement).getPropertyValue("--"+key)`. **In the new
design** `simulate` computes `gradientStops: {offset, color}[]` using the injected
`color(key)` resolver (the `FrameInput.color` field; frame test stubs it to
`"#888"`), and the zodiac/gradient FCC renders `stop({ offset, "stop-color": color })`
children — no `appendChild`, no `getComputedStyle` in the pure layer.

---

## The animation loop's per-frame DOM writes (what view.update must replace)

`startAnimation` (animation.ts 108–811) is the braided loop. Its forbidden DOM
mutations, by Scene slice (these define the dynamic FCC handles `view.ts` owns):

- **bodies/discs:** `group.setAttribute("transform", ...)` per body
  (`scene.bodies[key].transform`); Moon translate+rotate; sun disc
  `sunDisc.setAttribute("transform")` + `sunHit cx/cy`. Sun disc + hit are built
  in animation today (`g.disc.disc-sun`, `circle.orbit-ring`,
  `circle.planet.sun-disc-dot`, plus `sunHit circle.hit`) via `appendChild`/
  `insertBefore` → move to a `disc-sun` FCC + a sun-hit FCC.
- **zodiac:** `wedges[i]/arcs[i]/glyphs[i].classList.toggle("active", lit)`,
  `setGradientStops(grads[i], keys)`, `glyphs[i].setAttribute("transform")`,
  `divs[j].setAttribute("d")`, `wedges[i].setAttribute("d")`,
  `arcs[i].setAttribute("d")`, and `zhits.setAttribute("transform")`.
- **visibility/mode:** `sunCenter.style.display`, `sunDisc.style.display`,
  `spokesGroup.style.display`, `svg.classList.toggle("ptolemaic")`,
  `handsGroup.style.display` (drag) → `scene.visibility` + a root/svg `class` attr.
- **twilight:** `cone.setAttribute("d", coneD|"")` → `scene.coneD`.
- **guilloche:** `guillocheClipPath.setAttribute("d", DIAL_CIRCLE)` +
  `updateGuilloche` host rebuild → `scene.guilloche`.
- **hands:** `handHour/handMin.setAttribute("transform")` → `scene.hands`.
- **date complication:** `dateMonth/dateDay` built via `svg.appendChild`, then
  `setAttribute x/y` + `textContent =` per frame → a date-complication FCC fed
  `scene.dateComplication {x,y,month,day}`.
- **overlays (HTML, document-level):** `simClock.textContent =` /
  `realClock.textContent =` (frame test asserts `#simClock` textContent ===
  `scene.simClock`); `tip.style.left/top`, `tip.textContent =`,
  `tip.classList.add/remove("show")` → `scene.tooltip`; `signcard.innerHTML =`
  (built from `glyphSVG(i,size)` HTML string + name/planets), `signcard.style.left/top`,
  `signcard.classList.add/remove("show")` → `scene.signCard` (the inline glyph
  `<svg>` must be a built FCC subtree, NOT an HTML string).
- **events:** `svg.addEventListener` (pointermove/leave/down), per-hit
  `addEventListener` (pointerenter/leave/click, dblclick), per-hit drag listeners
  (pointerdown/move/up/cancel with `setPointerCapture`/`releasePointerCapture`).
  These become `events:` attrs on the hit/sign/svg FCC builders; the capture calls
  stay (permitted) inside handlers. `window`/`visualViewport` listeners in
  client.ts stay (permitted page lifecycle).

Mutable loop state folded forward each frame → `scene.next { caseOffset,
prevEarthMode }`: `caseOffset` (drag re-aim) and `prevEarthMode` (mode-switch
re-aim via `caseOffsetPreservingRot`), plus the `simT`/`seededPtolemaic` the
controller owns.

---

## Jiffies builder/update mechanics relevant to the split (from fc.js + dom.js)

- `FCC(name, boundary, render)` → containerless component on one `data-fc` element
  (valid inside `<svg>`); `el.update(attrs, ...children)` merges attrs, re-runs
  `render`, reconciles children. `getFCC(name)` returns the shared update for
  hydration re-wiring.
- Reconcile (`reconcileChildren`/`patchNode`) matches kept vs fresh by **identity
  first, then `nodeName`** (claims an unclaimed same-tag node and patches its
  attrs). `isUnit` (custom element or `data-fc`) is opaque — **a parent reconcile
  does not descend into a child FCC** (dom.js 264). That is the "no refs past
  immediate children" guarantee.
- `update` attr handling: `style` (string → `cssText`; object → per-key `el.style[k]=v`,
  so sparkle `--o1`/etc. go via a `style` object), `class` (space/array list,
  `"!x"` removes a class — replaces `classList.toggle`), `events: {type: fn|null}`
  (single live handler per type; `null` clears — replaces `addEventListener`),
  falsy value removes the attr, `true` sets `k=k`, else `setAttribute(k, String(v))`.
  Text children are created as text nodes by the reconciler (replaces `textContent =`).
- `pages/astrolabe/page.ts` builds the page via `html.ts` builders and currently
  uses `inp.dataset.*`, `chip.style.setProperty`, `grp.dataset`, `grp.appendChild`,
  `b.dataset` — all Feature 2 scope (controls), not Feature 1's dial guard.

---

## Subsystem → FCC decomposition (grounded recommendation)

Render-once FCCs (mounted, `update()` once, loop never touches):
- `defs`/gradients (twilightGrad, vignette, sunGlow, caseMetal, dialSheen, the 12
  zgrad position frames) + clips
- ground / zbandBg / vignette overlay / bezel ring+edges / hub
- texture (120 tlines + sheen) and sparkles (160) — design's named render-once set
- `#spokes` (radialSpokes geometry is static; only group `display` is dynamic →
  spokes could be render-once children inside a group whose `display` is a dynamic
  attr)

Dynamic FCCs (one Scene slice each, fanned by `astrolabeView.update`):
- per-body disc FCC (`.disc-<key>`, dynamic `transform`) incl. `disc-sun`
- sun-hit FCC (dynamic `cx`/`cy`, `events:`)
- zodiac FCC owning wedges/arcs/dividers/glyphs/gradients (slice `zodiac[12]` +
  occupancy/active) and the `#zhits` group (dynamic `transform`, `events:`)
- guilloche FCC (`scene.guilloche.lines` → paths; clip `d`)
- twilight cone FCC (`scene.coneD`)
- hands FCC (`scene.hands` transforms + group `display`)
- sunCenter visibility (group `display` attr)
- date complication FCC (`scene.dateComplication`)
- document overlays owned by the view: simClock/realClock FCCs (`scene.simClock`/
  `realClock` text children), tooltip FCC (`scene.tooltip`), sign-card FCC
  (`scene.signCard`, with the glyph as a built `<svg>` subtree).

Root `astrolabeView(svg)` retains only these immediate child FCC handles and the
mode/`ptolemaic` class on the svg; `update(scene)` fans each slice to its child.
