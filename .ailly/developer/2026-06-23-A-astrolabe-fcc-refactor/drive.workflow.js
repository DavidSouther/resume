export const meta = {
  name: 'astrolabe-fcc-drive',
  description: 'Drive the Astrolabe FCC refactor project through plan + build of its two features, stopping at the Closing Bell',
  phases: [
    { title: 'Map', detail: 'parallel read-only dissection of the dial code, builder modules, jiffies FCC API, and page scaffold/tests' },
    { title: 'Plan', detail: 'synthesize maps into per-feature plans + the Scene/FrameInput contract' },
    { title: 'Build F1', detail: 'implement the dial render pipeline; loop build->verify until green' },
    { title: 'Build F2', detail: 'rebuild the controls drawer through Jiffies; loop build->verify until green' },
    { title: 'Verify', detail: 'final full-suite gate + adversarial parity review' },
  ],
}

// ---- shared constants every agent grounds against -------------------------
const SESSION = '.ailly/developer/2026-06-23-A-astrolabe-fcc-refactor'
const DESIGN = `${SESSION}/design.md`
const ROOT = '/Users/david.souther/devel/davidsouther/resume'

const TEST_CMD = 'mise exec -- npx vitest run'
const CHECK_CMD = 'mise exec -- npm run check'
const FMT_FIX = 'mise exec -- npx biome check --write src pages'

