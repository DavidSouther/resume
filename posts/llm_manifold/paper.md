---
title: "Position: Agentic LLM Workflows as Trajectory-Steering on a Document Manifold"
author: David Souther
date: 2026
abstract: >
  Agentic LLM workflows — prompting, retrieval, execution feedback, thinking
  tokens, subagent branching, and tree search — can be read as if they were
  operators steering a document through a region of syntactic space toward a
  target region of acceptable artifacts. This is a synthesis and position
  paper, not a new formalism: the manifold, categorical, and phase-space
  vocabulary it uses is already published, and its contribution is a
  workflow-level diagnostic lens, not a new theorem or metric. That lens
  generalizes six worked agentic-pattern analyses, led by a measured
  false-completion failure in a production tool-using agent, into seven
  falsifiable conditions for when a steering operator should help, fail, or
  become too expensive. The paper closes with a claim ledger tagging every
  load-bearing claim as established, contested, author-analogy, or deferred,
  and a two-part readiness gate — automated structural checks plus a human
  Lit Group transfer test — as the standard for whether the lens is more
  than a rebranding of known techniques.
bibliography: refs.bib
csl: ieee.csl
---

<!--
GENERATED FILE -- do not edit directly.
Source sections live in sections/*.md; edit those, then re-run
evals/scripts/compose_paper.py to regenerate this file.
-->

## 1. Introduction

This paper's thesis fits in one sentence: an agentic LLM workflow can be
read **as if** it were a sequence of operators steering a document through a
region of syntactic space toward a target region of acceptable artifacts for
a given task. Prompting fixes a start point; a retrieved document or a
compiler's error message pulls the trajectory toward or away from that
target; a subagent fan-out explores several regions at once; a tree search
does the same with backtracking. Read this way, prompt changes, retrieval,
retries, execution feedback, thinking tokens, subagents, and tree search
stop looking like an unrelated grab-bag of tricks and become comparable
moves, each with a different signal, a different cost, and a different way
to fail.

This is a **synthesis and position paper**, not a new formalism. It borrows
its geometric vocabulary — manifold, trajectory, region, basin — from
published prior art (Section 2), and none of that vocabulary is introduced
here for the first time. What this paper contributes is the
**workflow-level reading**: a lens that turns a list of known agentic
techniques into a single diagnostic vocabulary with seven falsifiable
conditions for when each technique should help, fail, or become too
expensive (Section 6), grounded in six worked examples (Section 5) and a
reusable operator table (Section 4).

**What this paper is not claiming.** It is not a new theorem, a new
categorical formalism, or a claim that treating LLMs as manifolds is itself
novel — Section 2 draws that boundary against the closest prior art
explicitly. It does not claim a metric on document space, a proven
basin-of-attraction structure for a single forward pass, or that "document
space" is one smooth surface rather than a union of task-local regions
(Section 3's caveats). Two extensions the author has explored elsewhere are
deliberately out of scope here: an endofunctor fixed-point formalism for
iterated generation [@souther2024], and an empirical bridge between the
loss-landscape geometry of training and the document-space geometry of
generation. Both would require engaging the closest prior art (Section 2)
far more formally than a position paper's evidence standard supports, and
are left as future work.

**Roadmap.** Section 2 states what is already formalized and draws the
novelty boundary. Section 3 introduces only the geometry the rest of the
paper needs. Sections 4 and 5 are the paper's load-bearing contribution: the
operator table and six worked analyses. Section 6 generalizes those
analyses into seven falsifiable predictive conditions, and Section 7
compares this reading against the alternative frames a reviewer would
reasonably reach for. Section 8 is this paper's evaluation: a claim ledger
and a two-part readiness gate. Section 9 closes with a reusable checklist
for reading an agent workflow through this lens.

## 2. Prior Art and Novelty Boundaries

Before stating this paper's picture, name the risk directly: nearly every
piece of the manifold, categorical, and phase-space vocabulary used below is
already published, in several places, often under close to the exact word.
This section states what is already formalized, draws the boundary against
the closest prior art specifically, and names the one place this paper adds
anything at all.

### The closest prior art: Bradley, Terilla, and Vlassopoulos

Bradley, Terilla, and Vlassopoulos construct a `[0,1]`-enriched category of
texts [@bradley2021]: documents are objects, and a morphism between two
documents is valued in the unit interval rather than being a plain arrow —
text compatibility is a categorical structure, not merely a metric one. Their
2025 follow-up enriches the same category with a trained language model's own
next-token probabilities [@bradley2025], directly connecting an LM's output
distribution to that categorical structure. Concretely, this is a *formal
document-space category equipped with an LM-native probabilistic distance* —
the single closest published construction to this paper's "document space,"
and it already carries more mathematical weight, an actual enriched-category
structure rather than an analogy, than anything introduced here.

**Where this paper's reading stops overlapping.** Bradley et al.'s enriched
category is a static, structural object: it establishes that texts and
probabilities form a well-defined categorical space. It does not ask, and
does not answer, how a specific agentic workflow's sequence of operations —
a retry, a retrieved document, a subagent's branch — moves through that space
over the course of a task, or which of those operations are reliable levers
under which conditions. This paper's claim sits entirely at that second,
workflow-diagnostic level: it borrows the informal *picture* of a document
space, not their categorical apparatus, and asks what happens to a
trajectory through it under specific, named agentic operators. If Bradley et
al.'s enriched category is the space, this paper offers a lens for reading
motion inside it — nothing about the space itself is new here.

### The rest of the field this paper does not reinvent

DisCoCat already treats language compositionally as a functorial,
categorical structure connecting grammar to meaning [@coecke2010]; "language
as a functor" is decades-settled vocabulary, not new here. Information
geometry is the rigorous, decades-old theory of a statistical manifold — a
Riemannian (Fisher) metric on a family of probability distributions
[@amari1998]; any "phase space of a model" language risks silently
reinventing this, and this paper adds nothing to it and claims no metric on
anything it discusses. The Union of Manifolds Hypothesis shows that real
high-dimensional data — verified for images, and the caution this paper
carries forward for documents — sits on a *disconnected* set of
varying-dimension pieces, not one smooth surface [@brown2023]; this paper's
document-space picture is a union, never a single manifold, precisely
because of this result. Transformer formal-language theory gives the
rigorous capability frame for what a fixed-depth or chain-of-thought-
augmented transformer can compute [@strobl2024; @li2024; @merrill2023];
Section 5.3's serial-depth claim is drawn from here, not from a geometric
restatement. Program synthesis already defines "search over program space
toward a specification" as the field's own founding frame [@gulwani2017];
Section 3 imports this directly rather than treating it as new.

### What this paper adds

**Table 2. Already formalized vs. what this paper adds.**

| Territory | Already formalized by | What this paper adds |
| --- | --- | --- |
| A categorical, probabilistic space of texts | Bradley, Terilla, and Vlassopoulos [@bradley2021; @bradley2025] | Nothing to the space itself; reads agentic operators as moves within it |
| Language as a compositional functor | DisCoCat [@coecke2010] | Nothing; acknowledged, not used |
| A statistical manifold with a rigorous metric | Information geometry [@amari1998] | Nothing; this paper's geometry is never metric |
| Real data as a union of varying-dimension manifolds | Union of Manifolds Hypothesis [@brown2023] | Adopted as a caveat, not introduced as a novel claim |
| Transformer expressivity and serial-computation limits | Formal-language and CoT-expressivity results [@strobl2024; @li2024; @merrill2023] | Read as a steering operator's mechanism (Section 5.3), not new theory |
| Search over program space toward a specification | Program synthesis [@gulwani2017] | Section 3's document-space model borrows this frame directly |
| A workflow-level diagnostic reading of agentic operators as moves toward or away from a target region | No existing paper unifies these strands this way | **This paper's contribution** (Sections 4-6) |

This paper's only new claim is the bottom row of Table 2.

## 3. The Document-Space Model

This section introduces only the geometry Sections 4-6 actually need:
functions, programs, documents, and generation as a trajectory. The hard
caveats are stated here, up front, so nothing later can be read as claiming
more than this.

### Functions, programs, and documents

Treat the set of computable functions as the object of ultimate interest,
and a program as one syntactic realization of a function. Denotational
semantics assigns each program text a denotation — the function it computes
— and Milner's full-abstraction result is precisely the statement that two
programs denote the same function exactly when no context can distinguish
their behavior [@milner1977]: many programs implement one function, and the
map from programs to functions is many-to-one by construction, not by
analogy. This gives the paper's second load-bearing reframing: a bug is not
merely wrong code, it is the correct implementation of a neighboring,
unintended function. That is not a metaphor either — it is exactly what a
non-equivalent mutant is in mutation testing, and a neutral-landscape result
shows empirically that a large fraction of random program mutations are
functionally neutral, meaning neighboring programs genuinely cluster by the
function they compute [@schulte2014].

**Caveat to carry.** The step from "programs cluster by function under
mutation" to "there is a continuous metric on program space whose geometry
tracks function identity" is this paper's own analogy, not an established
result: mutation testing measures neighborhoods under discrete edits, not a
continuous space, and denotational semantics gives a topology on
*denotations*, not on program *syntax*.

### Documents and generation as trajectory

A large language model is trained to place high probability on token
continuations that keep a document within the shape of naturally occurring
text — the same low-effective-dimension structure long observed in learned
representations generally, and specifically confirmed for contextual
language-model hidden states, whose intrinsic dimensionality sits far below
the raw embedding width [@valeriani2023; @tulchinskii2023]. Generation, in
this picture, is a trajectory: starting from a prompt, each new token is a
step that a well-trained model keeps inside the neighborhood of documents
that look like the training distribution.

**Caveats to carry, verbatim, through the rest of the paper.**

1. *Contextual hidden states, not raw token embeddings.* The
   low-dimensional structure above is a property of contextual hidden
   states produced while processing a document, not of the static
   token-embedding matrix. Raw token embeddings have been shown to violate
   the manifold hypothesis outright under a direct statistical test
   [@robinson2025]; the document-space picture in this paper is only ever a
   claim about contextual states.
2. *A union of manifolds, not one smooth surface.* Real high-dimensional
   data — established for images, and the caution this paper extends to
   documents — sits on a disconnected collection of pieces of varying
   dimension, not a single smooth manifold [@brown2023]. Wherever this
   paper says "document space," read it as shorthand for a union of
   task-local, varying-dimension pieces, never a single global surface.
3. *"Basin of attraction" is this paper's analogy, not a theorem.* Later
   sections describe a workflow "moving toward a correct region" or
   "falling into an incorrect basin." No published result establishes a
   basin-of-attraction structure for a single autoregressive forward pass;
   the closest formal anchor is that autoregressive decoding is a Markov
   chain with a stationary distribution [@zekri2024], which says nothing
   about the shape of that distribution's support. The basin language is
   scaffolding for intuition, not a claim this paper can cite.

These three caveats are the load-bearing boundary of everything from Section
4 onward: every operator in Table 1 acts on a trajectory through
contextual-state space, understood as a union of task-local regions, moving
toward or away from a region this paper never claims is a literal geometric
basin.

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

## 6. What This Lens Predicts

A framing that cannot fail is not doing any work. This section states seven
conditions under which a steering operator should help, fail, or become too
expensive to justify. Each condition names a way its operator can *reverse*
from helpful to useless or harmful — a claim a flat "more prompting helps"
account has no separate way to make — and each is already exercised by one of
the worked analyses in Section 5.

**Target observability.** Re-coupling the trajectory to a referent only works
if that referent is actually observable: a compiler verdict, a passing test,
a visible panel. Where the target is unobservable, or only partly surfaced —
a "created" claim against a tool that silently no-ops — the lens predicts
decoupling. Section 5.1's false-completion case is this condition failing in
production.

**Feedback reliability.** The signal returned has to be trustworthy, not
merely present. An external, verifiable signal (a runtime, a test suite) is a
different thing from a model's own noisy self-critique. Where the "verifier"
is itself model-generated with no ground truth, the lens predicts the move
degrades to intrinsic self-correction and the improvement shrinks or
reverses — Section 5.2's compiler-repair case, read against the
external-vs-intrinsic split.

**Search breadth.** Sampling, subagent, and tree-search operators help only
when there are genuinely many distinct viable paths to explore. Where the
branches share a start point and conditioning, breadth is illusory — Section
5.5's shared-prompt-bias collapse.

**Artifact inspectability.** Manufacturing a stand-in point helps only when
that stand-in exposes something checkable — a real, retrievable document
nearby — rather than being consumed as its own answer. Where the target
neighborhood is genuinely empty, the lens predicts the stand-in gets treated
as fact instead of scaffolding — Section 5.4's fabrication-on-empty-search
finding.

**Serial dependency.** Chain-of-thought and pause-token operators help only
when the task is actually bottlenecked by sequential computation, not by
breadth or observability. On a task that is not serially bottlenecked, the
lens predicts a flat return on extra thinking tokens — Section 5.3.

**Cost.** Search-based operators trade compute for a chance at a better
trajectory. The lens predicts this trade only pays off when the verifier
guiding the search is both cheap and sound; when it is expensive, unsound, or
merely a proxy, added breadth is a pure loss rather than a diminishing
return — Section 5.6's tree-search cost-explosion case.

**Collapse onto shared prompt/context bias.** Branching operators whose
branches share a start point do not expand the region actually explored. The
lens predicts near-zero marginal return from adding more samples under one
shared conditioning, and a return to genuine gains only when branches have
distinct start points — different bindings, providers, or roles — restoring
the search-breadth condition above rather than merely restating it.

Read together, these seven conditions are what separates a lens with
predictive leverage from a rebranding of already-known techniques: each names
an axis along which the same operator, examined more closely, should help in
one regime and hurt in another. A prompt-engineering account of any single
worked analysis in Section 5 can describe that one trace; it has no way to
state, in advance, the condition under which the same technique would have
failed instead.

## 7. Alternative Views and Limitations

The steering-operator reading is one lens among several standing accounts of
the same phenomena, offered as a complementary diagnostic vocabulary rather
than a replacement for any of them.

**Program synthesis.** Agent workflows that generate and repair code are
already studied as search over program space, with a many-to-one map from
programs to the functions they implement (Section 3 borrows exactly this
framing). Program synthesis gives a mature account of *what* is being
searched; the steering-operator lens adds an account of *how* an agentic
workflow's specific moves — prompting, retrieval, execution feedback —
reposition that search over time. The two are compatible descriptions at
different grain sizes, not competitors.

**MDP / control.** An agent workflow can equally be modeled as a policy
choosing actions to maximize an objective, with tool calls as actions and
observations as state transitions — and for ReAct and LATS in particular, the
underlying mechanics genuinely are search and control procedures. The
steering-operator lens is a representation-space complement to that account:
it describes what happens to the *document* the policy produces, not a
replacement for the control-theoretic description of the policy itself.

**Information geometry / statistical manifold.** The mathematical apparatus
for treating a model's internal representations as a manifold, with a
rigorous metric or curvature structure, already exists and is more precise
than anything this paper introduces. This paper borrows the vocabulary, not
the formalism, and defers any metric or curvature claim to that literature —
the caveat carried throughout Section 3.

**Category theory.** Bradley, Terilla, and Vlassopoulos's `[0,1]`-enriched
category of texts already formalizes a compositional, probability-weighted
structure over language, and is the closest prior art to this paper's
picture (Section 2). This paper does not extend that formalism; its claim
sits at the workflow-diagnostic level, which that formalism does not itself
address.

**"Just prompt engineering."** Section 6 is this paper's answer. If steering
operators were merely a rebranding of prompting, none of that section's seven
conditions would be falsifiable, because there would be nothing for a
condition to reverse against. Each names a way an operator flips from helpful
to useless or harmful, which a flat "more prompting helps" account cannot
state.

**Limitations and submission fit.** This is a synthesis/position paper, not
a paper reporting a new theorem, dataset, or benchmark result of its own;
main-track NeurIPS/ICML/ICLR fit is correspondingly weaker, and a position
track, workshop, TMLR/JAIR-style venue, or arXiv-first circulation is a
better match unless a later project adds a genuine empirical or theoretical
result. The mathematical vocabulary here is organizing language, not proof:
every geometric or categorical term not grounded in a cited theorem is
marked as author analogy in the claim ledger (Section 8). The Section 5.1
case, this paper's sharpest evidence, comes from hand-picked traces rather
than a random sample; the lens's usefulness beyond that one case still has to
survive a Lit Group transfer test on a workflow it has not seen (Section 8).
And not every agentic improvement is "steering" in the same sense — Table 1's
own prompting row never touches a referent at all — so treating every
operator as one mechanism risks flattening real differences the alternative
views above take more seriously.

## 8. Evaluation and Claim Ledger

Every load-bearing claim in this paper is tagged and cited below, using the
schema `Claim | Status | Support | Does not support | Paper section | Risk if
wrong`. `Status` is one of `established`, `contested`, `author-analogy`, or
`deferred`. `Does not support` states the boundary where each citation
stops; `Risk if wrong` states what part of the argument weakens if the claim
does not hold. This ledger is a quality-control mechanism, not a
bibliography: a row with an empty `Does not support` or `Risk if wrong` cell
is a citation-drift risk, not a finished row.

**Table 3. Claim ledger.**

| Claim | Status | Support | Does not support | Section | Risk if wrong |
| --- | --- | --- | --- | --- | --- |
| Agentic workflows can be read as sequences of steering operators moving a document trajectory toward a target region, with a systematic account of when each operator helps, fails, or gets too expensive | author-analogy | The six worked analyses (§5) and the seven reversal conditions they generalize into (§6) | No theorem or formal model proves this reading is the correct or unique description of agentic behavior; it is a diagnostic lens, not a result | 4, 5, 6 | If the seven conditions don't transfer beyond §5's six examples, the thesis reduces to relabeling known techniques (§7's "just prompt engineering" objection) |
| Prompting and soft prompts function as conditioning that locates a generation task, fixing where a trajectory starts | established (conditioning); author-analogy (spatial framing) | [@xie2021] models in-context learning as inference over a latent concept implied by the prompt | [@xie2021] does not describe or require a document-space geometry; "start point" is this paper's spatial gloss on an inference-over-latent-concept account | 4 | Weakens Table 1's prompting row to an unsupported restatement rather than a grounded conditioning claim |
| External execution feedback improves correction; intrinsic self-correction without such a signal does not reliably help | established/contested split | [@chen2023] (external signal helps); [@huang2023; @kamoi2024] (intrinsic self-correction alone does not reliably help) | These results don't establish that every external signal is trustworthy; a noisy or malformed tool output is not guaranteed to help either | 5.2, 6 | Collapses the external/intrinsic distinction this paper leans on to separate genuine steering from unproductive self-review |
| Chain-of-thought and pause tokens add serial computation depth; "widening" or "curving" the search path is this paper's spatial analogy | established (serial depth); author-analogy (spatial language) | [@li2024; @merrill2023; @pfau2024] | None of these results characterize CoT geometrically; the depth-vs-curvature distinction is this paper's, not theirs | 5.3, 6 | Misattributes a spatial metaphor to a purely computational-depth result |
| Retrieval expansion (HyDE, HyPE) manufactures an intermediate document or query neighborhood; the recall improvement is established, the document-space framing is analogy | established (method); author-analogy (geometry) | [@gao2023hyde; @vake2025hype] | Neither paper claims or measures a document-space neighborhood; both describe embedding-space retrieval mechanics | 5.4 | The empty-neighborhood failure prediction (§6, artifact inspectability) loses its mechanistic grounding |
| Subagents, multi-sample search, and tree search implement branch exploration plus selection pressure; the sampling/search mechanics are established, "document-space regions" is analogy | established (mechanics); author-analogy (regions) | [@wang2023selfconsistency; @du2023debate; @wang2024moa; @zhou2024lats; @yao2023react] | None of these papers frame their branches as covering regions of a document space; that reading, and the shared-bias-collapse prediction built on it, is this paper's | 5.1, 5.5, 5.6, 6 | Weakens the search-breadth and collapse-onto-shared-bias predictions (§6) to unsupported restatements of known sampling behavior |
| Contextual hidden states may carry low-dimensional structure; raw token embeddings are not the manifold this paper describes, and have been shown to violate the manifold hypothesis outright | established caveat | [@valeriani2023; @tulchinskii2023] (contextual-state structure); [@robinson2025] (token embeddings violate the manifold hypothesis) | [@valeriani2023; @tulchinskii2023] establish low intrinsic dimension, not a single global manifold; see the next row | 3 | Collapsing this distinction lets the paper's document-space language be read as a claim about the disproven token-embedding manifold |
| Real high-dimensional data forms a disconnected union of varying-dimension manifolds, not one smooth surface; this paper's "document space" is always such a union | established/scoping | [@brown2023] (verified for image data) | [@brown2023] does not study text or document representations directly; extending it to documents is this paper's scoping choice, made for caution absent a text-specific replication | 3 | Without this caveat, "document space" reads as one global surface, the exact overclaim §2-3 are structured to avoid |
| Describing a workflow as moving toward a correct "basin" or away from an incorrect one, for single-pass generation, is this paper's analogy, not a theorem | author-analogy (deferred) | [@zekri2024] establishes only that autoregressive decoding is a Markov chain with a stationary distribution | [@zekri2024] says nothing about the shape of that distribution's support; no published result establishes a basin-of-attraction structure for one forward pass | 3, 6 | This paper's single largest overclaim risk if basin language is ever read as more than scaffolding for intuition |
| Bradley, Terilla, and Vlassopoulos's enriched category of texts, and DisCoCat's functorial treatment of language, already formalize the categorical vocabulary this paper's language echoes | established | [@bradley2021; @bradley2025; @coecke2010] | Neither engages the workflow-level, multi-step diagnostic reading in Sections 4-6; that gap is exactly the boundary §2 draws | 2 | If this boundary is wrong — if Bradley et al. already covers the workflow reading — this paper's novelty claim collapses entirely |
| Recent 2026 manifold- and anisotropy-geometry preprints are speculative, single-group related work, not core support for this paper's claims | contested | [@mabrok2026] models representations as a Riemannian manifold with a Fisher-metric structure; [@bernas2026] extends anisotropy arguments to learning dynamics; cited only as evidence this framing is an active, contemporaneous direction | Neither has been independently replicated at the time of writing, and neither supports any load-bearing claim in Sections 2-6; a separate, since-withdrawn 2026 preprint in the same space was deliberately excluded | 2 | None to the paper's core argument — no claim depends on them, so removing them would not weaken any other row |

### Readiness gate

This paper's Closing Bell has two halves. The automated half is the
executable readiness gate in `evals/`: the three script checks
(`check_sections.py`, `check_citations.py`, `check_pandoc.py`) plus a judge
assertion over this ledger requiring every load-bearing row to carry a
non-empty, specific `Does not support` and `Risk if wrong` cell (see
`manifold.yaml`). The human half is a Lit Group review: a small group of
engineers or CS-masters-level readers reads the finished paper, situates it
against prior art, audits this ledger, and completes a scored transfer test
on one held-out agentic workflow not covered in Section 5 — recording the
five-field rubric (start point, target region, signal added, predicted
failure mode, evidence) before seeing this paper's own analysis. The full
transfer-test protocol lives in `design.md`'s User Journey and Metrics
section. Passing both halves is a precondition for circulation, not a
substitute for the argument itself.

## 9. Conclusion

The steering-operator lens earns its place only if it changes what a reader
does with the next agent workflow they read, design, or debug. This paper's
one reusable artifact for that purpose is a five-question checklist,
distilled from the operator table (Section 4), the six worked analyses
(Section 5), and the seven predictive conditions (Section 6):

1. **Start point.** What does this operation take as its starting document,
   and what conditioning fixed that start?
2. **Target region.** What region of acceptable documents is this operation
   trying to reach, and against what referent — a compiler, a test, a
   retrieved fact, a visible panel — is "reached" actually checked?
3. **Signal added.** What new signal does this move add to the trajectory:
   a prompt, a retrieved neighborhood, external execution feedback, serial
   computation, a branch-and-select step, or a search-and-backtrack step?
4. **Failure mode addressed.** Which of Section 6's seven conditions —
   observability, feedback reliability, search breadth, inspectability,
   serial dependency, cost, or shared-bias collapse — does this move
   actually address, and under what condition should it reverse from
   helping to hurting?
5. **Evidence.** What evidence — cited literature, a production trace, or a
   worked example — supports that this specific move works for this
   specific failure mode, and what is that evidence's own boundary? A
   hand-picked trace is not a base rate; an established result about
   sampling is not automatically a claim about document-space regions.

A workflow that cannot answer these five questions is not wrong, but it is
unexamined: the lens has not yet been applied to it. Applying it is this
paper's claim to usefulness, and Section 8's Lit Group transfer test is
exactly this checklist, run on a workflow the reader has not seen before,
scored against whether the reader's own answers anticipate the failure mode
this paper's analysis would find.

## 10. References

Rendered by pandoc `--citeproc` from `refs.bib` with `ieee.csl`. See `refs.bib`.
