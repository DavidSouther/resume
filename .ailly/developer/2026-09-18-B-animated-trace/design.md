# Design: stepping the trace figure through the code

*Cleared by quick-loop 2026-09-18*

## Purpose

A reader of `posts/interview_07_tracing_rust/post.md` sees a finished value table
next to a finished listing and must reconstruct the order in which the table was
filled. The request:

> tracing will work best when it's animated. Each item in the value table trace
> happens while reading through the code. Using something like reveal.js, update
> the mermaid annotations so that each can be animated on its own. Stepping
> through the code will add and update items in the value table. Try to add as
> little new syntax as possible, but some timing information might be necessary.

This design gives each `<figure class="trace-figure">` a step control. One press
of **Next** advances the reader one executed statement: the listing spotlights
that statement's line, and the value table gains or updates exactly the items
that statement produces.

## Prior Art

- **reveal.js fragments.** An integer index, repeated indices meaning
  simultaneity. The semantics are adopted; the runtime is not, because its
  stylesheet hides fragments by default and a script failure would hide content.
- **Slidev `{2-3|5|all}`.** The precedent for one storyboard string per block.
- **Python Tutor.** Cross-view synchronization through a single integer.
- **Mermaid** has no stepped reveal; step semantics are added around the SVG this
  plugin already emits.

`research.md` holds the full survey and its sources.

## Libraries & Skills

Load these before designing further, planning, or building:

- `using-jiffies-dom` — `/Users/david.souther/devel/jefri/jiffies/skills/using-jiffies-dom/SKILL.md`
- `using-ssg-cli` — `/Users/david.souther/devel/jefri/jiffies/skills/using-ssg-cli/SKILL.md`
- `jiffies-css-components` — `/Users/david.souther/devel/jefri/jiffies/skills/jiffies-css-components/SKILL.md`

## User Journey and Metrics

A reader opens the post. Each figure looks exactly as it does today: the whole
trace, complete. Below the diagram a small control bar reads **Step 7 of 7**,
with **Replay**, **Previous**, **Next**.

The reader presses **Replay**. The figure falls back to its first executed
statement: the listing's `fn main() {` carries a spotlight bar, and only the
`main` frame is bright. Every later value is still on screen, dimmed — the shape
of the finished trace stays visible, so nothing reflows.

The reader presses **Next**. The spotlight slides to `let my_art = build_art();`
and the `my_art` row brightens. **Next** again enters the callee: the spotlight
jumps *up* to `fn build_art`, because that is the next statement executed, not
the next line down. Three more presses fill `art`, draw the `ret &art` arrow to
`my_art`, and cross out the `build_art` frame. At step 7 the figure is again
identical to the page as it loaded.

Success measures:

- A figure with no timing notation renders byte-identical HTML and SVG to today.
- With JavaScript off, printed, or after a mermaid failure, every figure shows
  its complete final state.
- The control bar is reachable and operable from the keyboard alone, and the
  full trace text stays in the accessibility tree at every step.

## Specification

### The notation: two additions, both optional

**1. A step tag.** A trailing `@<digits>` token. The integer is the **0-based
listing line index** — the same number the neighbouring `marks:` section already
uses, so an author reads it off the listing rather than inventing a scale.

The token may sit at the end of any statement (`frame`, `scope`, `heap`, a row,
`ret`, `done`), where it times that statement, or at the end of an individual
value inside a value list, where it times that value:

```
traceDiagram
  title A plain owned value
  heap artwork 0x08 @1
    name: Owain
    view_count: 0
  end
  frame main @0
    art: @artwork @1
    watch art.name: Owain @2
    done @3
  end
```

Disambiguation is lexical: `@artwork` is a heap pointer, `@1` is a step tag. The
one constraint this imposes is that **a heap object id may not be all digits**.
No existing diagram violates it.

**2. An optional `steps` statement**, at most one, before the first `frame` or
`heap`:

```
steps 9 10 0 1 2 3 11
```

A whitespace-separated list of 0-based listing lines **in execution order**.

### The step sequence (resolves R1 and R3)

Let **S** be the step sequence.

- **S is the `steps` list when one is written.** Otherwise S defaults to the
  ascending sorted unique tagged lines. The default is correct for six of the
  seven figures, which are straight-line code inside `main`; the `build_art`
  figure declares its own.
