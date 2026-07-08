---
title: "LLMs as a Model of Syntactic Space: The Document Manifold and a Lens for Agentic Workflows"
author: David Souther
date: 2026
abstract: >
  TODO (step N-1). A synthesis/position paper framing LLMs as a machine-learned
  model over the syntactic/document space of language — functions → programs →
  documents → "wander" — and reading that picture as a recipe for agentic AI
  workflows. The contribution is the agentic-workflow lens, not a new formalism.
bibliography: refs.bib
csl: ieee.csl
---

<!--
DRAFT SKELETON — outline contract from
.ailly/developer/2026-06-25-C-manifold/design.md (project phase: Review).
Each section is a feature-step (design step 2..N-2). Build phase fills the prose.
Citations are IEEE-style inline [n]; keys resolve against refs.bib.
-->

## 1. Introduction

TODO. The picture in one paragraph; what is and is not being claimed (synthesis +
agentic lens, not a new formalism); roadmap.

## 2. Functions, Programs, and Documents

TODO. The set of all functions (computable subset; near-miss neighborhoods); the
many-to-one program→function denotation map [program-synthesis / full-abstraction
refs]; "a bug is the correct implementation of a neighboring function" (mutants).
**Caveat to carry:** the continuous *program*-space metric is the author's analogy,
not a metric theorem.

## 3. Generation as a Wander on the Document Manifold

TODO. Training to stay on the manifold of valid documents; generation as a
trajectory from the prompt. **Caveats to carry:** the manifold picture holds for
*contextual hidden states*, not static token embeddings (which violate it); real
data is a *union* of varying-dimension manifolds, not one smooth surface.

## 4. Steering Operators for Agentic Workflows

A single move recurs across the agentic patterns in production use today: some
operator acts on the **document trajectory** — the tokens the model actually
writes — in order to move it toward or away from an acceptable region. What
differs, pattern to pattern, is *what* the operator acts on, *when* it fires
in the workflow, and — the axis this paper treats as load-bearing — whether it
ever checks the trajectory against a **referent**: an external state the
document is supposed to track, such as a compiler verdict, a passing test, a
retrieved fact, or a visible panel in a live application. Table 1 organizes
seven operators along that axis.

**Table 1. Steering operators and their coupling to a referent.**

| Operator | What it does to the trajectory | Signal it uses | How (or whether) it checks the referent |
| --- | --- | --- | --- |
| Prompting / soft prompts | Fixes the start point and framing before generation begins | The prompt's own conditioning tokens | Never — there is no return path once generation starts |
| Retrieval, HyDE, HyPE, "Jeopardy" expansion | Manufactures an intermediate point (a hypothetical answer, or a set of paraphrased queries) and searches around it | One generated stand-in, embedded and used once | Only implicitly, through whichever real documents happen to sit nearby; nothing confirms the neighborhood is non-empty |
| External tool / execution feedback | Re-derives the next move from an outside verdict — a stack trace, a failing test, an API response | The tool's returned output, fed back into context | Explicitly, and repeatably: each call is a fresh checkpoint against the referent |
| Thinking / chain-of-thought / pause tokens | Buys extra sequential computation before committing to an answer | Nothing external; the extra tokens are spent and discarded | Never — the operator lives entirely inside the document, with no observation step |
| Subagents / multi-sample branching | Launches several trajectories from related start points, then collapses to one via selection or voting | The comparison or voting step over the branches | Only as good as the branches' diversity; a shared prompt makes the comparison circular |
| ReAct-style tool interaction | Interleaves a reasoning move, a tool call, and an observation, repeatedly | The observation returned after each tool call | Explicitly, once per step — but only as reliable as whether that observation is actually read and acted on |
| LATS / tree-search agents | Expands a frontier of candidate trajectories with backtracking, guided by a value estimate | A value or selection function over partial trajectories | Only as sound as the value signal; a proxy value function makes the search confidently wrong |

