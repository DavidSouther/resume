# Thinking: one-svg-vs-three-case-decorations

**Error:** `AssertionError: expected 3 to be 1` at `astrolabe.feature.test.ts:73` —
`expect(container.querySelectorAll("svg").length).toBe(1)`. After Step 3 appends
the dial `<svg>` the count becomes 4, still wrong.

**Context:** Step 3 (Dial component — the populated SVG, feature test GREEN) of the
F2 plan (`2026-06-14-C-astrolabe-dial`).

## Situation Summary

The F2 thesis feature test asserts the whole `Astrolabe()` tree contains exactly
one `<svg>` (the dial). F1's `case.ts` renders three decorative `<svg>` elements
(strap-top, strap-bottom, bezel-ring) through the `icons.ts`
factory-plus-`innerHTML` idiom. Appending the dial `<svg>` in Step 3 therefore
produces four svgs, not one. The dial component itself is straightforward; the
load-bearing blocker is reconciling the case decorations with the `svg.length === 1`
contract.

## Root Cause Analysis

`container.querySelectorAll("svg")` counts every `<svg>` element anywhere in the
subtree, regardless of how it was created. I verified this directly in jsdom
(`/tmp/svgcount.mjs`): a `<div>` whose `innerHTML` contains an `<svg>` string, a
real `createElementNS` svg, and the jiffies `svg()` factory ALL count as 1; only a
plain `<div>` with CSS-painted decoration (no `<svg>` element) counts as 0. So
there is no "inline svg that doesn't count" trick — to reach `length === 1` the
case decorations must not be `<svg>` elements at all.

Authority check (which side is the contract, which side is the build judgment):

- The feature test is F2's **thesis test**, authored and user-approved; its four
  assertions are the acceptance criteria. `svg.length === 1` is assertion 1.
- The build brief is explicit: "The 3 svgs come from F1's case figure — READ
  `case.ts` FIRST to understand its 3-svg structure, then **make exactly ONE
  queryable svg in the Astrolabe tree**. This is the single remaining red."
- The F1 design (`2026-06-14-B-astrolabe-shell/design.md` line 69) states the
  decoration **carrier** is a build judgment, NOT a contract: "A raster remains an
  option for the strap's domed-luster photo texture if CSS proves insufficient;
  deferred to build judgment, not a contract change." The contract is the *look*
  (platinum/cordovan/stitch tokens, retintable via `setProperty`), not the carrier
  element.
- The F2 design (`design.md` line 121) says the `astrolabe.ts` change is additive
  and "the F1 shell structure (figure, case, controls host) is preserved." This
  constrains the *wiring* (don't restructure the figure/case/controls hierarchy);
  it does not bless keeping `<svg>` carriers when they break the thesis test. The
  carrier swap keeps figure → strap/case/dial structure identical.

Conclusion: the `<svg>` carrier in `case.ts` is the changeable build judgment; the
feature test's `svg.length === 1` is the fixed contract. The minimal honest
resolution is to convert the three case decorations from `<svg>` carriers to
non-svg (CSS-painted) carriers, leaving the figure/case/dial structure, class
names, and material tokens intact.

The F1 shell test (`shell.feature.test.ts`) does NOT count svgs at the container
level — it only checks `dial.querySelector("svg")` (scoped to the dial host,
which the carrier swap leaves null until F2 fills it) and the
figure/controls/no-button assertions. So the carrier swap does not regress F1
beyond the single sanctioned hand-off edit (lines 53–55) F2 already makes.

The CSS at `global.css` lines 917 (`.astrolabe-strap svg`) and 942
(`.astrolabe-bezel-ring svg`) sizes the svg children (`display:block; width:100%;
height:auto/100%`). Those two rules must be retargeted to the new carrier element
when the carrier changes, or the strap/bezel lose their sizing.

## Forward-Backward Map

Backward from green (`svg.length === 1`):
- Need: exactly one `<svg>` in `Astrolabe()` ← the dial is the only `<svg>` ←
  case decorations are NOT `<svg>` elements ← `decoration()` in `case.ts` returns a
  CSS-painted non-svg carrier ← CSS paints strap-cordovan/stitch and bezel
  platinum/lacquer via the carrier element rather than via child svg shapes.

Forward from red (4 svgs after Step 3):
- 3 case `<svg>` + 1 dial `<svg>` ← `decoration()` builds `svg({viewBox})` +
  innerHTML ← remove the svg; render the same visual via CSS on a `<div>` carrier
  reading the same material tokens.

The two ends meet at: rewrite `case.ts`'s `decoration()` (and the strap/bezel
markup) to a `<div>` carrier styled by CSS, drop the `svg` import, and retarget the
two `.astrolabe-* svg` CSS rules to the carrier.

## Next Steps (in order)

1. **Build `dial.ts::Dial(date?)` per the plan outline first** (svg + per-body `<g>`
   + circle, all positioning attrs via `setAttribute`), and wire it into
   `astrolabe.ts` by appending `Dial()` into the `DialContainer()` host. — expected
   outcome: `container.querySelectorAll("svg").length` becomes **4** (3 case + 1
   dial); assertions 2–4 of the feature test (sun center, nine bodies, Earth +x,
   monotonic radii) now PASS; assertion 1 still fails `expected 4 to be 1`. This
   isolates the carrier as the sole remaining cause.

2. **Convert `case.ts` decorations from `<svg>` to a CSS-painted `<div>` carrier.**
   Replace `decoration()`'s `svg({viewBox}) + innerHTML` with a `<div>` (keep the
   same class names `astrolabe-strap[-position]`, `astrolabe-bezel-ring`); remove
   the now-unused `svg` import; move the strap-stitch and bezel-ring visuals into
   CSS on those classes (repeating-linear-gradient for the stitch dashes, a
   border/box-shadow ring for the bezel) reading `--strap-cordovan`,
   `--strap-stitch`, `--case-platinum`, `--lacquer-depth` so they still retint via
   `setProperty`. — expected outcome: `querySelectorAll("svg").length` becomes
   **1** (dial only); feature-test assertion 1 PASSES; all four assertions green.

3. **Retarget the two CSS rules** `.astrolabe-strap svg` (line 917) and
   `.astrolabe-bezel-ring svg` (line 942) to the new carrier (fold their sizing
   into `.astrolabe-strap` / `.astrolabe-bezel-ring`, or `.astrolabe-strap > div`).
   — expected outcome: `npm run check` clean (no orphan `svg` import in `case.ts`),
   strap/bezel keep their sizing; no visual regression in browser verify.

4. **Make the single sanctioned F1-test hand-off edit** in
   `shell.feature.test.ts` lines 53–55: from "dial empty" (`dial.querySelector("svg")`
   null, `[data-body]` null) to "dial populated" (one `<svg>` present, `[data-body]`
   groups present). — expected outcome: F1 shell test stays GREEN with the populated
   dial; no other F1 assertion touched.

5. **Run the FULL suite** (`npx vitest run`). — expected outcome: feature test
   GREEN, `shell.feature.test.ts` GREEN, zero other regressions.

Note for the implementer: if browser/visual fidelity of the CSS-only strap stitch
or bezel ring proves materially worse than the prebaked svg shapes, that is a
visual-finish judgment for the build phase (the F1 design already allows a raster
fallback). The svg.length===1 contract is non-negotiable, so a CSS or raster
carrier is required regardless; do not reintroduce an `<svg>` carrier to chase
pixel fidelity, as that re-breaks the thesis test.