- **m = S.length.** Steps are numbered 1 … m. **Step n is the execution of the
  statement on listing line `S[n-1]`.** One press of Next raises n by one. "Step
  n of m" is therefore computable, and Next is defined without reference to the
  listing's length: the reader steps through *executions*, never stopping on a
  line that produces nothing.
- **Binding.** An item tagged `@L` is revealed at the first n with `S[n-1] === L`.
  When L occurs more than once in S — a loop body, or a line re-entered after a
  call — successive `@L` tags **within one row's value list** take successive
  occurrences, left to right.
- **Interleaving is expressed by S, never by document order.** Two values in
  different rows carrying the same tag share a step, which is reveal.js's
  repeated `data-fragment-index`. Values carrying different tags order by S
  regardless of which row they were written on. A loop whose body computes `a` on
  line 5 and `b` on line 6 writes `steps 4 5 6 5 6 5`, `a: 1071 @5, 609 @5, 147 @5`
  and `b: 462 @6, 315 @6`, and replays as a, b, a, b, a. This is the direct answer
  to the objection that a row's values are all written on one source line:
  document order is not consulted for ordering, only for which occurrence a
  repeated tag takes.
- **Inheritance.** An untagged item takes the tag of the nearest preceding tagged
  item in document order. An item with no preceding tag belongs to step 1. Heap
  fields, a `done` that follows a tagged watch, and the second of two values
  produced by one statement therefore need no tag of their own.
- **Derived timings.** A value's strike appears at the step of the next value in
  its row. An arrow — `ret -> target`, a `&name` stack pointer, a heap pointer —
  appears at the step of the value that owns it, so the arrow never precedes or
  outlives its value. A frame's X uses the tag on its `done`.
- **No tags anywhere means not steppable.** The renderer emits no timing
  attributes, the stepper adds no control bar, and the figure is what it is
  today. Backward compatibility is structural, not a special case.

### Why this notation, measured per document (resolves R4)

| Option | Cost across the seven figures | Verdict |
|---|---|---|
| Ascending lines, no override | ~33 integers, 0 headers | Wrong for `build_art`. Kept as the **default** only. |
| Line tags + optional `steps` | ~33 integers, 1 header | **Chosen.** |
| Ordinal tags + a line map on every figure | ~33 integers, 7 headers | Rejected: more text, and an ordinal cannot be checked against the listing by eye. |
| Tag names a `marks:` mark | ~18 integers plus ~15 names | Rejected, see below. |

Reusing mark names looked cheapest and is not. Roughly fifteen of the forty
items are declaration rows whose name already equals a mark name, but `watch`,
`done`, `ret`, and `frame` have no mark, so more than half still need a number.
Worse, a mark is a **lexical extent, not an event**: in the `build_art` figure
`my_art &art 2,11` starts at line 2, the rejected return, while `my_art` is
created at line 10. A mark-derived clock gives that figure the wrong time
silently. The cheaper win taken instead is inheritance, which removes a
comparable number of integers and adds no second binding rule.

The renumbering cost the review raised is real and bounded: inserting a source
line means editing `marks:` and the diagram's tags for that one figure, which is
the same edit the author already makes to `marks:` today.

### Is a stepped reveal "animated"? (resolves R2)

A reveal alone is not, so motion is part of the feature. Under
`prefers-reduced-motion: no-preference`, a step change moves: a newly revealed
value fades and slides a short distance into its cell, an arrow draws along its
path, a strike wipes across the value it cancels, and the listing's spotlight bar
slides to the new line. Under `prefers-reduced-motion: reduce`, every one of
these becomes an instant state change — opacity only, no transform, no path
drawing, no transition duration. Motion is removed; nothing is suppressed. The
stepper never advances on its own, so WCAG 2.2.2 does not engage; it would the
moment an autoplay mode were added, which is out of scope.

### The stepper contract

State lives on `figure.trace-figure`:

- `data-trace-steps="m"` and `data-step="n"`.
- Every timed element inside the SVG carries `data-at="<n>"`, written by the
  renderer from the parsed model.
- The stepper writes `data-state="past" | "current" | "future"` on every
  `[data-at]` element. Only `future` is dimmed. Plain attribute selectors are
  enough; no `:has()`, and no generated table of `[data-step="i"] [data-at="j"]`
  rules.