Prompting and chain-of-thought never touch a referent at all: they reshape the
trajectory using only what is already inside the document. Retrieval expansion
touches one once, implicitly. Tool execution, ReAct, and tree search touch it
repeatedly and explicitly, which is exactly why they can fail *loudly* when the
signal is trustworthy and *silently* when it is not. Section 5 grounds each of
these seven operators in a worked instance and shows, case by case, what
happens when that referent-coupling breaks.

## 5. Worked Analyses

A worked analysis earns its place in this section only when the steering
reading predicts something a prompt-engineering reading misses: a specific
failure mode, a boundary condition, or a divergence a real trace can show. The
throughline across all six cases below is the one Table 1 names: a steering
operator acts on the document trajectory, but the region that actually matters
is defined over a referent, and the lens is only useful to the extent that it
predicts *when* the two decouple.

### 5.1 ReAct and tool-interactive agents (the load-bearing case)

**Pattern.** The Nominal Analyst, a tool-interactive agent, interleaves
reasoning, tool calls, and observations to build panels, checks, and events
against a live workbook. **Steering move.** Each tool call is meant to work as
an external-feedback operator: the observation it returns is supposed to
re-couple the document trajectory — the assistant's narration — to the
referent trajectory, the workbook's actual state, before the next move
[@yao2023react]. That observation-driven loop is established behavior;
reading it as "the agent walking the document manifold toward a goal region"
is this paper's analogy, not a claim made by Yao et al.

**Predicted failure mode — measured, not metaphorical.** The lens makes a
falsifiable prediction: the two trajectories decouple exactly when the
observation channel is weak or unread. The model can move its own document
into the target region — "I've created the panel," "the check is updated" —
while the referent never moves. A review of hand-picked Analyst traces (not a
random sample, so what follows describes what fails, not how often it fails)
found this false-completion pattern to be the single most common failure, and
— the sharpest part — roughly two-thirds of the failing cases carried no
error message at all: nothing crashed, so nothing looked wrong. A
prompt-engineering reading has no account of this; it can flag an answer as
unhelpful, but not as confidently and silently false. The steering-operator
reading predicts both the failure and its silence.

**Boundary / counterexample.** The lens predicts this failure recedes when
every claimed state change is observed and verified before being narrated —
comparing what the agent claimed against what actually changed, and what the
user said next, rather than grading the narration alone. A related boundary
case: asked to do something the available tools cannot do at all (for
example, renaming an object with no rename operation), the agent sometimes
claims success anyway — a failure to represent the edge of the region, rather
than a failure to reach it.

### 5.2 Compiler-error repair and Self-Debug

**Pattern.** Generate code, run it, feed the failure — a stack trace, a
failing test, a type error — back into context, and regenerate.
**Steering move.** The execution result is an external-feedback operator: it
repositions the trajectory from the neighborhood of "plausible code" toward
"code the runtime accepts"; the error text is a coordinate correction
supplied from outside the document [@chen2023]. **Literature support.** The
external-vs-intrinsic split is established: intrinsic self-correction,
without any external signal, does not reliably help [@huang2023; @kamoi2024].
**Predicted failure mode.** Absent a genuine external signal — the model
merely reviewing its own output and declaring it fixed — the move is
intrinsic self-correction, and the lens predicts no reliable improvement,
possibly regression, because nothing outside the document actually
constrained the next move. **Boundary / counterexample.** Strongest when the
verifier is sound and cheap (a compiler, a unit test); weakest when the
"error" is itself a model-generated critique with no ground truth. The
`developer:red-green-refactor` cycle operationalizes exactly this prediction:
it refuses to accept a fix that is not driven by a failing test, i.e. it
never lets intrinsic correction substitute for the referent's verdict.

### 5.3 Chain-of-thought and pause tokens

