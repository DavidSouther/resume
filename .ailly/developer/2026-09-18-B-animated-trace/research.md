# Research: animating the trace figure

*Draft 2026-09-18*

## Topic and Intent

The user's request, verbatim:

> tracing will work best when it's animated. Each item in the value table trace
> happens while reading through the code. Using something like reveal.js, update
> the mermaid annotations so that each can be animated on its own. Stepping
> through the code will add and update items in the value table. Try to add as
> little new syntax as possible, but some timing information might be necessary.

The goal, in the user's framing: a reader steps through the listing one source
line at a time, and the value table beside it fills in and strikes out values in
time with that movement. The notation must gain the smallest possible amount of
new text.

`posts/interview_07_tracing_rust/rules.md:9` already states the thesis the
animation makes literal: "Read a single function line by line."

## Search/Expand

### The figure as it exists today

`src/lib/markdown.ts:70-77` fuses an adjacent gutter listing and `traceDiagram`
fence into `<figure class="trace-figure lifetime-composite">`. That figure is the
animation unit. `posts/interview_07_tracing_rust/post.md` contains seven of them
(fences at lines 113/122, 141/152, 171/182, 211/225, 251/269, 299/312, 338/359).

**The diagram model.** `src/lib/trace-diagram/model.ts:5-58`. A `TraceModel` holds
`frames` and `heap`. A `Frame` (`:27-35`) holds `rows` and nested `frames` and a
`done` flag. A `Row` (`:18-25`) holds an ordered `values: TraceValue[]`. A
`TraceValue` (`:5-14`) holds `text`, `struck`, and optional `pointsTo` /
`pointsToStack`.

`parseValues` (`src/lib/trace-diagram/parse.ts:71-86`) sets `struck` for every
value but the last, so **the value history is already an ordered timeline**. A
step marker therefore attaches naturally to the individual `TraceValue`, not to
the `Row` and not to the `Frame`. Frame lifetime (`frame` opening, `done`) is the
one thing a per-value marker does not cover, so a statement-level marker is
needed as well.

**The renderer.** `src/lib/trace-diagram/render-trace.ts:178-619` draws SVG with
arithmetic text metrics. Values are drawn at `:283-317`: one `g.trace-row` per
row, holding a `label()` text node per value plus a strike `line` when struck.
**There is no per-value element today** — a value is two sibling nodes inside the
row group. Making each value independently revealable means wrapping each value
in its own `g` carrying the step attribute. Four further passes key off the same
`placedRows` and must carry the same attribute so an arrow appears with the value
that owns it: return arrows `:357-384`, stack pointers `:389-413`, heap pointers
`:558-573`, and heap arrows from the value column `:577-591`. The frame `X`
(`:331-354`) is the `done` marker and needs a statement-level step.

**The listing.** `src/lib/highlight-gutters.ts:305-378`. `parseHighlightGutters`
(`:41`) reads `code <lang>:`, source lines, then `marks:` declarations
(`art1 1,5`, `ref1 &art1 2,5`, `b copy a 2,3`, `reject 3`) with **0-based** line
indexes into the listing (`:320` enumerates `sourceLines` with `line` starting at
0; `assertLineInBounds` at `:29-39` bounds it to `[0, lineCount)`).

The renderer already emits `data-line="{n}"` on every source row
(`highlight-gutters.ts:373`) and on every gutter band (`:364`). **The listing is
therefore already addressable by line number and needs no change at all.** Only
the diagram side is missing a clock.

### Client delivery

- A page declares client JS with `clientModules: string[]` on the page module.
  `pages/blog/[id]/page.ts:20` declares `/src/components/mermaid/client.ts`.
  The SSG emits `<script type="module" defer>import "…";</script>` and Rollup
  bundles it to a hashed asset.
- `src/components/mermaid/client.ts:19-37` boots mermaid: early-return when no
  `pre.mermaid` exists, dynamic import of the CDN ESM URL read from
  `<meta name="mermaid-src">`, `registerExternalDiagrams([traceDiagram])`, then
  `mermaid.run(...)`. **Mermaid renders asynchronously, so any stepper must mount
  after `mermaid.run()` resolves** (`:35`) — the SVG does not exist before that.