// Baseline-red set (all expected to flip GREEN when the refactor lands; nothing
// else is failing on this branch today):
//  - src/components/astrolabe/no-raw-dom.feature.test.ts  (dial modules: animation, dial, planets, zodiac, texture, guilloche)
//  - src/components/astrolabe/frame-render.feature.test.ts
//  - src/components/astrolabe/astrolabe.feature.test.ts    (SSG build; fails only on missing simulate.ts/view.ts)
//  - src/migration.feature.test.ts                         (build; fails only on missing simulate.ts/view.ts)
const GROUNDING = `
PROJECT: Astrolabe FCC refactor. Read the umbrella design doc FIRST: ${DESIGN}
This is a PARITY refactor: the dial must look and behave EXACTLY as on main; the
only change is that every DOM interaction now flows through Jiffies FCCs/builders.
NO visual or behavioral change is permitted.

THE SHARED CONTRACT (fixed by the design + pinned by the feature tests — do NOT alter the test files except the one designed F2 guard widening):
  NEW src/lib/astrolabe/simulate.ts  (PURE, no DOM import):
    export interface FrameInput  — config, simT, bootMs, wallNow: Date, caseOffset,
      prevEarthMode, mouse:{nx,ny}, interaction:{hovered,pinned,hoveredSign,pinnedSign,dragging},
      layout:{rect:{left,top,width,height}, viewport:{width,height}}, color:(key:string)=>string
    export interface Scene  — the complete per-frame projection. Every DOM string is
      computed here: bodies (Record<string,{transform,world}>), ptolemaic sun disc
      transform+hit point, zhitsTransform, zodiac[12] of {wedgeD,arcD,dividerD,
      glyphTransform,active,gradientStops:{offset,color}[]}, occupancy:Record<number,string[]>,
      sunSign, visibility:{sunCenter,sunDisc,spokes}, coneD, guilloche:{clipD,lines:{d,opacity?}[]},
      hands:{hourTransform,minuteTransform,visible}, dateComplication:{x,y,month,day},
      simClock, realClock, tooltip:{shown,point,text}, signCard:{shown,sign,occupants,point},
      next:{caseOffset,prevEarthMode}
    export function simulate(input: FrameInput): Scene
    Fill the two holes the reference branch left for the view IN THE PURE LAYER:
    gradient-stop COLORS (via the injected color() resolver, emitted as gradientStops data)
    and the guilloche line list (from guillochePoints in lib).
  NEW src/components/astrolabe/view.ts:
    export function astrolabeView(svg: SVGSVGElement): { update(scene: Scene): void }
    Owns the dynamic child FCC handles (the sanctioned "immediate children"); fans
    each Scene slice to its child FCC's update(). Static subsystems (texture: 120
    lines + 160 sparkles, bezel, defs/gradients) are render-once FCCs.

WHAT frame-render.feature.test.ts ASSERTS (the projection contract — must hold):
  - every BODIES[k].key: typeof scene.bodies[key].transform === 'string' AND svg has .disc-<key>
  - scene.sunSign in [0,12); scene.occupancy[scene.sunSign] contains "earth"
  - scene.simClock matches /^\\d{1,2} [A-Z]{3} \\d{4}\\s+·\\s+\\d{2}:\\d{2}$/
  - svg .disc-mars [transform] === scene.bodies.mars.transform  (no DOM math in view)
  - #zdivs .zdiv (12 of them) [d] === scene.zodiac[i].dividerD
  - #zwedges .zwedge (12) classList.contains('active') === scene.zodiac[i].active
  - #simClock textContent === scene.simClock

NO-RAW-DOM GUARD (no-raw-dom.feature.test.ts). FORBIDDEN in scope (each a failure):
  appendChild/insertBefore/removeChild/replaceChild, createElement(NS), setAttribute/
  removeAttribute/toggleAttribute, .classList, .innerHTML/.outerHTML, .textContent=,
  .dataset., .style (assignment or setProperty/removeProperty), element addEventListener.
PERMITTED (reads / non-element APIs): getBoundingClientRect, getComputedStyle,
  window.Astronomy, setPointerCapture/releasePointerCapture (inside events: handlers),
  requestAnimationFrame, localStorage, matchMedia, performance.now, Date.now, and
  window/document/globalThis/visualViewport addEventListener (page lifecycle).
  Hand-written values are only SVG attribute payload STRINGS (d, transform, offsets)
  passed as values to a Jiffies builder / el.update().

JIFFIES API (already a dependency, v2026.25.0). READ the sources:
  node_modules/@davidsouther/jiffies/lib/esm/dom/fc.d.ts + fc.js   (FCC, getFCC)
  node_modules/@davidsouther/jiffies/lib/esm/dom/hydrate.d.ts + hydrate.js
  node_modules/@davidsouther/jiffies/lib/esm/dom/svg.d.ts (builders: g, circle, line, path, text, stop, linearGradient, ellipse, ...)
  node_modules/@davidsouther/jiffies/lib/esm/dom/html.d.ts
  FCC(name, boundary, render) builds a containerless component on a single real
  element marked data-fc (valid inside <svg>). el.update(attrs, ...children) merges
  attrs, re-runs render, reconciles children by identity/nodeName. Events: events:{pointerdown:fn}.
  Classes: class ("!x" removes). Styles: style (object or cssText). A parent reconcile
  does NOT descend into a child FCC. Builders share the same update mechanics.
  Existing repo idiom: animation.ts/dial.ts/planets.ts/zodiac.ts/texture.ts already
  import builders from @davidsouther/jiffies/dom/svg.ts; pages/astrolabe/page.ts uses html.ts.

PROJECT RULES (CLAUDE.md/AGENTS.md): Node 24 strips TS types — invoke .ts directly,
  never add --experimental-strip-types. The ~/ alias is TYPECHECK-ONLY: value imports
  in src must be relative .ts paths. Fix formatting-only failures with ${FMT_FIX},
  never hand-edit whitespace. Consume jiffies-css derived tokens, no raw rem/px.
`

const VERIFY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['testsGreen', 'checkGreen', 'failedTests', 'excerpt'],
  properties: {
    testsGreen: { type: 'boolean', description: 'true iff `' + TEST_CMD + '` reports 0 failed tests and 0 failed files' },
    checkGreen: { type: 'boolean', description: 'true iff `' + CHECK_CMD + '` (tsc --noEmit + biome) exits 0' },
    failedTests: { type: 'array', items: { type: 'string' }, description: 'names/paths of failing tests or check errors; [] if all green' },
    excerpt: { type: 'string', description: 'the most useful 30-line excerpt of failure output to feed the next build iteration; "" if all green' },
  },
}

