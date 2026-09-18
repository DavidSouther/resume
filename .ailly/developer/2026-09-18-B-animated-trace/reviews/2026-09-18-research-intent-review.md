# Intent Review — research.md (2026-09-18)

Anchor: `research.md` "Topic and Intent" verbatim quote. No `.ailly/prompts/` file
exists for this session.
Dispatch: cold. A freshly dispatched reviewer read the artifact with no access to
the session's reasoning trail.

Research-phase variant: blind spots that the current frame makes invisible.

## R1 — A listing line is a location, not a time

The request says *"Each item in the value table trace happens while reading
through the code"* and *"some timing information might be necessary"*. Research
oriented on a clock that is already free: the 0-based listing line that
`highlight-gutters` emits as `data-line`. That orientation appears to hide the
difference between *where* an event occurs and *when* it occurs.

Two figures in `posts/interview_07_tracing_rust/post.md` seem to break the
equivalence:

- The last figure (fences at 338/359) traces `fn build_art` called from `main`.
  Execution order is main line 10, then callee lines 1 and 2, then main line 11.
  A `data-step` that holds a line index and a `next` button that advances it
  either replays the callee before the caller, or needs an order that the tags
  do not state.
- Research itself names a loop trace (`a: 1071, 609, 147`) in Falsification, but
  a loop body line carries one line index for many events. Two `@5` tags on one
  row are then indistinguishable.

**Falsifiable:** as researched, a diagram that calls a function or repeats a line
cannot be stepped in execution order, because the tag carries a line, not an
ordinal. Is the step a *sequence position* that also names a line, rather than a
line used as the sequence?

## R2 — "Animated" was converted to "revealed"

The request opens with *"tracing will work best when it's animated"*. Research
oriented on reveal.js **fragments**, so the output is a discrete visibility
change: an item is dim, then it is not. Motion is then pushed behind
`prefers-reduced-motion: no-preference` and is optional. Orienting on fragments
may make invisible the reading where the value, the strike, and the arrow have
motion that shows the event — an arrow that draws toward its target, a value that
enters the row.

**Falsifiable:** as researched, a reader with default settings sees no movement at
all, only an opacity change. Is a stepped reveal sufficient, or is motion part of
what "animated" asks for?

## R3 — What one press of "next" does is undefined

*"Stepping through the code"* implies the reader moves through the **code**.
Research defines the state (`data-step`) and the controls (prev/next), but no
part of the artifact states the step set. Two readings remain open:

- Steps are the tagged events. The reader then skips source lines that have no
  trace event, and never stops on `fn main() {`.
- Steps are the listing lines. Most presses then change nothing in the table.

**Falsifiable:** as researched, the number in "Step n of m" cannot be computed,
because `m` is not defined. Which set is the reader stepping through?

## R4 — Minimal syntax was measured per token, not per document

*"Try to add as little new syntax as possible"* was read as one lexical rule.
That frame appears to hide the authored volume: the seven figures hold roughly
forty values and statements, and candidate B tags each one with a hand-counted
line index. The listing beside each diagram already names its extents
(`art1 1,3`, `borrowed &art1 2,4`), so a diagram item could point at a mark name
instead of a raw integer, or the `marks:` section could own the storyboard.
Research placed `highlight-gutters.ts` out of scope after finding `data-line`
present, which may have closed that option before it was compared.

**Falsifiable:** as researched, an author who inserts a line into a listing must
renumber every tag in the neighbouring diagram by hand. Is a raw line integer the
intended author-facing unit, or should a tag name an existing mark?

## R5 — No verification of the stepped output

Scope lists five items; none is a test. The frame is parser, renderer, client
module, CSS, and post edits. That frame makes visible correctness invisible: a
test can assert that `@2` parses and that a `g[data-at="2"]` exists, while the
figure still steps in the wrong order or dims the wrong arrow. `AGENTS.md` names
`playwright-cli` for visual verification, and the artifact does not mention it.

**Falsifiable:** as researched, nothing confirms that the arrow appears with the
value that owns it. Should the feature drive a real browser render?

## Deduped — not raised

- Per-figure versus per-post controls — already Open decision 3.
- Strike timing — already Open decision 4.
- Sigil choice `@` versus `#` — already Open decision 1.
- Dimming past items — already Open decision 2.
- reveal.js as a dependency — already resolved in Scope (Out) and Falsification.
- Animating the gutter bands — already Scope (Out), with a stated reason.