- The site already ships two substantial interactive widgets, so a stepper is not
  a new class of thing: `src/components/flashcards/client.ts` (click, keydown
  1–4, document-level key handling, `readyState` guard at `:306-310`) and
  `src/components/astrolabe/`.
- CSS: `src/global.css` is the global sheet (`.trace-figure` at 556-593,
  `.highlight-gutters` at 740-877). Diagram-internal styles come from
  `src/lib/trace-diagram/styles.ts:14`, which mermaid calls at render time and
  injects into the generated SVG.
- Existing degradation convention is implicit but consistent: highlighting runs
  at build time "so a reader with JavaScript off still gets it"
  (`src/lib/markdown.ts:5-8`), and a mermaid failure "degrades to the pre block"
  (`src/components/mermaid/client.ts:39-41`). There is no `<noscript>` anywhere.
  `prefers-reduced-motion` is used twice, both in CSS-in-TS
  (`src/components/flashcards/css.ts:258`, `src/lib/astrolabe/css.ts:193`).

### Prior art

- **reveal.js fragments** [1]: `class="fragment"` plus `data-fragment-index="N"`,
  where repeating an index shows several elements together, and
  `fragmentshown` / `fragmenthidden` events. The *semantics* are the right model.
  The *runtime* is not: the stylesheet hides every fragment by default
  (`opacity: 0; visibility: hidden`, made visible only by a `.visible` class the
  script adds) [2], so a script failure hides the content instead of showing it.
- **Slidev line highlighting** [3]: `{2-3|5|all}` — one pipe-separated storyboard
  string per code block, and `{at:N}` to anchor a block to a shared click index.
  This is the closest authoring-syntax precedent for "at step N, highlight lines
  X–Y".
- **Python Tutor** [4]: the canonical code-plus-memory stepped view. Its whole
  cross-view synchronization contract is one integer, `curInstr`.
