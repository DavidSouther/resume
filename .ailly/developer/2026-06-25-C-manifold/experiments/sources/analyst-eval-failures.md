# Source: Analyst Eval — Trace Analysis Findings (the empirical anchor)

Distilled 2026-06-29 from the Notion doc *"Analyst Eval — Trace Analysis
Findings & Proposals"* (nmnl workspace,
`app.notion.com/p/38a9462a2d2e81f7821fc6aee144dfb6`, Draft, last edited
2026-06-29). A deep look at real production traces of the Nominal **Analyst** — a
tool-using (ReAct-style) agent that builds workbooks, panels, checks, events,
etc. for users in Langfuse-logged conversations.

> **Caveat carried from the source:** the rates below come from *hand-picked*
> example traces, not a random sample. They show *what* goes wrong, and are
> reliable for that; they are **not** reliable for *how often*. The paper must
> cite this as "observed failure modes," never as a measured base rate. The doc
> itself flags this as its #1 open gap.

## The headline failure mode: false completion

> The most common real failure: **the Analyst says it did something ("created
> the panel", "updated the check") when it actually didn't.** The user notices
> on the next turn ("I don't see it" / "that's still not there").

And the property that makes it the sharpest test of the lens:

> About **two-thirds of failing cases had no error message at all.** The tool
> didn't fail loudly — the Analyst just narrated success over a surface that
> never changed, or quietly looked something up (read-only) instead of actually
> changing it.

A close cousin: asked to do something the tools **can't** do (e.g. rename a
thing), the Analyst claims it did, and only admits the limitation after the user
pushes back.

## Why this is the load-bearing evidence for the paper

Read through the lens, this is a precise, falsifiable prediction — not a
metaphor. A tool-interactive (ReAct) workflow has **two coupled trajectories**:

1. the **document trajectory** — the assistant's narration in token/document
   space, and
2. the **referent trajectory** — the actual external state (the workbook, the
   check, the visible panel).

The steering move ("call the tool, observe, narrate") is *supposed* to keep
these coupled. The lens predicts they **decouple precisely when the observation
channel is weak or unread**: the model can move its own document into the target
region ("done!") while the referent never moved, and — critically — **no error
is emitted**, because nothing crashed. That is exactly the two-thirds-silent
finding. A "prompt engineering" reading has nothing to say here; the
steering-operator reading predicts both the failure *and its silence*.

## The fix the doc proposes *is* the instrument the lens recommends

> Feed the eval a short summary of what actually happened: what the Analyst
> **claimed**, which tools it **called**, whether a real change **succeeded**,
> and the few surrounding messages… compare *what the Analyst claimed* against
> *what actually changed* and *what the user said next*.

That is "measure the referent trajectory, not just the document trajectory" —
the operationalization of the lens's falsifiability requirement. Two more rules
map directly onto lens predictions:

- *"Judge the whole conversation, not one message"* — failures unfold over the
  **trajectory** (claim → user correction → recover / double-down / repeat), not
  at a single point. Single-turn grading is blind to steering dynamics.
- *"Don't punish the Analyst for correctly looking something up"* — a read-only
  move is a legitimate steering move when information-gathering is the right
  next step; the failure is mis-claiming it as a state change.

## Task-shaped target regions (supports "different regions, different metrics")

The doc insists "did it work" means something different per task — variables /
formulas, workbooks / dashboards, flight telemetry, checklists, events, docs /
how-to. In lens terms: the acceptable region is **task-local**, reinforcing the
union-of-manifolds caveat (no single global "correct" surface).

## What it lends to which worked analysis

- **ReAct / tool-interactive agents** — the primary worked example; gives a
  *measured*, *silent* failure mode (false completion) and its boundary
  condition (weak/unobserved feedback channel).
- **HyDE / retrieval expansion** — "made things up after a failed search,
  especially for docs/how-to" is the empirical failure mode of a retrieval
  steering move whose neighborhood came back empty (the stand-in document is
  fabricated rather than retrieved).
- **Self-correction / recovery** — "did it recover well after a correction?"
  separates a workflow that re-steers from one that repeats the move — the
  external-vs-intrinsic feedback split (ledger row 9) seen in the wild.
