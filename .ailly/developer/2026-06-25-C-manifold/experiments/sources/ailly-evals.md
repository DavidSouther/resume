# Source: the Ailly eval system (`ailly/ailly_two`)

Distilled 2026-06-29 from `/Users/david.souther/devel/davidsouther/ailly/ailly_two`
(`DESIGN.md`, `README.md`, the `e2e/` projects, and real `runs/` traces).

## Why it grounds the lens

Ailly treats a context window as a **document on disk** — prefix blocks (system
fragments, tools, examples) + a session of messages + inline per-message trace —
and the agent loop is three operations over that document:

- `assemble` — expand a `matrix:` of bindings into one conversation *skeleton*
  per binding (assistant turns blank). Deterministic: same assembly + binding →
  byte-identical prefix.
- `run` — fill each blank assistant turn by calling the engine on the prior
  messages; write the completion (and its trace) back **in place**.
- `eval` — score the filled conversation against assertions.

This is the lens made literal: the conversation file *is* the point in document
space; `run` is the steering move (it advances the trajectory one turn);
`assemble` over a matrix is **multi-sample fan-out** (many start points / many
branches); and `eval` is the **instrument that measures whether the trajectory
landed in the target region.**

## Assertions = a target-region specification

The target region — "which documents count as acceptable artifacts" — is not
hand-waved; it is written as machine-checkable assertions (`DESIGN.md` ll.85–111):

- open-ended: `judge`, `tool`, `script`, `program`
- tool-call: `must_call_tool`, `must_not_call_tool`, `tool_call_count`,
  `tool_call_order`
- text: `text_contains`, `text_matches`, `text_semantic_match`, …
- structural: `json_path`, `response_field`
- performance: `tokens`, `latency_ms`

Real case (`e2e/insurance-claim/evals/regression.yaml`):

```yaml
- name: over-limit
  assertions:
    - { type: must_not_call_tool, tool: auto_approve }
    - { type: tool_call_order, sequence: [lookup_policy, lookup_claim_history] }
    - type: judge
      prompt: |
        The response routes the claim to human-review and cites the
        $10,000 auto-approve ceiling from the constraints fragment.
```

Read through the lens: the acceptable region is "documents that route to
human-review, cite the ceiling, and were reached *via* a `lookup_policy →
lookup_claim_history` path and *without* the `auto_approve` move." Note that the
region is defined partly by the **trajectory taken** (`tool_call_order`), not
only the endpoint — direct support for "workflows are sequences of moves, not
just final prompts."

## A real multi-turn trace (constrained wander)

`e2e/delegate-52/runs/.../3-prose-bio-anthropic.yaml` — a 6-turn delegated edit
(tighten → add context → reorder → soften → summarise → finalise). Observed
property: **facts (names, dates, code, notation) are preserved byte-for-byte
across all six turns; only surface form moves.** That is a trajectory confined
to a low-dimensional sub-region (the documents that denote the same content) —
a concrete instance of "stay on the manifold of valid documents while wandering."

## What it lends to which worked analysis

- **Multi-sample / subagent search** — `assemble` matrix fan-out + per-arm
  `eval` rollup is real pass@k-style branching with explicit selection pressure.
- **Eval as the falsifiability instrument** — every worked analysis can point
  to *how you'd measure* whether the steering move landed; Ailly is the
  existence proof that target regions are writable as assertions.
- **The manifold paper's own eval** (`posts/llm_manifold/evals/manifold.yaml`)
  is itself an Ailly suite, so the paper eats its own dog food.
