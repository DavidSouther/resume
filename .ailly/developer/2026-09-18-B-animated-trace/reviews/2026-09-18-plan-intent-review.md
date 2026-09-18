# Intent Review — plan.md (2026-09-18)

Anchor: `research.md` "Topic and Intent" verbatim quote. No `.ailly/prompts/` file
exists for this session.
Dispatch: cold. A freshly dispatched reviewer read `plan.md`, `design.md`,
`reviews/2026-09-18-research-intent-review.md`,
`reviews/2026-09-18-design-intent-review.md`, the feature test, and
`posts/interview_07_tracing_rust/post.md`, with no access to the session's
reasoning trail.

Plan-phase categories: plan scope, design assumption.

## P1 — Nothing is added to the table; every item is present from step 1 (design assumption)

The request: *"Stepping through the code will **add and update** items in the
value table."* As planned, the SVG is drawn complete at mount and a step change
only rewrites `data-state`; Step 6's base rule dims `[data-state="future"]` and
leaves it in place. The design states the reason — "the shape of the finished
trace stays visible, so nothing reflows" — but the prior reviews only settled
whether *past* items dim, never whether *future* items are visible at all.

**Falsifiable:** as planned, a reader at step 1 of the `build_art` figure already
sees `Artwork Liberty`, the return arrow, and the frame X, at reduced opacity;
no item ever appears. Is a dimmed-then-bright reveal the intended reading of
"add", or should a future item be invisible (`opacity: 0`, layout reserved) so
that stepping makes it appear?

## P2 — Backward motion is unspecified, and Replay un-reveals six steps at once (plan scope)

The request leads with *"tracing will work best when it's animated."* Step 6
specifies motion for one direction only: a revealed value slides in, an arrow
draws, a strike wipes. Previous and Replay are in the control bar and in the
feature test, but the plan never states what those transitions do. A CSS
transition written for the forward case runs in reverse by default, so Replay
from step 7 would play six simultaneous un-draws and un-wipes.

**Falsifiable:** as planned, pressing Replay at step 7 animates the entire figure
backward at once, and D1 makes Replay the button the reader presses after
reaching the end. Should backward transitions be instant (motion forward only),
or is reverse motion intended?

## P3 — D1 dims all seven figures on the post, not just the one in view (plan scope)

The design review asked whether a mounted figure starts at step 1, and offered
"or advance on entering the viewport". D1 takes step 1 and does not address
scope: `mountTraceSteppers(document)` mounts every figure on the page, so after
`bootMermaid()` resolves, all seven figures in
`posts/interview_07_tracing_rust/post.md` drop to their first statement at once.
The surrounding prose discusses finished traces.

**Falsifiable:** as planned, a reader who opens the post and scrolls without
pressing anything reads seven mostly-dimmed figures whose prose describes the
complete trace. Is a whole-page reset intended, or should a figure reset only on
first interaction or on entering the viewport?

## P4 — The notation ships repo-wide; only one post uses it (plan scope)

*"update the mermaid annotations so that each can be animated on its own"* names
the notation, not one post. Step 4 tags the seven figures of
`interview_07_tracing_rust` only. `posts/interview_03_tracing.md` holds six more
`traceDiagram` blocks and `posts/memory_diagrams_papers_mermaid.md` holds
nineteen; hard requirement 1 keeps every one of them byte-identical and therefore
permanently unsteppable.

**Falsifiable:** as planned, twenty-five existing trace diagrams in two other
posts stay static after this feature ships. Is one post the intended deliverable
for this pass, with the others tagged later?

## Deduped — not raised

- Mount state step 1 versus step m — plan answers with D1, including the
  reversal constant and the three feature-test edits.
- `steps` as an out-of-band storyboard — plan answers with D2: default path for
  six figures, `steps` for `build_art` alone.
- Occurrence rule for statement-level tags — plan answers with D3.
- Transport of S to the client — plan answers with D4: `data-trace-lines`,
  written by `pairListingsWithDiagrams`.
- Ordering verified only by hand — plan answers with D5: the table-driven test
  over all seven steps.
- Whether a reveal counts as animated — design resolves it; P2 above asks only
  about the direction the plan leaves unstated.
- Module home, `steps` keyword, control-bar labels — already Open Artifact
  Decisions in `design.md`.
- reveal.js as a runtime dependency — resolved in `research.md` and `design.md`.