const BUILD_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['claimedGreen', 'summary', 'filesChanged', 'remaining'],
  properties: {
    claimedGreen: { type: 'boolean' },
    summary: { type: 'string', description: 'what was implemented this iteration' },
    filesChanged: { type: 'array', items: { type: 'string' } },
    remaining: { type: 'string', description: 'what still fails or is unfinished, for the next iteration' },
  },
}

function verifyPrompt(scopeNote) {
  return `${GROUNDING}

You are the VERIFY gate for ${scopeNote}. Do NOT edit any files. Run, from ${ROOT}:
  1) ${TEST_CMD}    (capture the final summary + any failure blocks)
  2) ${CHECK_CMD}   (typecheck + biome; capture errors)
Report the TRUE state. testsGreen ONLY if the vitest summary shows 0 failed tests AND
0 failed files. checkGreen ONLY if check exits 0. List every failing test/error in
failedTests and put the single most actionable ~30-line excerpt in excerpt. Be honest —
a false "green" wastes the whole run.`
}

// ===========================================================================
phase('Map')
log('Mapping the dial code, builder modules, jiffies FCC API, and page scaffold in parallel.')

const MAP_TASKS = [
  {
    label: 'map:animation-loop',
    file: `${SESSION}/maps/animation-loop.md`,
    prompt: `${GROUNDING}

READ-ONLY. Dissect the per-frame render loop in src/components/astrolabe/animation.ts
(the loop is ~lines 465-808, plus its init/setup above). Produce a precise inventory
of EVERY DOM mutation the loop and init perform: for each, give {the target node
(selector/id/ref), the property or child written, the SOURCE expression that computes
the value, and which logical subsystem it belongs to (bodies/discs, ptolemaic sun,
zodiac wedges/dividers/arcs/glyphs/gradients, guilloche, twilight cone, spokes, hands,
sun disc/center glow, date complication, clocks, tooltip, sign card)}. Separate
ONE-TIME (init/static) writes from PER-FRAME (dynamic) writes. Also capture: how
interaction state (hovered/pinned/hoveredSign/pinnedSign/dragging, mouse, caseOffset,
prevEarthMode) enters the loop and how event listeners are currently attached. This map
becomes the field list of Scene and the per-FCC update fan-out. Write your full map to
${SESSION}/maps/animation-loop.md AND return it.`,
  },
  {
    label: 'map:builder-modules',
    file: `${SESSION}/maps/builder-modules.md`,
    prompt: `${GROUNDING}

READ-ONLY. Map the static/builder modules: src/components/astrolabe/dial.ts,
planets.ts, zodiac.ts, texture.ts, guilloche.ts (and what src/lib/astrolabe/bodies.ts,
materials.ts, css.ts, geocentric.ts, math.ts provide). For each module: what SVG
structure it builds, which parts are static (built once) vs dynamic (mutated per
frame), the ids/classes it emits (especially .disc-<key>, #zdivs/.zdiv, #zwedges/.zwedge,
#guilloche, hand ids, sun disc), and which jiffies builders it already uses. Note the
guillochePoints source in lib and how gradient stops are currently built. This grounds
the FCC subsystem decomposition and the static-vs-render-once split. Write your full map
to ${SESSION}/maps/builder-modules.md AND return it.`,
  },
  {
    label: 'map:jiffies-fcc',
    file: `${SESSION}/maps/jiffies-fcc.md`,
    prompt: `${GROUNDING}

READ-ONLY. Produce a precise, example-rich reference for building this FCC tree from
the INSTALLED jiffies (read the .d.ts AND .js):
  node_modules/@davidsouther/jiffies/lib/esm/dom/fc.js + fc.d.ts
  node_modules/@davidsouther/jiffies/lib/esm/dom/hydrate.js + hydrate.d.ts
  node_modules/@davidsouther/jiffies/lib/esm/dom/svg.d.ts (full builder list + signatures)
  node_modules/@davidsouther/jiffies/lib/esm/dom/html.d.ts
Document exactly: FCC(name, boundary, render) signature and what render receives/returns;
how el.update(attrs, ...children) reconciles; the exact attr keys for events/class/style/
text; how a child FCC boundary is opaque to a parent reconcile; getFCC and the module
registry; and the hydrate.start() flow (#__hydration payload, capture stub, re-wire,
clear server children, re-render) vs the current getElementById rebuild in client.ts.
Give a MINIMAL working snippet for (a) a render-once static FCC, (b) a dynamic FCC whose
update(slice) sets a transform/d and toggles a class, (c) building gradient stop children
from a data array, all valid inside <svg>. Write to ${SESSION}/maps/jiffies-fcc.md AND return it.`,
  },
  {
    label: 'map:scaffold-tests',
    file: `${SESSION}/maps/scaffold-tests.md`,
    prompt: `${GROUNDING}

READ-ONLY. Map the page scaffold and the test contract. Read pages/astrolabe/page.ts
(the SSG page module — the #dial svg, #zdivs/#zwedges hosts, overlay hosts #simClock/
#realClock, tooltip, sign card, and the controls drawer markup), src/components/astrolabe/
client.ts (bootstrap/getElementById rebuild, sizeDial host sizing), src/components/test-dom.ts
(mount/resetDom helper used by tests), and EVERY existing astrolabe test that must STAY
green: astrolabe.feature.test.ts, control-menu.feature.test.ts, persistence.feature.test.ts,
and the lib tests. Enumerate the exact selectors/ids/classes/textContent each test reads
(this is the projection contract the view must satisfy). Also map controls.ts +
pages/astrolabe/page.ts for Feature 2: every form construction, value binding, listener,
classList/style/dataset write, and confirm readSnapshot/writeSnapshot/captureSnapshot
(localStorage — stays, not a DOM call). Write to ${SESSION}/maps/scaffold-tests.md AND return it.`,
  },
]

