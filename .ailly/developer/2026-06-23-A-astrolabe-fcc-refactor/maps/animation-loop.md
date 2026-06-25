# Map — animation.ts render loop DOM-mutation inventory

Source: `src/components/astrolabe/animation.ts` (init lines 108–463, per-frame loop
465–808), plus the DOM-mutating helpers it calls in `guilloche.ts` and the elements
it inherits from `planets.ts` / `zodiac.ts` (built by the page before
`startAnimation`). This is the field list for `Scene` and the per-FCC update fan-out.

Constants used below: `CX=CY=500`, `ZLAB=445`, `GLYPH_S=1.12`, `MAXPX=16`,
`R_SUN_DISC=168.4`, `R_MARS=197.5`, `MAX_SPOKE_R=422`, `R_SPOKE_INNER=14`,
`DIAL_CIRCLE = "M500 30 A470 470 0 1 1 499.99 30 Z"`, `ZIN=422`, `ZOUT=468`.

---

## A. How interaction state enters the loop (the FrameInput sources)

These mutable closures are written by event handlers and READ by `frame()`. In the
refactor they become the plain interaction object captured via `events:` attrs and
folded into `FrameInput`.

| State | Type | Written by (event) | Read in frame | FrameInput field |
|---|---|---|---|---|
| `mouseNX`, `mouseNY` | number (-1..1) | `svg` `pointermove`→`updateMouse(cx,cy)` (clamps `(c - (rect.center))/(rect.half)`); `svg` `pointerleave`→0,0 | parallax px/py (530–531) | `mouse:{nx,ny}` |
| `hovered` | `{key,name}\|null` | per-body `.hit` / `sunHit` `pointerenter`/`pointerleave` (`bindHover`) | tooltip `show = pinned ?? hovered` (791) | `interaction.hovered` |
| `pinned` | `{key,name}\|null` | `.hit` `click` toggles (245); cleared by `svg` `pointerdown` (268) and any sign click (262) | tooltip (791) | `interaction.pinned` |
| `hoveredSign` | `number\|null` | `zodiac.hits[i]` `pointerenter`/`pointerleave` (`bindSignHover`) | sign card `curSign = pinnedSign ?? hoveredSign ?? -1` (631) | `interaction.hoveredSign` |
| `pinnedSign` | `number\|null` | `zodiac.hits[i]` `click` toggles (263); cleared by `svg` `pointerdown` (269) | sign card (631) | `interaction.pinnedSign` |
| `dragging` | `{kind,prevAngle,moved,acc}\|null` | `bindDrag` `pointerdown`/`move`/`up`/`cancel` | `dt=0` while held (471); hands hidden | `interaction.dragging` (boolean in Scene contract) |
| `dragMoved` | bool | drag release if moved (415); consumed by `.hit`/sign `click` to suppress pin toggle | click handlers only | stays in controller (not Scene) |
| `simT` | number | `frame` accrues `dt*speed` (473); drag `pointermove` winds via `dragTimeStep` (401); Earth dblclick→`simTimeForNow` (443) | every body angle | `simT` |
| `caseOffset` | number | drag `pointermove` adds `dTheta` (402); re-aimed on mode switch (479) | `dialRotation` (491); folded forward as `Scene.next.caseOffset` | `caseOffset` (in), `next.caseOffset` (out) |
| `prevEarthMode` | EarthMode | reset on mode switch (485) | mode-switch re-aim guard (478) | `prevEarthMode` (in), `next.prevEarthMode` (out) |
| `bootMs` | number (`Date.now()` at init) | once | sim date `new Date(bootMs+simT*1000)` (680) | `bootMs` |
| `last`, `dt` | number | `frame` | `simT` accrual | derived from rAF `now` — controller-local |
| `seededPtolemaic` / `seedFor` | ephemeris seed | `applyEphemeris` mutates `b.start` on `BODIES` | body start phases | controller-local side effect on `BODIES`; NOT a DOM write |
| `cfg = getConfig()` | Config | external (controls) | everywhere | `config` |
| layout (`svg.getBoundingClientRect()`, `window.innerWidth/Height`) | reads | each frame | parallax clamp, tooltip/sign-card screen pos | `layout:{rect,viewport}` |
| `color` | `getComputedStyle(documentElement).getPropertyValue("--"+key)` via `bodyColor` (77–83) | gradient stops | `color(key)` resolver |

### Event listeners currently attached (init) — to become `events:`/page-lifecycle

