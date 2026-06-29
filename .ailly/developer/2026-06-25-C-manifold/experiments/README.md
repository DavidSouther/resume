# experiments/ — grounding material for the Worked Analyses

This folder holds the **real agentic-workflow material** the paper's Section 5
(*Worked analyses*) draws on, so the worked examples are read off observed
systems rather than invented to fit the lens. The lens claims agent workflows
are *sequences of steering operators that move generation through document space
toward a target region of acceptable artifacts*. A worked analysis earns its
place only if it shows the lens **doing work beyond rephrasing** — i.e. it must
predict a failure mode or boundary condition that a naive "prompt engineering"
reading would miss, and a real trace must bear that prediction out.

Per the design's Section 5 contract, each worked analysis carries five fields:
**pattern · steering move · literature support · predicted failure mode ·
boundary condition / counterexample.**

## Layout

- [`worked-analyses.md`](worked-analyses.md) — **the deliverable.** Suggestions
  for Section 5: a coverage table mapping each required example to a grounding
  source, then a per-example write-up in the five-field schema, with the
  citation keys (existing and TODO) each needs.
- [`sources/`](sources/) — evidence notes distilled from three real systems:
  - [`ailly-evals.md`](sources/ailly-evals.md) — the Ailly eval system
    (`ailly/ailly_two`): assertions as *instruments that measure whether a
    steering move landed in the target region*, plus a real multi-turn
    document-editing trace.
  - [`analyst-eval-failures.md`](sources/analyst-eval-failures.md) — the
    Analyst eval trace-analysis findings (Notion). **The empirical anchor.**
    Real, observed failure modes of a production ReAct-style agent — chiefly
    *false completion* (claims success it didn't earn, with no error). This is
    the sharpest falsifiable prediction the lens makes.
  - [`ddd-developer-loop.md`](sources/ddd-developer-loop.md) — the
    `domain-driven-design` developer plugin: a fully-specified
    research→design→plan→build→cleanup workflow whose draft gates and feature
    test are an *explicit, human-readable* steering trajectory.

## How this folder relates to the paper

These are **suggestions and grounding notes, not Section 5 prose.** Writing the
actual Section 5 prose is a build-phase per-section feature (design step 2..N-2)
and must clear its own draft gate. Nothing here edits `paper.md`. The intended
use is: the build-phase author of Section 5 reads `worked-analyses.md`, picks
the examples, and writes prose citing these traces.

The strongest new result this material unlocks: the Analyst findings let the
paper state its failure-mode prediction **empirically**, not just by analogy. A
tool-interactive steering operator can move the *document* (the assistant's
narration) into the target region while the *referent* (the external visible
state) never moves. The lens predicts exactly this divergence when the
observation channel is weak, and most position papers have no measured failure
to point at here.
