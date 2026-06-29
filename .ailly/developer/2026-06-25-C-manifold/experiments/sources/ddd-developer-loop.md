# Source: the `domain-driven-design` developer loop (an explicit trajectory)

Distilled 2026-06-29 from `/Users/david.souther/devel/davidsouther/domain-driven-design`
(`developer/` plugin: the `ailly` coordinator skill plus
`developer/skills/ailly/references/phases/` and
`developer/skills/ailly/references/abilities/`). This is the same loop
coordinating the manifold-paper project itself.

## Why it grounds the lens

Most agent workflows hide their steering behind a single prompt. This one writes
the whole trajectory down. The loop is five phases, each emitting an artifact
that **narrows the acceptable region for the next phase**:

| Phase | Artifact | What it constrains downstream |
|---|---|---|
| Research | `research.md` (+ a verbatim "load these skills" directive) | scope + which library idioms design may use |
| Design | `design.md` **+ one failing feature test** | the **target region** — the executable definition of done |
| Plan | `plan.md` (3–7 steps, each naming the assertion it enables) | the ordered sequence of moves to reach the region |
| Build | red-green-refactor commits | each cycle advances the feature test measurably |
| Cleanup | deferred decisions → `TASKS.md`; merge gate | — |

This is "a workflow is a sequence of steering operators that progressively
shrink the region of acceptable documents" stated as a development process. Each
phase is an operator; the artifact it emits is the constraint it adds.

## The feature test = the target region, written first

The single feature test is authored during Design and **left red** until the
work is done. It is the backward anchor: every plan step is justified by naming
*which assertion in that test it turns green*
(`developer/skills/ailly/references/phases/plan.md`). The
region is defined before any move is made — exactly the "name the target region,
then steer toward it" structure the lens prescribes.

For a **project** (this paper), the single feature test is replaced by a
*Closing Bell* — a read-cold human study + the automated eval suite. Same role,
larger region.

## Draft gates = external-feedback checkpoints

After Research / Design / Plan, the loop **stops** and will not proceed until a
human removes the `*Draft*` marker. The rule is absolute:

> "Do not proceed past a draft gate in the same session under any circumstances."

And the scripted decline the coordinator gives if asked to continue anyway names
the reason:

> "The draft gate exists so you have a chance to review and refine before the
> next step builds on it."

In lens terms this is a deliberate **external-feedback operator** inserted
between moves — the same category as a compiler error or a user's "I don't see
it," but scheduled rather than reactive. It exists precisely because *intrinsic*
self-correction is weak (ledger row 9): the loop does not trust the agent to
catch its own wrong turn, so it forces an external read before compounding it.

## Forward-backward maps = explicit bidirectional search

When the path is unclear,
`developer/skills/ailly/references/abilities/forward-backward.md` has the
agent search **backward from the passing-test state and forward from current
code**, and — load-bearing detail — **externalize each candidate step to a map
file** rather than hold it in context:

> A step held only in context can drift or be silently dropped; a written step
> can be read back and evaluated precisely.

That is a tree/graph search over trajectory space with the frontier written to
disk — a lightweight, legible cousin of LATS-style search.

## Subagent / phase isolation = independent-perspective review

Quick-loop and long-loop modes run each phase in an isolated subagent, and the
long-loop reviewer "reads each artifact cold." This is the subagent-review
steering move: a fresh context evaluates the artifact without the originating
trajectory's bias.

## What it lends to which worked analysis

- **Compiler-error repair / Self-Debug** — red-green-refactor is the canonical
  external-execution-feedback loop: the failing test/error is the nudge that
  re-steers the next move.
- **LATS / tree search** — forward-backward maps are externalized bidirectional
  search over trajectory space.
- **Subagent review / multi-sample** — phase isolation + cold-read reviewer.
- **CoT / pause tokens** — the `developer:thinking` skill is triggered on a
  "red" response (compiler error, failing test, bad lint): an explicit
  serial-compute budget spent before the next move.
- **The whole loop** as a single worked example: a legible, fully-specified
  steering trajectory whose every operator and constraint is on disk.