- `svg.addEventListener` `pointermove`, `pointerleave` (parallax) — PAGE/element on svg host.
- `svg.addEventListener` `pointerdown` (clear pins) — element listener.
- `bindHover(el)` on `sunHit` + each `planets[b.key] .hit`: `pointerenter`,
  `pointerleave`, `click` — element listeners → FCC `events:`.
- `bindSignHover(zodiac.hits[i])`: `pointerenter`, `pointerleave`, `click`.
- `bindDrag(el, resolve)` on each non-moon planet `.hit`, each `zodiac.hits[i]`, and
  `sunHit`: `pointerdown`/`pointermove`/`pointerup`/`pointercancel` (uses
  `setPointerCapture`/`releasePointerCapture` — PERMITTED inside `events:` handlers).
- Earth `.hit` `dblclick` → reset simT.

---

## B. ONE-TIME (init / static) DOM writes

These run once in `startAnimation` (or in the page builders it depends on). In the
refactor they are render-once FCCs / static builder children — never touched per frame.

| # | Target node | Write | Source expression | Subsystem |
|---|---|---|---|---|
| B1 | `svg` ← `text({class:"date-month"})` appended (151) | `appendChild` | builder `text(...)` | date complication |
| B2 | `svg` ← `text({class:"date-day"})` appended (153) | `appendChild` | builder | date complication |
| B3 | `svg` ← `sunHit = circle({class:"hit",cx:500,cy:500,r:24})` (156–157) | `appendChild` | builder | sun hit target |
| B4 | `sunDisc = g({class:"disc disc-sun",style:"display:none"})` (170) | builder + `style` | static | ptolemaic sun |
| B5 | `sunDisc` ← `circle({class:"orbit-ring",cx:500,cy:500,r:168.4})` (173) | `appendChild` | static | ptolemaic sun |
| B6 | `sunDisc` ← `circle({class:"planet sun-disc-dot",cx:500+168.4,cy:500,r:21,fill:"#9C6B14"})` (179) | `appendChild` | static | ptolemaic sun |
| B7 | `svg.insertBefore(sunDisc, #discs)` (187) | `insertBefore` | order before `#discs` | ptolemaic sun |
| B8 | `#spokes` ← N× `line({class:"guilloche-line",x1,y1,x2,y2})` (194) | `appendChild` loop | `radialSpokes(120, 14, 197.5, 422)` → each `s.{x1,y1,x2,y2}.toFixed(1)` | spokes (static) |
| B9 | `planets[b.key]` groups (planets.ts) | `g`/`circle`/`line`/`ellipse` built, `grp.appendChild` | per `BODIES` b: orbit-ring/spoke/(saturn-ring)/(earth-ring)/planet `fill:var(--key)`/hit; dot at `cx=ox+b.r` | bodies/discs (static structure) |
| B10 | `#zwedges`,`#zarcs`,`#zdivs`, zglyphs, `#zhits`, `defs` gradients (zodiac.ts) | builder appends | per i in 0..11: `linearGradient#zgrad{i}` (x1,y1,x2,y2 from `pt(c0/c1,ZIN)`), straight `zwedge`/`zarc`/`zdiv` `d`, `zglyph` paths from `GLYPHS[k]`, `zhit` `d`; `svg.appendChild(zhits)` | zodiac (static structure) |
| B11 | static dial: `#handHour`,`#handMin`,`#hands`,`#twilightCone`,`#guillocheClipPath`,`#sunCenter`,`#discs`,`#spokes` | pre-rendered by `buildDial()` (page), only `querySelector`'d here | bezel/defs/hands/cone hosts | static (render-once FCCs) |

Note B8 + planets/zodiac builders already use Jiffies builders (`line`, `g`,
`circle`, `path`, …) but still `appendChild` into a host. The refactor moves the
append into FCC reconcile (children returned from `render`, not appended).

---

## C. PER-FRAME (dynamic) DOM writes

Order as in `frame()`. Each row → a Scene field consumed by a child FCC's `update`.

### C1. Mode toggles (visibility) — lines 495–499