const maps = await parallel(MAP_TASKS.map((t) => () =>
  agent(t.prompt, { label: t.label, phase: 'Map' })
))
const mapDigest = MAP_TASKS.map((t, i) => `\n===== ${t.label} (${t.file}) =====\n${maps[i] || '(map agent produced no output; read the file directly)'}`).join('\n')

// ===========================================================================
phase('Plan')
log('Synthesizing the maps into per-feature plans and the Scene/FrameInput contract.')

const planResult = await agent(`${GROUNDING}

You have the four maps below. Write TWO implementation plans into the project session
folder, following developer:plan shape (3-7 descriptive, ordered steps each; name the
API surface; Step 0 = the shared contract). Both features deliver the project only
together; Feature 2 depends on Feature 1's guard-allowlist + FCC/hydration mount pattern.

Write ${SESSION}/feature-1/plan.md  — FEATURE 1: dial render pipeline. Cover: the exact
Scene + FrameInput TypeScript interfaces (the shared contract, Step 0); src/lib/astrolabe/
simulate.ts (pure, extracting the per-frame projection from animation.ts — cite the
animation-loop map); src/components/astrolabe/view.ts (the FCC subsystem tree, dynamic
child handles, render-once static FCCs); rewriting animation.ts to capture interaction via
events: attrs into a plain object, call simulate(), then view.update(scene); converting the
document overlays (clocks, tooltip, sign card incl. its inline glyph svg) to built FCC
subtrees; mounting via hydration so client.ts drops its getElementById rebuild. Decide and
record the per-subsystem FCC granularity (a deferred decision the design left to this plan)
and how sizeDial's host sizing is expressed.

Write ${SESSION}/feature-2/plan.md  — FEATURE 2: controls drawer. Cover: rebuilding
controls.ts + pages/astrolabe/page.ts so every form construction, value binding, listener,
and classList/style/dataset write goes through Jiffies builders + events:/class/style attrs;
keeping localStorage persistence; widening the no-raw-dom guard (remove "controls.ts" from
its EXCLUDE set, keep client.ts excluded, and extend the scan to pages/astrolabe/page.ts per
the design); and reusing F1's hydration mount pattern.

Be concrete and file-specific. Return a 10-line summary of both plans.

MAPS:${mapDigest}`, { label: 'plan:both-features', phase: 'Plan' })