**Pattern.** Spend intermediate tokens — explicit reasoning, or even
content-free filler — before committing to an answer. **Steering move.** A
serial-computation-depth budget: not a change in the trajectory's
destination, but in how many sequential steps it is allowed before
committing. **Literature support.** Chain-of-thought lets transformers solve
problems that are inherently serial, which they cannot solve in a bounded
number of steps without it [@li2024]; expressivity scales with the number of
CoT steps [@merrill2023]; even meaning-free filler tokens add usable hidden
computation [@pfau2024]. The caveat to carry: "thinking widens the search" or
"curves the path" is this paper's analogy; the literature's defensible claim
is serial depth, not geometric curvature. **Predicted failure mode.** On
tasks that are not bottlenecked by serial computation — simple recall,
single-step lookup — extra thinking tokens buy little while adding cost and
latency; the lens predicts a flat return, distinguishing "more thinking" from
the folk claim that more prompting is simply better. **Boundary /
counterexample.** The filler-token result [@pfau2024] is the sharp case
against a purely semantic reading: depth, not content, is doing the work.
`developer:thinking` fires only on a red signal — a compiler error, a failing
test, a bad lint — spending serial computation exactly where a serial
obstacle has been detected, not everywhere.

### 5.4 HyDE, HyPE, and retrieval expansion

**Pattern.** Rather than searching with the literal query, generate a
stand-in — a hypothetical answer document (HyDE), or a set of paraphrased
queries (HyPE) — and search around that instead. **Steering move.**
Manufacture an intermediate point in document space to relocate the search
neighborhood before drawing on real evidence. HyDE and HyPE expand opposite
sides of the same move: HyDE expands the **target basin**, generating a
plausible answer and retrieving real documents near it [@gao2023hyde]; HyPE
expands the **source rim**, generating plausible variants of the question
itself and matching those against precomputed, document-side prompts
[@vake2025hype]. Both manufacture a stand-in; they differ only in which side
of the query-answer gap receives it. **Literature support.** The recall
improvement from a denser query neighborhood is established method behavior
in both papers; "manufacturing a point in document space" is this paper's
analogy. **Predicted failure mode.** When the target neighborhood is
genuinely empty — no real document answers the question — the manufactured
stand-in has nothing to snap to, and the model answers from its own
fabrication. This is not hypothetical: production traces of the Analyst agent
show it making things up after a failed search, especially for how-to
documentation, exactly when retrieval comes back empty-handed. The lens
predicts retrieval expansion *amplifies* hallucination precisely at empty
neighborhoods, rather than uniformly improving answers. **Boundary /
counterexample.** The move helps when the corpus is dense near the true
answer but the literal query is lexically distant, and hurts when the system
has no explicit "found nothing" guard. HyPE's query-side expansion has a
structural advantage here: an empty match against precomputed questions is a
legible "nothing exists" signal, rather than a temptation to fabricate one.

### 5.5 Subagent review and multi-sample search

**Pattern.** Sample multiple candidates, or spawn multiple subagents, then
select, vote, or review. **Steering move.** Branch exploration plus selection
pressure: launch several trajectories from related start points, then
collapse to the best one. **Literature support.** Sampling and voting over
multiple chain-of-thought completions (self-consistency) reliably improves
accuracy [@wang2023selfconsistency]; genuinely distinct-role variants extend
the same move — multiple personas debating toward consensus
[@du2023debate], or layered agents refining each other's output before a
final aggregation step [@wang2024moa]. The sampling result is established;
that the branches "cover distinct regions of document space" is this paper's
analogy. **Predicted failure mode.** When the branches are N samples from one
shared prompt, the diversity is illusory — they explore one neighborhood
under one conditioning, and selection has nothing meaningfully different to
choose between. The lens predicts multi-sample gains shrink toward zero as
shared prompt/context bias dominates, regardless of how large N grows.
**Boundary / counterexample.** Gains reappear when branches have genuinely
distinct start points — different model bindings, providers, or roles, as in
a matrix fan-out with a per-arm rollup for selection — because only then does
a "branch" explore a different part of the space rather than resampling the
same one. A panel of judges that all share one system prompt is selection
theater, not diversity.