| Target | Write | Source | Subsystem | Scene field |
|---|---|---|---|---|
| `#sunCenter` | `.style.display = ptolemaic ? "none":""` | `ptolemaic` | sun center glow | `visibility.sunCenter` |
| `sunDisc` | `.style.display = ptolemaic ? "":"none"` | `ptolemaic` | ptolemaic sun | `visibility.sunDisc` |
| `#spokes` | `.style.display = ptolemaic ? "":"none"` | `ptolemaic` | spokes | `visibility.spokes` |
| `svg` | `.classList.toggle("ptolemaic", ptolemaic)` | `ptolemaic` | (root class) | drive via root FCC `class` from `ptolemaic` |

`ptolemaic = cfg.earthMode === PTOLEMAIC`; `rot = dialRotation(cfg.earthMode, aE, caseOffset)`;
`aE = ((EARTH.start + EARTH_RATE*simT)%360+360)%360`.

### C2. Bodies / discs — loop 501–545

For each `b` in `BODIES` with group `planets[b.key]`:
- `a = ptolemaic ? geoDirection(b,simT) : helioA(b,simT)`
- `earthCentered = ptolemaic && b.key==="earth"`; `r = earthCentered ? 0 : b.r`
- `da = ((a+rot)%360+360)%360`; `rad = da*π/180`
- Moon branch (`b.moon`):
  - `group.setAttribute("transform", "translate(e.x e.y) rotate(da 0 0)")` where
    `e = world.earth ?? {x:500,y:500}`, values `.toFixed(2)`/`.toFixed(3)`
  - `world[b.key] = { x:e.x+b.r·cos(rad), y:e.y+b.r·sin(rad), a:da }`
- Non-moon branch:
  - `px = mouseNX·16·cfg.parallax·b.weight·(cfg.parallaxOn?1:0)`, `py` similarly
  - `transform = earthCentered ? "translate((px-b.r) py)" : "translate(px py) rotate(da 500 500)"` (`.toFixed(2)`/`.toFixed(3)`)
  - `group.setAttribute("transform", transform)`
  - `world[b.key] = { x:500+r·cos(rad)+px, y:500+r·sin(rad)+py, a:da }`

| Target | Write | Subsystem | Scene field |
|---|---|---|---|
| `.disc-<key>` group | `setAttribute("transform", …)` | bodies/discs | `bodies[key].transform` (string) |
| — | (compute) `world[key]` | bodies/discs | `bodies[key].world = {x,y,a}` |

(Feature test asserts `.disc-mars[transform] === scene.bodies.mars.transform` and
`.disc-<key>` exists for every `BODIES[k].key`.)

### C3. Ptolemaic sun disc + sun hit — 549–565

- If `ptolemaic`: `sa = ((aE+180+rot)%360+360)%360`, `srad=sa·π/180`
  - `sunDisc.setAttribute("transform","rotate(sa 500 500)")` (`sa.toFixed(3)`)
  - `world.sun = {x:500+168.4·cos(srad), y:500+168.4·sin(srad), a:sa}`
  - `sunHit.setAttribute("cx", world.sun.x.toFixed(2))`, `"cy"` similarly
- else: `world.sun={x:500,y:500,a:0}`; `sunHit.setAttribute("cx","500")`,`"cy","500"`

| Target | Write | Subsystem | Scene field |
|---|---|---|---|
| `sunDisc` (`.disc-sun`) | `setAttribute("transform")` | ptolemaic sun | `bodies.sun.transform` / dedicated `sunDiscTransform` per contract |
| `sunHit` | `setAttribute("cx"/"cy")` | ptolemaic sun (hit) | ptolemaic sun hit point (contract: "sun disc transform + hit point") |

### C4. Zodiac hits rotation — 567

`zhits.setAttribute("transform","rotate(rot 500 500)")` (`rot.toFixed(3)`).
→ Scene `zhitsTransform`. Subsystem: zodiac (hit group).

### C5. Geocentric directions + occupancy (compute, no DOM) — 569–612

Pure math producing `geo[key]={g,si,deg}` and `occ:Record<number,string[]>`.
`sunSi = geo.sun.si` always pushed as `"earth"` into `occ[sunSi]`. → Scene
`occupancy`, `sunSign`. (Test: `occupancy[sunSign]` contains `"earth"`,
`0<=sunSign<12`.) Feeds C6 active flags + C9 tooltip sign text + C7 sign card.

### C6. Zodiac wedges / arcs / glyphs active + glyph transform — 614–628

For i in 0..11 with `keys = occ[i]`, `lit = !!keys`:

