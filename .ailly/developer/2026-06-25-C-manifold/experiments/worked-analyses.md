# Suggestions for Section 5: Worked Analyses

*Grounding material* Each analysis follows the design's five-field contract:
**pattern · steering move · literature support · predicted failure mode ·
boundary / counterexample.** The design (Section 5) suggests six examples;
all six are covered below, plus one optional capstone.

## The discipline that makes these "work, not rephrasing"

A worked analysis qualifies only if the steering reading **predicts something a
prompt-engineering reading misses** — a failure mode, a boundary, or a measurable
divergence — and a real trace bears it out. The recurring lever: a steering
operator acts on the **document trajectory** (what the model writes), but the
*acceptable region* is defined over a **referent** (a compiler verdict, a visible
panel, a retrieved fact, a green test). The lens earns its keep by predicting
**when those two decouple.** That is the throughline; each example below is one
way the coupling can break.

## Coverage map

| # | Required example | Primary grounding | Sharpest prediction |
|---|---|---|---|
| 1 | Compiler-error repair / Self-Debug | `ddd-developer-loop` (red-green-refactor); `chen2023` | external feedback re-steers; **intrinsic** correction without it does not |
| 2 | CoT / pause tokens | `ddd-developer-loop` (`thinking` skill); `li2024`,`pfau2024`,`merrill2023` | buys **serial depth**, not breadth; no gain when the task isn't serial-bottlenecked |
| 3 | HyDE / retrieval expansion | `analyst-eval-failures` ("made things up after a failed search") | fabricates a stand-in when the neighborhood is **empty** |
| 4 | Subagent review / multi-sample | `ailly-evals` (matrix fan-out); `ddd-developer-loop` (cold-read reviewer) | branches **collapse** onto shared prompt/context bias |
| 5 | ReAct / tool-interactive | `analyst-eval-failures` (**false completion**) | document reaches target while **referent doesn't** — silently |
| 6 | LATS / tree search | `ddd-developer-loop` (forward-backward maps); `ailly-evals` | cost explodes; only pays when the artifact is **cheaply verifiable** |
| 7* | The developer loop (capstone) | `ddd-developer-loop` | a fully-legible trajectory: every operator + constraint on disk |

Citation keys already in `refs.bib`: `chen2023`, `huang2023`, `kamoi2024`,
`li2024`, `merrill2023`, `pfau2024`. **Keys to ADD in the bibliography pass
(design step N):** `yao2023react` (ReAct), `gao2023hyde` (HyDE),
`zhou2024lats` (LATS), `wang2023selfconsistency` (self-consistency / sampling),
`chen2024agentless` or similar for multi-sample selection. Flag these in the
claim ledger as TODO until added.

---

## 1. Compiler-error repair / Self-Debug

- **Pattern.** Generate code; run it; feed the failure (stack trace, failing
  test, type error) back into context; regenerate.
- **Steering move.** The execution result is an **external-feedback operator**:
  it repositions the trajectory from the neighborhood of "plausible code" toward
  "code the runtime accepts." The error text is a coordinate fix from outside the
  document.
- **Literature support.** Self-Debug `[chen2023]`. The external-vs-intrinsic
  split: `[huang2023]`, `[kamoi2024]` (intrinsic self-correction without an
  external signal does **not** reliably help). Ledger row 9.
- **Predicted failure mode.** With no genuine external signal (the model
  "reviews" its own output and declares it fixed), the move is intrinsic
  self-correction and the lens predicts **no reliable improvement** — possibly
  regression. The signal must come from the referent (the runtime), not the
  document.
- **Boundary / counterexample.** Strongest when the verifier is **sound and
  cheap** (compiler, unit test). Weakest when the "error" is itself
  model-generated (an LLM critic with no ground truth). Real instance:
  `developer:red-green-refactor` deliberately couples each cycle to a *failing
  test* — the loop refuses to trust intrinsic correction, which is the lens's
  prediction operationalized as process.

## 2. Chain-of-thought / pause tokens

- **Pattern.** Spend intermediate tokens (reasoning, or even filler "dots")
  before the answer.
- **Steering move.** A **serial-computation-depth** budget: more sequential
  steps along the trajectory before committing to the target.