log('Plans written. Beginning Feature 1 build loop.')

// ---- generic build->verify loop ------------------------------------------
async function buildLoop(featureName, planPath, buildBody, scopeNote, maxIters) {
  let prior = ''
  let verdict = null
  for (let i = 0; i < maxIters; i++) {
    const iterNote = i === 0 ? 'first pass' : `iteration ${i + 1}; the verify gate reported failures below — fix them`
    const build = await agent(`${GROUNDING}

You are implementing ${featureName} (${iterNote}). Your plan is ${planPath} — read it,
read the maps in ${SESSION}/maps/, read the relevant source, then IMPLEMENT. You have full
file-edit and shell tools. Work from ${ROOT}.

${buildBody}

WORKING RULES:
- This is parity work: change behavior NOWHERE. Only re-express DOM interaction through Jiffies.
- Do NOT edit the feature test files (frame-render / no-raw-dom) EXCEPT the single designed
  F2 guard widening when this feature explicitly calls for it.
- Run targeted tests as you go: ${TEST_CMD} <path>. Before finishing, run the FULL suite
  ${TEST_CMD} and ${CHECK_CMD}, and run ${FMT_FIX} to auto-fix formatting (never hand-edit whitespace).
- Iterate until you believe everything is green. If you get stuck on a red, dig into the
  actual error rather than guessing.

${prior ? `PRIOR VERIFY FAILURES TO FIX:\n${prior}` : ''}`, {
      label: `build:${featureName}#${i + 1}`,
      phase: scopeNote,
      schema: BUILD_SCHEMA,
    })

    verdict = await agent(verifyPrompt(`${featureName} (after build iteration ${i + 1})`), {
      label: `verify:${featureName}#${i + 1}`,
      phase: scopeNote,
      schema: VERIFY_SCHEMA,
    })

    log(`${featureName} iter ${i + 1}: testsGreen=${verdict.testsGreen} checkGreen=${verdict.checkGreen} (${(build && build.summary) || 'no build summary'})`)
    if (verdict.testsGreen && verdict.checkGreen) {
      return { green: true, iters: i + 1, verdict }
    }
    prior = `failedTests: ${(verdict.failedTests || []).join(', ')}\n\n${verdict.excerpt || ''}`
  }
  return { green: false, iters: maxIters, verdict }
}

// ===========================================================================
phase('Build F1')
const f1 = await buildLoop(
  'Feature 1 (dial render pipeline)',
  `${SESSION}/feature-1/plan.md`,
  `IMPLEMENT FEATURE 1 fully:
- Create src/lib/astrolabe/simulate.ts (pure, no DOM import) exporting FrameInput, Scene,
  and simulate(input): Scene — every per-frame DOM string/flag computed here, including the
  gradient-stop colors (via injected color()) and the guilloche line list.
- Create src/components/astrolabe/view.ts exporting astrolabeView(svg) with update(scene),
  owning the dynamic child FCC handles and render-once static FCCs.
- Strip ALL forbidden raw-DOM calls from animation.ts, dial.ts, planets.ts, zodiac.ts,
  texture.ts, guilloche.ts (the no-raw-dom dial scope). Rewrite the animation loop to
  capture interaction via events: attrs, call simulate(), then view.update(scene).
- Convert the document overlays (clocks, tooltip, sign card incl. inline glyph) to FCC subtrees.
- Mount via jiffies hydration so client.ts drops its getElementById rebuild (client.ts stays
  OUT of the guard scope; its window/visualViewport listeners and host sizeDial are permitted).
DONE = full ${TEST_CMD} green (no-raw-dom dial modules, frame-render, astrolabe.feature SSG
build, migration build all GREEN, and every previously-green test STILL green) AND ${CHECK_CMD} green.`,
  'Build F1',
  6,
)
log(`Feature 1 build finished: green=${f1.green} after ${f1.iters} iteration(s).`)