| Target | Write | Source | Subsystem | Scene field |
|---|---|---|---|---|
| `wedges[i]` (`.zwedge`) | `classList.toggle("active", lit)` | `lit` | zodiac wedge | `zodiac[i].active` |
| `arcs[i]` (`.zarc`) | `classList.toggle("active", lit)` | `lit` | zodiac arc | `zodiac[i].active` (shared) |
| `glyphs[i]` (`.zglyph`) | `classList.toggle("active", lit)` | `lit` | zodiac glyph | `zodiac[i].active` (shared) |
| `grads[i]` (`#zgrad{i}`) | `setGradientStops(grad,keys)` when `lit` | see below | zodiac gradient | `zodiac[i].gradientStops:{offset,color}[]` |
| `glyphs[i]` | `setAttribute("transform","translate(gp.x gp.y) scale(1.12) translate(-12 -12)")` | `lc=(i·30+15+rot)%360`, `gp=pt(lc,445)`, `.toFixed(2)` | zodiac glyph | `zodiac[i].glyphTransform` |

`setGradientStops` (85–101) currently does `removeChild` loop + `appendChild(stop(...))`:
- 1 key: two stops offset 0%/100%, both `stop-color = bodyColor(keys[0])`
- N keys: stop i at `offset = (i/(N-1)·100).toFixed(1)%`, `stop-color = bodyColor(keys[i])`
- `bodyColor(key) = getComputedStyle(documentElement)["--"+key].trim() || "#888"`
→ **Hole filled in pure layer**: `Scene.zodiac[i].gradientStops` resolved via injected
`color()`; view builds `stop()` children, never appendChild.

### C7. Sign card (document overlay) — 630–665

`curSign = pinnedSign ?? hoveredSign ?? -1`; `want = cfg.occ && curSign>=0`;
`cardSig = want ? "{curSign}:{occ[curSign].join(',')}" : ""`.

| Target | Write | Source | Subsystem |
|---|---|---|---|
| `#signcard` | `.innerHTML = glyphSVG(curSign,46)+ "<div class=sc-name>"+SIGN_FULL[curSign]+"</div><div class=sc-pl>"+pl+"</div>"` (only when sig changed) | `pl = occ[curSign].map(FULLNAME).join(" · ")` or `"No planets"`; `glyphSVG` builds inline `<svg class=sc-glyph viewBox=0 0 24 24>` of `GLYPHS[i]` paths | sign card |
| `#signcard` | `.classList.add("show")` / `.remove("show")` | `want` | sign card |
| `#signcard` | `.style.left/top = "{sx+cardCX}px"/"{sy+cardCY}px"` | `cp = pt((curSign·30+15+rot)%360,445)`; `scl=rect.width/1000`; `sx=rect.left+cp.x·scl`; `sy=rect.top+cp.y·scl`; clamp `cardCX/cardCY` to 6px viewport margin using `signcard.getBoundingClientRect()` + `innerWidth/Height` | sign card |

→ Scene `signCard:{shown, sign, occupants, point}`. (Refactor: glyph inline `<svg>`
becomes a built FCC subtree from `GLYPHS[sign]`, not an HTML string; clamp uses
layout viewport. `shownCardSig`/`cardCX`/`cardCY` are render-cache state — controller
or FCC-internal, not Scene.)

### C8. Watch hands — 667–677

`hands = handAngles(new Date())` (REAL clock, not simT):
| Target | Write | Source | Subsystem | Scene field |
|---|---|---|---|---|
| `#handHour` | `setAttribute("transform","rotate(hands.hour 500 500)")` (`.toFixed(2)`) | real now | hands | `hands.hourTransform` |
| `#handMin` | `setAttribute("transform","rotate(hands.minute 500 500)")` (`.toFixed(2)`) | real now | hands | `hands.minuteTransform` |
| `#hands` (group) | `.style.display` set `"none"` on drag start, `""` on drag end (bindDrag 386/417) | dragging | hands | `hands.visible` |

### C9. Date complication + clocks — 679–695

`d = new Date(bootMs + simT*1000)`. `ew = ptolemaic ? world.sun : world.earth`.
| Target | Write | Source | Subsystem | Scene field |
|---|---|---|---|---|
| `dateMonth` | `setAttribute("x", ew.x.toFixed(1))`, `"y",(ew.y-7.5).toFixed(1)`; `.textContent = MONTHS[d.getMonth()]` | ew, d | date complication | `dateComplication.{x,y,month}` |
| `dateDay` | `setAttribute("x", ew.x.toFixed(1))`, `"y",(ew.y+4.5).toFixed(1)`; `.textContent = String(d.getDate())` | ew, d | date complication | `dateComplication.{x,y,day}` |
| `#simClock` | `.textContent = fmtClock(d)` | `fmtClock` (D MON YYYY · HH:MM) | clocks | `simClock` |
| `#realClock` | `.textContent = fmtClock(new Date())` | real now | clocks | `realClock` |