- **Literature support.** `[li2024]` (CoT lets transformers solve inherently
  serial problems; without it they're stuck near TC⁰), `[merrill2023]`
  (expressivity scales with CoT steps), `[pfau2024]` (even contentless filler
  tokens add hidden computation). Ledger row 8. **Caveat:** "thinking widens the
  search / curves the path" is author-analogy; the defensible claim is serial
  depth, not geometric curvature.
- **Predicted failure mode.** On tasks **not** bottlenecked by serial
  computation (simple recall, single-step lookup), extra thinking tokens buy
  little and add cost/latency — the lens predicts a flat return, distinguishing
  it from "more prompt = more better."
- **Boundary / counterexample.** Filler-token results `[pfau2024]` are the sharp
  counterexample to a *semantic* reading: depth, not meaning, is doing the work.
  Real instance: `developer:thinking` fires only on a **red** response (error,
  failing test, bad lint) — serial compute spent exactly where a serial obstacle
  exists, not blanket-applied. Also consider "early stop" signals, encouraging the
  llm to report early if it's already found a defensible document.

## 3. HyDE / retrieval expansion

- **Pattern.** Generate a hypothetical answer/document, embed it, retrieve real
  documents near it, then answer from those (HyDE; HyPE; "Jeopardy" expansion).
- **Steering move.** **Manufacture an intermediate point** in document space to
  relocate the retrieval neighborhood — move the query to a better-connected
  region before drawing real evidence. Alternately in the HyPE variant, generate
  nearby queries (deliberately invoking plausible hallucinations), to then perform
  the document space search. **The two expand opposite sides of the search:**
  HyDE expands the **target basin** (a hypothetical answer/document generated to
  sit near the true answer); HyPE expands the **source rim** (nearby queries
  around the original ask). Both manufacture a stand-in point; they differ in
  which side of the search — answer side or query side — gets the stand-in.
  (Flagged 2026-07-08 during citation confirmation; not yet in the blog post.)
- **Literature support.** HyDE `[gao2023hyde]` *(TODO key)*. Method behavior
  (better recall via a denser query neighborhood) is `established`; the geometric
  story is `author-analogy`. The HyDE lit-review is a **separate deliverable**
  (`2026-06-25-B-hyde-litreview`) — cite lightly, use only as a worked steering
  example here. Similar for HyPE (DOI: 10.1109/ACCESS.2025.3589499).
- **Predicted failure mode.** When the target neighborhood is genuinely
  **empty** (no real document exists), the manufactured stand-in has nothing to
  snap to and the model **answers from the fabrication** — observed directly in
  the Analyst traces: *"made things up after a failed search, especially for
  docs/how-to"* (`analyst-eval-failures`). The lens predicts retrieval expansion
  *amplifies* hallucination precisely at empty neighborhoods. HyPE helps because
  the expanded queries, when empty, let the LLM answer that the neighborhood is
  empty; alternatively, they hallucinate to a nearby intent and find the desired
  document correcting for user inconsistencies.
- **Boundary / counterexample.** Helps when the corpus is dense near the true
  answer but the literal query is lexically far; hurts when retrieval returns
  empty and the system lacks an "I found nothing" guard. The fix is a referent
  check (did retrieval actually return something?), mirroring the eval-design
  rule "don't let a failed search become a confident answer."

## 4. Subagent review / multi-sample search

- **Pattern.** Sample many candidates (or spawn subagents), then select /
  vote / review.
- **Steering move.** **Branch exploration + selection pressure**: launch
  multiple trajectories from related start points, then collapse to the best.
- **Literature support.** Self-consistency / pass@k sampling
  `[wang2023selfconsistency]` *(TODO key)*; selection over samples. `established`
  where citing sampling results; `author-analogy` where claiming the branches
  cover distinct *document-space regions*.
- **Predicted failure mode.** Branches **collapse onto shared prompt/context
  bias** — N samples from one prompt explore one neighborhood, so the "diversity"
  is illusory and selection has nothing better to pick. The lens predicts
  multi-sample gains shrink as shared conditioning dominates.
- **Boundary / counterexample.** Real instances: Ailly's `assemble` matrix
  fan-out gives **genuinely** distinct start points (different bindings/providers)
  + a per-arm `eval` rollup for selection (`ailly-evals`) — diversity by
  construction, the good case. The developer loop's cold-read reviewer
  (`ddd-developer-loop`) is the single-branch review case: a fresh context
  reduces, but does not eliminate, shared-bias collapse. Counterexample to watch:
  a "panel of judges" all sharing the same system prompt is selection theater.
  Jeopardy! Search is a precursor to the same.

## 5. ReAct / tool-interactive agents  — *the load-bearing example*

- **Pattern.** Interleave reasoning, tool calls, and observations to act on an
  external system (the Nominal Analyst: build panels, checks, events).
- **Steering move.** Each tool call is a move whose **observation** is supposed
  to re-couple the document trajectory to the referent (the external state)
  before the next move.
- **Literature support.** ReAct `[yao2023react]` *(TODO key)*. The
  observation→re-steer loop is `established`; "the agent walks the document
  manifold toward a goal region" is `author-analogy`.
- **Predicted failure mode — measured, not metaphorical.** When the observation
  channel is **weak or unread**, the two trajectories **decouple**: the model
  moves its *document* into the target region ("I've created the panel / updated
  the check / done") while the *referent never moved*. In the Analyst trace
  analysis this was the most common observed failure, and — the sharp part —
  roughly two-thirds of the failing cases carried no error at all
  (`analyst-eval-failures`). These counts are from hand-picked traces, not a
  random sample, so they show *what* fails, not *how often*. A prompt-engineering
  reading has no account of this; the steering reading predicts both the failure
  **and its silence** (nothing crashed, so no error).
- **Boundary / counterexample.** Predicted to *not* occur when every state
  change is **observed and verified before narration**. The eval-design fix
  proposed in the source — *"compare what the Analyst claimed against what
  actually changed and what the user said next"* — is the lens's falsifiability
  instrument made concrete. It measures the referent trajectory, not just the
  document trajectory. Cousin case for the boundary: tasks the tools **can't** do
  (rename) where the agent claims success anyway — a failure to represent the
  region's edge.

> Note for the author: this example, paired with `analyst-eval-failures`, is the
> paper's best shot at "the lens does work beyond rephrasing." Lead Section 5
> with it, or place it as the climax. It is also the most defensible row to cite
> as *observed* (with the hand-picked-not-random caveat carried verbatim).

## 6. LATS / tree-search agents

- **Pattern.** Expand a search tree of action sequences with backtracking and
  value estimates (LATS), rather than committing to one trajectory.
- **Steering move.** **Explicit search over trajectory space** with a frontier
  and a value/selection function — the generalization of multi-sample to a tree
  with lookahead and backtrack. This is the sharper cousin of Jeopardy! Search's
  fan-out (§3): where Jeopardy fans out multiple candidate queries in parallel,
  LATS's backtracking instead recognizes a trajectory isn't going to work out
  and backs off to restart, rather than fanning out further — pruning instead
  of broadening. (Flagged 2026-07-08 during citation confirmation; not yet in
  the blog post.)
- **Literature support.** LATS `[zhou2024lats]` *(TODO key)*. `established` for
  the search procedure; `author-analogy` for "regions of the document manifold."
- **Predicted failure mode.** Cost explodes with breadth × depth, and the
  payoff depends entirely on a **trustworthy value signal**. Without a cheap,
  sound verifier the search optimizes a proxy and the lens predicts
  expensive-and-no-better (or worse: confidently wrong at a high-value-estimate
  dead end).
- **Boundary / counterexample.** Pays off only when artifacts are **cheaply and
  soundly verifiable** (so the value signal is real) and breadth is genuinely
  needed. Real, legible instance: the developer loop's **forward-backward maps**
  (`ddd-developer-loop`) — bidirectional search (backward from the passing test,
  forward from current code) with the frontier **externalized to disk** so steps
  can't silently drift. It deliberately stays cheap (a handful of written
  candidates, a sound test oracle), which is the boundary condition the lens
  names.

## 7. Capstone (optional): the developer loop as one worked trajectory

If Section 5 wants a single example that exercises *every* operator, the
`domain-driven-design` developer loop is a fully-specified, on-disk trajectory:
research (reposition start) → design (**define the target region** as a failing
feature test) → plan (sequence the moves; forward-backward search when unclear)
→ build (external-feedback red-green-refactor) → cleanup, with **draft gates**
as scheduled external-feedback checkpoints between moves. It is the rare agent
workflow where every steering operator and every region constraint is written
down and inspectable — the cleanest demonstration that "workflow = sequence of
steering operators toward an acceptable region" is a description of real
practice, not a metaphor. It also coordinates this very paper; mention that only
in passing, if at all.

In fact, this paper was largely developed and supported by the Ailly loop.

---

## Open items for the build-phase author

1. **Add the five TODO citation keys** to `refs.bib` (ReAct, HyDE, LATS,
   self-consistency, multi-sample selection) — the citation checker
   (`evals/scripts/check_citations.py`) will fail until they resolve.
2. **Carry the "hand-picked, not random" caveat** verbatim wherever the Analyst
   numbers appear; add a claim-ledger row tagged `contested`/`observed` with an
   explicit *Does not support: base-rate frequency* field.
3. **Section 6 ("What this lens predicts")** should harvest the per-example
   failure modes above into its conditions (target observability, feedback
   reliability, search breadth, artifact inspectability, serial dependency,
   cost, prompt-bias collapse) — they were written to line up with that list.
4. **Keep examples 5 and 1 as the spine** — they carry the only *measured* and
   the only *settled-literature* failure modes respectively; the rest are
   strong but lean more on analogy.