- The listing's `.highlight-gutter-line[data-line="L"]` for `L = S[n-1]` takes
  `data-state="current"`. A figure whose listing is a plain code fence, with no
  `data-line` spans, still steps its diagram and spotlights nothing.

Controls are a `<div class="trace-stepper" role="group" aria-label="Step through
the trace">` appended inside the figure, holding three real
`<button type="button">` elements — Replay, Previous, Next — and a
`<p role="status" aria-live="polite">` reading `Step n of m — <the spotlighted
source line>`. `ArrowLeft`, `ArrowRight`, and `Home` act while focus is inside
the figure. Previous and Next disable at the ends.

**Initial state is step m**, the complete figure. Loading the page changes
nothing visually, and the reader opts in with Replay. Nothing is ever
`aria-hidden` or `display: none`, so a screen reader reads the whole trace at
every step, and print takes the complete figure.

The stepper mounts from `mountTraceSteppers(document)`, called by
`src/components/mermaid/client.ts` after `bootMermaid()` resolves — the SVG does
not exist before that. `clientModules` on `pages/blog/[id]/page.ts` is unchanged.

### Failure modes

- A tag naming a line absent from an explicit `steps` list is a parse error
  carrying the diagram's line and column, as `TraceSyntaxError` already does.
- Two `steps` statements, or a `steps` after a frame, is a parse error.
- A `steps` entry past the end of the listing cannot be caught by the parser,
  which never sees the listing. The stepper detects it at mount, skips the
  spotlight for that step, logs once, and leaves the diagram steppable.
- A mermaid failure leaves the `<pre>` text and no control bar.

### Verification

Automated: the one feature test below, plus every existing suite green and
unmodified — `src/lib/trace-diagram/trace-diagram.feature.test.ts` in particular,
which pins today's untagged rendering.

Manual: `node scripts/serve.ts --port 8080`, then `playwright-cli` against
`http://127.0.0.1:8080/blog/interview_07_tracing_rust/`, screenshotting step 1 and
step m. This is the repository's visual check per `AGENTS.md`, not its test
runner.

## Alternatives

- **reveal.js as a dependency.** Rejected in `research.md`: a fixed scaled slide
  viewport, a global reset stylesheet, URL-hash ownership, keyboard capture, and
  ~31 kB gzipped, in exchange for semantics that are four attributes to copy.
  Its hide-by-default stylesheet also inverts this site's degradation rule.
- **Mermaid's own animation.** `animate: true` on flowchart edges is continuous
  motion, not steps, and does not reach an out-of-tree diagram type.
- **A radio-and-`:checked` CSS-only stepper.** Genuinely JavaScript-free, but it
  adds one `<input>` per step to the markup and cannot spotlight a listing line
  across the figure without `:has()`.
- **Build-time pre-rendered SVG frames.** One SVG per step removes the client
  parse but multiplies page weight by m and forks the renderer's only output
  path.

## Summary

Two optional additions to `traceDiagram` — a trailing `@<line>` tag and a single
`steps` execution-order statement — give each figure a computable step sequence.
A ~100-line local stepper drives `data-step` on the figure and `data-state` on
the timed elements, starting at the complete figure so every degradation path
already works. Roughly 33 integers and one `steps` line are added across
`posts/interview_07_tracing_rust/post.md`.

**Feature test:**
`/Users/david.souther/devel/davidsouther/resume/src/lib/trace-stepper/trace-stepper.feature.test.ts`

### Open Artifact Decisions

**`src/lib/trace-stepper/stepper.ts`:** the stepper's module home. Options are a
new `src/lib/trace-stepper/` directory (matching `src/lib/astrolabe/` and
`src/lib/flashcards/`, where logic sits in `src/lib/` and only the boot lives in
`src/components/`), or folding it into `src/lib/trace-diagram/`.
Proposed: `src/lib/trace-stepper/stepper.ts`, exporting
`mountTraceSteppers(root: ParentNode): number`, because the stepper spans both
halves of the figure and the trace-diagram directory is the mermaid plugin alone.

**The `steps` keyword:** alternatives are `steps`, `order`, and `trace`.
Proposed: `steps`, because it names the unit the control bar counts.

**Control-bar labels:** alternatives are word labels (Replay / Previous / Next)
and glyphs.
Proposed: word labels, so the accessible name and the visible label match with no
`aria-label` override.