`fmtClock(d) = "{date} {MONTHS[m]} {fy}  ·  {HH}:{MM}"`. Test asserts `simClock`
matches `/^\d{1,2} [A-Z]{3} \d{4}\s+·\s+\d{2}:\d{2}$/` and `#simClock.textContent ===
scene.simClock`.

### C10. Twilight cone — 697–731

`Ex=world.earth?.x ?? 500`, `Ey=…?? 500`. `R_SUN=40`, `MAX_R=422`, `hw=12.5°`.
- If `ew && !ptolemaic`: `ds=atan2(500-ew.y, 500-ew.x)`; `exCenter=ds`;
  `exHalf = cfg.twilight ? hw : -1`. Build `edgeA=guillochePoints(Ex,Ey,ds-hw,40,422,40)`,
  `edgeB=guillochePoints(...,ds+hw,...)`. If `cfg.twilight` and both ≥2:
  `coneD = "M ew.x ew.y" + L over edgeA + "A 422 422 0 0 1 bOut.x bOut.y" + L over edgeB reversed + " Z"`;
  `cone.setAttribute("d", coneD)`.
- If `ptolemaic`: `cone.setAttribute("d","")`.

| Target | Write | Subsystem | Scene field |
|---|---|---|---|
| `#twilightCone` | `setAttribute("d", coneD or "")` | twilight cone | `coneD` |

(`exCenter`/`exHalf` also feed the guilloche fade band — passed into C11.)

### C11. Guilloche — 733–751

- `guillocheClipPath.setAttribute("d", DIAL_CIRCLE)` (735) → Scene `guilloche.clipD`.
  Subsystem: guilloche (clip).
- `updateGuilloche(svg, Ex, Ey, cfg.guillocheN, cfg.guilloche && !ptolemaic, exCenter, exHalf)`
  (739) — host `#guilloche`. Internally (guilloche.ts 156–239): early-returns if not
  visible or if cache (Ex,Ey,n,exCenter,exHalf) unchanged; else clears host
  (`removeChild` loop) and for each phi in `uniformPhis(n,aEr,197.5)` calls
  `addLine(d, op)`:
  - `addLine` (204): `createElementNS path`, `setAttribute("class","guilloche-line")`,
    `setAttribute("d",d)`, `setAttribute("opacity",op.toFixed(3))` if op<1, `appendChild`.
  - Three line families: main `guillochePathD(Ex,Ey,phi,168.4,422,50)`; inner
    `(…,40,168.4,50)`; outer-interleaved at mids `(…,197.5,422,25)`. Skip when `d===""`
    or `op<=0`. `opacityFor(phi)` is the fade ramp over the twilight band.
- If `ptolemaic`: clear `#guilloche` host (`removeChild` loop, 748–751).

| Target | Write | Subsystem | Scene field |
|---|---|---|---|
| `#guillocheClipPath` | `setAttribute("d", DIAL_CIRCLE)` | guilloche (clip) | `guilloche.clipD` |
| `#guilloche` host | rebuilt path children `{d, opacity?}` (or empty in ptolemaic) | guilloche (lines) | `guilloche.lines:{d,opacity?}[]` |

→ **Hole filled in pure layer**: the line/opacity LIST is computed in `simulate`
(reusing `guillochePoints`/`uniformPhis`/`opacityFor` logic from lib); the view builds
`path()` children from `Scene.guilloche.lines`, never createElementNS/appendChild. The
visibility/cache short-circuit becomes: empty `lines` when not visible / ptolemaic.

### C12. Zodiac dividers, wedges, arcs `d` (curved) — 753–788

`ZIN=422`, `ZOUT=468`. For j in 0..11: `clockDeg=j·30+rot`, `phi=(-90+clockDeg)·π/180`;
`pts = ptolemaic ? [] : guillochePoints(Ex,Ey,phi,422,468,6)`; if `pts.length<2`
fallback `[pt(clockDeg,422), pt(clockDeg,468)]`; push to `bpts[j]`.