- **Mermaid has no stepped-reveal facility.** Animated flowchart *edges* arrived
  in mermaid 11.5.0 (`e1@{ animate: true }`) [5], but that is continuous motion,
  not steps. Requests for stepped diagrams are open and unimplemented
  (mermaid-js/mermaid #3029, #7710) [6]. Any step semantics must be added around
  the SVG output, which is exactly what an out-of-tree plugin already controls.
- **CSS-only stepping**: a `[data-step="N"] [data-at="M"]` descendant selector
  needs no modern feature and works today; `:has()` is only needed if the state
  lives in a descendant input. A radio-and-`:checked` variant is genuinely
  JS-free but adds one `<input>` per step to the markup [7].

## Libraries & Skills

Before doing any work in this feature, load these skills via the active harness's
skill-loading mechanism:

- `using-jiffies-dom` — `/Users/david.souther/devel/jefri/jiffies/skills/using-jiffies-dom/SKILL.md`.
  The renderer builds SVG with `@davidsouther/jiffies/dom/svg.ts` helpers
  (`render-trace.ts:11-18`); new `g` wrappers must use them, not raw DOM.
- `using-ssg-cli` — `/Users/david.souther/devel/jefri/jiffies/skills/using-ssg-cli/SKILL.md`.
  Covers `clientModules` and the Rollup client bundle.
- `jiffies-css-components` — `/Users/david.souther/devel/jefri/jiffies/skills/jiffies-css-components/SKILL.md`.
  Needed for the stepper's control bar, which is new visible chrome.

Mermaid ships no agentic skill; its contract is the `DiagramDefinition` shape
already implemented in `src/lib/trace-diagram/diagram.ts:54`. No reveal.js skill
is relevant, because reveal.js is not recommended as a dependency (below).

## Falsification/Refine

**Size: one feature**, not a project. Three touched surfaces — the parser/model,
the renderer's element emission, and one new client module plus CSS.

**Can an off-the-shelf tool do it?** No, on both halves.

- reveal.js is rejected. Its fragment runtime imposes a fixed 960×700 scaled
  slide viewport, a global `reset.css`, URL-hash ownership, and keyboard capture
  unless `keyboardCondition: 'focused'` is set [8]. Worse, its hide-by-default
  stylesheet inverts this site's degradation rule. Copying the *semantics*
  (an integer index, shared indices meaning simultaneity, a shown/hidden event)
  into a small local stepper costs far less than ~31 kB gzipped of runtime [1].
- Mermaid cannot do it natively [5], [6].

**The implicit-ordinal shortcut fails.** A tempting zero-syntax option derives the
step from document order of values. It is wrong in general: the model lists all
of row `a`'s values, then all of row `b`'s, so a loop trace
(`a: 1071, 609, 147…` / `b: 462, 315…`) would replay as `a0 a1 a2 … b0 b1`
instead of the true interleaving. It happens to be adequate for the seven Rust
figures, where each row holds one or two values, but it cannot be the rule.

**Smallest version that still meets the intent.** The listing already carries
`data-line`, so the clock the user hinted at is free. The only genuinely new text
is a line tag on the diagram side.

### The minimal syntax — candidates

| # | Candidate | Cost | Verdict |
|---|---|---|---|
| A | Implicit ordinal, no new syntax | none | Rejected: wrong interleaving across rows (above). |
| B | Trailing numeric `@<line>` tag on any value or statement | one lexical rule | **Recommended.** |
| C | An `at <line>` statement that sets a running clock for everything after it | one new keyword | Viable fallback; verbose for a multi-value row. |
| D | A Slidev-style `steps 1\|2\|3-4` storyboard line on the diagram | one new statement | Rejected: duplicates information and decouples the tag from the value it times. |

**Recommendation — candidate B.** A trailing `@<digits>` token on any value or
statement names the listing line at which that item appears.

```
frame main @0
  art: @artwork @1
  watch art.name: Owain @2
  done @3
end
```

Its virtues:

- **One rule, applied uniformly** to values, rows, `frame`/`scope`, and `done`.
  Nothing else in the grammar changes.
- **It reuses the existing clock.** The number is the same 0-based listing line
  index the `marks:` section already uses (`highlight-gutters.ts:320`), so an
  author reads the line number off the listing they just wrote.
- **It is derivable-by-omission**, matching the papers' add-don't-change rule
  quoted in `.ailly/developer/2026-09-15-B-tracing-mermaid/design.md:26-31`. An
  untagged item inherits the nearest tag above it; a diagram with no tags at all
  is not steppable and renders exactly as it does today.
- **The `@` sigil is already the notation's pointer mark**, so it reads as "at".

Its one constraint, which the design phase must accept explicitly: disambiguation
is lexical — `@artwork` (non-numeric) stays a heap pointer, `@2` (all digits)
is a line tag. **A heap object id may therefore not be all digits.** No existing
diagram violates this. The alternative sigil `#` avoids the question entirely but
introduces a second marker character; `@` is preferred for the smaller surface.

### What "like reveal.js" should mean

A local stepper of roughly 100 lines, not a dependency:

- **State is one integer** on the figure element, `data-step`, holding the current
  listing line (Python Tutor's `curInstr` contract [4]). CSS reads
  `[data-step] [data-at]` pairs; no `:has()` needed.
- **Base state is the finished state.** Without `data-step`, every value and every
  arrow is fully visible — that is the current rendering. The stepper *opts in* to
  dimming. This inverts reveal.js's default and is the site's existing
  degradation rule. With JS off, or if mermaid fails, the reader gets today's
  complete figure.
- **Controls are real `<button>`s** (prev/next), plus `ArrowLeft`/`ArrowRight`
  when the figure has focus, plus a polite live region announcing "Step n of m"
  (WCAG 4.1.2) [9].
- **Nothing is removed from the accessibility tree.** Future steps are dimmed,
  not `aria-hidden` and not `display: none`; the full trace stays readable to a
  screen reader and in print [10].
- **Motion is opt-in.** No transition in the base rule; transitions added only
  under `@media (prefers-reduced-motion: no-preference)`. A step change is
  instant under reduced motion, never suppressed [11]. WCAG 2.2.2 does not apply
  while stepping is user-driven; it would apply the moment an autoplay mode is
  added [12].
- **Mount point:** after `mermaid.run()` resolves in
  `src/components/mermaid/client.ts:35`, iterate `figure.trace-figure`.

## Scope

**In.**

1. The `@<line>` tag in `src/lib/trace-diagram/parse.ts` and a `step?: number` on
   `TraceValue`, `Row`, and `Frame` in `model.ts`.
2. `render-trace.ts` wraps each value (text + strike) in its own `g` carrying the
   step, and propagates the step onto the arrows and the frame `X` derived from
   it.
3. A new client module that mounts a stepper on each `figure.trace-figure`,
   driving `data-step` and highlighting the matching `[data-line]` row in the
   listing.
4. CSS in `src/global.css` for dimming, for the control bar, and for
   `prefers-reduced-motion`.
5. Tags added to the seven figures in `posts/interview_07_tracing_rust/post.md`.

**Out.**

- reveal.js, or any new runtime dependency.
- Autoplay, a timeline scrubber, or a shared timeline across figures.
- Build-time SVG pre-rendering; the render stays client-side.
- Any change to `src/lib/highlight-gutters.ts` — it already emits `data-line`.
- Animating the gutter bands themselves (they are lexical extents, not events).

## Resolved Decisions

- **Where a step attaches:** to the individual `TraceValue`, because the value
  history is already the ordered timeline (`parse.ts:71-86`). Frame opening and
  `done` need the same tag at statement level; rows do not need one of their own.
- **What the clock is:** the listing's 0-based source line, which the gutter
  renderer already exposes as `data-line` (`highlight-gutters.ts:364`, `:373`).
- **Whether steps can be fully derived:** no. Document order mis-orders
  cross-row interleaving.
- **reveal.js:** rejected as a dependency; its fragment semantics are adopted.
- **Degradation:** the un-stepped state is the complete figure, so JS-off, print,
  and a mermaid failure all yield today's output.

Open for the human:

1. **Sigil.** `@2` (recommended; forbids all-digit heap ids) or `#2` (no
   ambiguity, one more marker character).
2. **Granularity of "current".** Should the stepper dim *future* items only, or
   also fade *past* items (reveal.js `current-visible`)? Dimming future only is
   proposed, because a memory trace's whole point is the accumulated history.
3. **Per-figure or per-post controls.** One control bar per figure is proposed;
   a single post-wide stepper is possible but couples unrelated figures.
4. **Strike timing.** A value's strike is currently implied by a later value in
   the same row. Should the strike appear at the later value's step, or carry its
   own tag? Deriving it is proposed.

## Sources

[1] "Fragments," reveal.js. https://revealjs.com/fragments/ (accessed 2026-09-18).

[2] H. El Hattab, `css/reveal.scss`, hakimel/reveal.js, GitHub. https://raw.githubusercontent.com/hakimel/reveal.js/master/css/reveal.scss (accessed 2026-09-18).

[3] "Line Highlighting," Slidev. https://sli.dev/features/line-highlighting (accessed 2026-09-18).

[4] P. J. Guo, "Online Python Tutor: Embeddable Web-Based Program Visualization for CS Education," in Proc. 44th ACM Tech. Symp. Computer Science Education (SIGCSE '13), 2013. https://dl.acm.org/doi/10.1145/2445196.2445368 (accessed 2026-09-18).

[5] "Flowcharts Syntax," Mermaid. https://mermaid.js.org/syntax/flowchart.html (accessed 2026-09-18).

[6] "Feature — 'animated' diagrams," Issue #3029, and "Step-by-step displaying of the Mermaid diagrams like animation," Issue #7710, mermaid-js/mermaid, GitHub. https://github.com/mermaid-js/mermaid/issues/3029 (accessed 2026-09-18).

[7] ":has()," MDN Web Docs. https://developer.mozilla.org/en-US/docs/Web/CSS/:has (accessed 2026-09-18).

[8] "Config," reveal.js. https://revealjs.com/config/ (accessed 2026-09-18).

[9] "Understanding SC 4.1.2: Name, Role, Value," W3C WAI. https://www.w3.org/WAI/WCAG22/Understanding/name-role-value.html (accessed 2026-09-18).

[10] "ARIA: aria-hidden attribute," MDN Web Docs. https://developer.mozilla.org/en-US/docs/Web/Accessibility/ARIA/Reference/Attributes/aria-hidden (accessed 2026-09-18).

[11] "prefers-reduced-motion," MDN Web Docs. https://developer.mozilla.org/en-US/docs/Web/CSS/@media/prefers-reduced-motion (accessed 2026-09-18).

[12] "Understanding SC 2.2.2: Pause, Stop, Hide," W3C WAI. https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide.html (accessed 2026-09-18).