// ===========================================================================
phase('Build F2')
const f2 = await buildLoop(
  'Feature 2 (controls drawer)',
  `${SESSION}/feature-2/plan.md`,
  `IMPLEMENT FEATURE 2 fully (Feature 1 is already landed and green — reuse its FCC/
hydration mount pattern and guard allowlist):
- Rebuild src/components/astrolabe/controls.ts and pages/astrolabe/page.ts so EVERY form
  construction, value binding, listener, and classList/style/dataset write goes through
  Jiffies builders + events:/class/style attrs. Keep readSnapshot/writeSnapshot/captureSnapshot
  (localStorage — stays).
- Widen the guard in src/components/astrolabe/no-raw-dom.feature.test.ts: remove "controls.ts"
  from its EXCLUDE set (keep "client.ts" excluded), and extend the scan to also cover
  pages/astrolabe/page.ts, per the design's "Feature 2 widens the scan" decision. This is the
  one sanctioned feature-test edit.
DONE = full ${TEST_CMD} green (now INCLUDING the widened guard over controls.ts + page.ts,
control-menu.feature, persistence.feature, and everything from F1) AND ${CHECK_CMD} green.`,
  'Build F2',
  5,
)
log(`Feature 2 build finished: green=${f2.green} after ${f2.iters} iteration(s).`)

// ===========================================================================
phase('Verify')
log('Final full-suite gate + adversarial parity review.')

const finalVerify = await agent(verifyPrompt('the WHOLE project (both features landed)'), {
  label: 'verify:final',
  phase: 'Verify',
  schema: VERIFY_SCHEMA,
})

// Adversarial parity review: read the diff vs main, hunt for behavior changes.
const PARITY_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: ['parityHolds', 'concerns'],
  properties: {
    parityHolds: { type: 'boolean', description: 'true iff no behavior/visual change vs main was found' },
    concerns: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: ['where', 'risk', 'detail'],
        properties: {
          where: { type: 'string' },
          risk: { type: 'string', enum: ['high', 'medium', 'low'] },
          detail: { type: 'string' },
        },
      },
    },
  },
}

const PARITY_LENSES = [
  { key: 'dial-projection', focus: 'the dial: body transforms, zodiac wedges/dividers/arcs/glyphs, gradients, guilloche, twilight cone, spokes, hands, sun disc/center glow, date complication. Does simulate() reproduce EXACTLY the math animation.ts did per frame, and does view.ts write those strings verbatim with no recomputation?' },
  { key: 'interaction', focus: 'drag-to-wind-time (no jump on release; hands hide during drag and restore), hover/pin tooltip + sign card, Ptolemaic/Galilean/Keplerian continuous switch (no snap), parallax. Are events: handlers wired to the same nodes with the same semantics as the old addEventListener code?' },
  { key: 'controls-persistence', focus: 'every controls drawer toggle/slider/segment/material/color/size, the pancake open/close, and localStorage persistence across reload + Reset. Same effects as main?' },
]
const parity = await parallel(PARITY_LENSES.map((l) => () =>
  agent(`${GROUNDING}

ADVERSARIAL PARITY REVIEW — lens: ${l.key}. Compare the working tree against main
(use: git diff main -- src/components/astrolabe src/lib/astrolabe pages/astrolabe, and read
both sides where needed). Your job is to FIND any place the refactor could have changed
behavior or visuals from main. Focus: ${l.focus}
Default to skeptical. Only set parityHolds=true if you genuinely find no behavior-changing
discrepancy in your lens. List concrete concerns with file:line and risk level.`, {
    label: `parity:${l.key}`,
    phase: 'Verify',
    schema: PARITY_SCHEMA,
  })
))

const concerns = parity.filter(Boolean).flatMap((p, i) => (p.concerns || []).map((c) => ({ lens: PARITY_LENSES[i].key, ...c })))

return {
  feature1: { green: f1.green, iters: f1.iters },
  feature2: { green: f2.green, iters: f2.iters },
  finalVerify: { testsGreen: finalVerify.testsGreen, checkGreen: finalVerify.checkGreen, failedTests: finalVerify.failedTests, excerpt: finalVerify.excerpt },
  parityHolds: parity.filter(Boolean).every((p) => p.parityHolds),
  parityConcerns: concerns,
  planSummary: planResult,
}