| Target | Write | Source | Subsystem | Scene field |
|---|---|---|---|---|
| `divs[j]` (`#zdivs .zdiv`) | `setAttribute("d", pointsToPathD(bpts[j]))` | bpts[j] | zodiac divider | `zodiac[j].dividerD` |
| `wedges[i]` (`.zwedge`) | `setAttribute("d", d)` | `d = "M aIn" + L over a + "A 468 468 0 0 1 bOut" + L over b reversed + "A 422 422 0 0 0 aIn Z"` where `a=bpts[i]`,`b=bpts[(i+1)%12]` | zodiac wedge | `zodiac[i].wedgeD` |
| `arcs[i]` (`.zarc`) | `setAttribute("d","M aIn A 422 422 0 0 1 bIn")` | `aIn=a[0]`, `bIn=b[0]` | zodiac arc | `zodiac[i].arcD` |

(Test asserts `#zdivs .zdiv[d] === scene.zodiac[i].dividerD` and `.zwedge.active ===
scene.zodiac[i].active`, 12 each.)

### C13. Tooltip (document overlay) — 790–805

`show = pinned ?? hovered`. If show: `w = world[show.key] ?? {x:500,y:500}`;
`sc=rect.width/1000`; `tip.style.left = (rect.left+w.x·sc)+"px"`, `top` similarly;
`s=geo[show.key]`; `tip.textContent = s ? "{show.name}  ·  {SIGN_FULL[s.si]} {s.deg}°" :
show.name`; `tip.classList.add("show")`. Else `tip.classList.remove("show")`.

| Target | Write | Subsystem | Scene field |
|---|---|---|---|
| `#tip` | `.style.left/top`, `.textContent`, `.classList add/remove("show")` | tooltip | `tooltip:{shown, point, text}` |

### C14. Loop tail — 807

`requestAnimationFrame(frame)` — PERMITTED, controller-local.

---

## D. State folded forward (Scene.next)

`caseOffset` and `prevEarthMode` are mutated inside `frame` (mode-switch re-aim,
479–485) and persist across frames. In the pure split they enter as `FrameInput`
and exit as `Scene.next:{caseOffset, prevEarthMode}`, which the controller writes back
before the next `simulate`. `simT` is similarly carried but is also externally winded
by drag/dblclick handlers, so the controller owns it (not derivable purely from one
frame); `simulate` reads it and the date math from it.

---

## E. Subsystem → Scene field → child FCC summary

| Subsystem | Scene field(s) | Per-frame? | Notes |
|---|---|---|---|
| bodies/discs | `bodies[key].{transform,world}` | yes | `.disc-<key>` group transform |
| ptolemaic sun | `bodies.sun.transform` (sunDisc), sun hit point | yes | hidden in non-ptolemaic via `visibility.sunDisc` |
| zodiac wedges | `zodiac[i].{wedgeD,active}` | yes | curved `d` + active class |
| zodiac arcs | `zodiac[i].{arcD,active}` | yes | |
| zodiac dividers | `zodiac[i].dividerD` | yes | |
| zodiac glyphs | `zodiac[i].{glyphTransform,active}` | yes | |
| zodiac gradients | `zodiac[i].gradientStops:{offset,color}[]` | yes | colors via injected `color()` (filled hole) |
| zodiac hits group | `zhitsTransform` | yes | rotate(rot) |
| occupancy / sun sign | `occupancy`, `sunSign` | yes | drives active + sign card |
| guilloche | `guilloche.{clipD, lines:{d,opacity?}[]}` | yes | line list computed in pure layer (filled hole) |
| twilight cone | `coneD` | yes | `""` in ptolemaic |
| spokes | `visibility.spokes` | yes | static children (B8), only display toggled |
| hands | `hands.{hourTransform,minuteTransform,visible}` | yes | real clock; hidden while dragging |
| sun center glow | `visibility.sunCenter` | yes | display toggle |
| date complication | `dateComplication.{x,y,month,day}` | yes | rides earth or sun(ptolemaic) |
| clocks | `simClock`, `realClock` | yes | document overlays |
| tooltip | `tooltip:{shown,point,text}` | yes | document overlay |
| sign card | `signCard:{shown,sign,occupants,point}` | yes | document overlay; inline glyph svg→FCC |
| root class | `ptolemaic` flag → root FCC `class` | yes | `svg.classList.toggle("ptolemaic")` |
| static structure | — | once | planets/zodiac/spokes/dateText/sunHit/sunDisc → render-once FCCs / builder children |