### 5.6 LATS and tree-search agents

**Pattern.** Expand a search tree of candidate action sequences with
backtracking and value estimates, rather than committing to one trajectory.
**Steering move.** Explicit search over trajectory space, with a frontier and
a value/selection function — the generalization of multi-sample search to a
tree with lookahead and backtrack. **Literature support.** LATS unifies
reasoning, acting, and planning into exactly this tree-search procedure
[@zhou2024lats]; the search mechanics are established, and "regions of the
document manifold" remains this paper's analogy. **Predicted failure mode.**
Cost grows with breadth times depth, and the entire payoff rides on a
trustworthy value signal; without a cheap, sound verifier, the search
optimizes a proxy, and the lens predicts an expensive result that is no
better — or confidently wrong at a high-value-estimate dead end. **Boundary /
counterexample.** The move pays off only when artifacts are cheaply and
soundly verifiable and genuine breadth is needed. A concrete instance is
bidirectional forward-backward search — working backward from a passing test
and forward from the current state, with the frontier externalized to disk
so steps cannot silently drift — which stays cheap precisely because it
keeps the candidate set small and the verifier, a test suite, sound.

### 5.7 Capstone: the developer loop as one worked trajectory

If a single example must exercise every operator at once, the
research-design-plan-build-cleanup development loop referenced throughout
this section is it: research repositions the start point; design fixes the
target region as a failing feature test; planning sequences the moves, with
forward-backward search when the path is not obvious; build applies
external-feedback correction test by test; and draft gates act as scheduled
external-feedback checkpoints between phases. It is one of the few agent
workflows where every steering operator and every region constraint is
written to disk and inspectable afterward — including, in a small irony, this
paper itself, which was developed through exactly this loop.

## 6. Topology of the Space

TODO. The LLM "learns" the topology; tokens follow the terrain.

## 7. Claim Ledger

Every load-bearing claim, tagged and cited. Tags: **established** / **contested** /
**author's-analogy**. (This table is the automated half of the Closing Bell's judge
target; see `evals/`.)

| # | Claim | Tag | Citation(s) |
|---|-------|-----|-------------|
| 1 | Deep representations occupy far fewer effective dimensions than width; human text sits at a stable ID ≈ 7–9 | established | [valeriani2023], [tulchinskii2023] |
| 2 | Raw token embeddings violate the manifold hypothesis / are anisotropic; the picture holds for contextual hidden states | established (caveat) | [brown2023] |
| 3 | Many programs implement one function (many-to-one denotation); "simplest" exists but is uncomputable | established | TODO (Milner; Kolmogorov) |
| 4 | A bug is the correct implementation of a neighboring function (non-equivalent mutant) | established | TODO (Schulte 2014) |
| 5 | Syntactic neighborhood ≈ function-space neighborhood on a continuous metric | author's-analogy | — |
| 6 | Autoregressive decoding is a Markov chain with a stationary distribution | established | [zekri2024] |
| 7 | A "basin of attraction toward a correct vs incorrect region" for a single forward pass | author's-analogy (gap) | — |
| 8 | CoT/thinking adds serial computational depth (TC⁰ without it; circuit-size-T with T steps); filler tokens enlarge expressivity | established | [li2024], [merrill2023], [pfau2024] |
| 9 | External execution feedback improves self-correction; intrinsic self-correction without it does not | contested/established split | [chen2023], [huang2023], [kamoi2024] |
| 10 | The manifold/categorical/phase-space vocabulary is already published (novelty bounded) | established | [bradley2021], [bradley2025], [coecke2010] |

## 8. Caveats and Scope

TODO. Consolidate: contextual-states-not-token-embeddings; union-of-manifolds;
external-vs-intrinsic feedback; the missing correct/incorrect-basin theorem; the
deferred endofunctor formalism and loss-landscape↔manifold bridge.

## References

Rendered by pandoc `--citeproc` from `refs.bib` with `ieee.csl`. See `refs.bib`.
