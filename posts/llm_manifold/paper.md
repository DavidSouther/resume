---
title: "Position: Agentic LLM Workflows as Trajectory-Steering on a Document Manifold"
author: David Souther
date: 2026
abstract: >
  Agentic LLM workflows can be understood as operators steering a document through syntactic space toward a target region of acceptable artifacts.
  <Write the rest _after_ the paper is complete.>
bibliography: refs.bib
csl: ieee.csl
---

<!--
GENERATED FILE -- do not edit directly.
Source sections live in sections/*.md; edit those, then re-run
evals/scripts/compose_paper.py to regenerate this file.
-->

## 1. Introduction

Agentic LLM workflows can be understood as operators steering a document through syntactic space toward a target region of acceptable artifacts.
Prompting fixes a start point.
Large language models generate tokens to move along a manifold defined by the learned structrure from its training set.
A retrieved document, compiler error, or tool observation changes the next move.
A subagent fan-out explores several nearby starts.
Tree search keeps several partial trajectories alive and backtracks when a value signal says one is worse.
Read as if generation were moving through a document region, these are not an unrelated grab-bag of agent tricks.
They are comparable steering operators with different impulses, signals, referent-validation paths, costs, and failure modes.

This is therefore a **synthesis and position paper**, not a new formalism.
It borrows geometric vocabulary — manifold, trajectory, region, basin — from published prior art (Section 2), and none of that vocabulary is introduced here for the first time.
The contribution is the **workflow-level reading**: a diagnostic vocabulary that turns familiar agentic techniques into steering operators with seven falsifiable conditions for when each technique should help, fail, or become too expensive (Section 6), grounded in seven worked analyses (Section 5) and a reusable operator table (Section 4).

**What this paper is not claiming.**
It is not a new theorem, a new categorical formalism, or a claim that treating LLMs as manifolds is itself novel — Section 2 draws that boundary against the closest prior art explicitly.
It does not claim a metric on document space, a proven basin-of-attraction structure for a single forward pass, or that "document space" is one smooth surface rather than a union of task-local regions (Section 3's caveats).
Two extensions the author has explored elsewhere are deliberately out of scope here: an endofunctor fixed-point formalism for iterated generation [@souther2024], and an empirical bridge between the loss-landscape geometry of training and the document-space geometry of generation.
Both would require engaging the closest prior art (Section 2) far more formally than a position paper's evidence standard supports, and are left as future work.

**Roadmap.**
Section 2 keeps the literature review in front, because novelty honesty is what lets the operator analogy survive.
Section 3 introduces only the geometry the rest of the paper needs.
Sections 4 and 5 are the paper's load-bearing contribution: the operator table and seven worked analyses.
Section 6 generalizes those analyses into seven falsifiable predictive conditions, and Section 7 compares this reading against the alternative frames a reviewer would reasonably reach for.
Section 8 is this paper's evaluation: a claim ledger and a two-part readiness gate.
Section 9 closes with a reusable checklist for reading an agent workflow through this lens.

## 2. Prior Art

The document-space model builds on categorical semantics of language, geometric accounts of statistical and representation spaces, and program-space accounts of generated code.
Mathematical literature supplies a vocabulary of manifolds, trajectories, probability distributions, and equivalence classes.
This section summarizes the results needed before the model is stated.

### Categorical and probabilistic models of language

The DisCoCat framework from [@coecke2010] structures grammar and distributional meaning via categorical connections.
Pregroup grammar reductions supply the syntactic structure of a sentence, word meanings live in vector spaces, and the sentence meaning is obtained by applying corresponding linear maps.
The key result is that compositional language semantics can be made functorial: grammatical composition is not merely a metaphor for vector composition, but a formal map from syntax to distributional semantics.

Bradley, Terilla, and Vlassopoulos give the closest categorical account of a space of texts [@bradley2021].
They construct a category enriched over `[0,1]`, with linguistic expressions as objects and unit-interval values encoding how one expression extends or relates to another.
Using enriched-category machinery, including teh Yoneda embedding, moves moves from syntactic relations among expressions toward semantic representations.
The key result is a formal text category whose arrows are graded rather than Boolean: compatibility among texts is represented as structure in the category.

Their later work connects that category directly to language-model probabilities [@bradley2025].
Instead of using a generic graded relation, the enrichment is supplied by the next-token probabilities of a trained language model, and the paper studies the magnitude of the resulting category of texts.
The key result is that a language model's own predictive distribution can be used to enrich a category of text prefixes and continuations.
This is a probabilistic, model-native document space.

### Manifolds, representation geometry, and text generation

Amari's information geometry gives the rigorous version of a statistical manifold in machine learning [@amari1998].
A parametric statistical model is treated as a manifold equipped with the Fisher information metric, and the natural gradient follows that geometry rather than the Euclidean geometry of raw parameters.
The key result is not a claim about text, but a warning about vocabulary: "manifold" and "metric" have precise meanings in statistical learning, and a document-space model should not imply a Fisher metric or a Riemannian structure unless it supplies one.

Brown and coauthors test the union-of-manifolds hypothesis for image data [@brown2023].
Their result supports a more fragmented picture than the simple manifold hypothesis: real high-dimensional data are better modeled as a disconnected union of pieces with varying intrinsic dimension than as one smooth global manifold.
The key consequence here is cautionary.
If documents have manifold-like structure at all, the safer model is a union of local regions, not one continuous surface of all possible text.

Valeriani and coauthors study hidden representations in large transformer models [@valeriani2023].
They estimate intrinsic dimension across layers and find structured, low-effective-dimensional behavior in transformer hidden states, with semantic information concentrated in particular low-dimensional regimes.
Tulchinskii and coauthors apply intrinsic-dimension estimation to contextual language representations for human and AI-generated text [@tulchinskii2023].
They treat a text as a point cloud of contextual token representations and find that intrinsic dimension is informative enough to help distinguish human text from generated text.
Together, these papers support a limited claim: contextual representations of text can exhibit low-dimensional structure inside a much larger ambient vector space.

Robinson, Dey, and Chiang give the counterweight to that claim [@robinson2025].
They test raw token embeddings against the manifold hypothesis and find that the static token-embedding matrix is not well modeled as a manifold or even as a fiber bundle.
The key boundary is therefore sharp: any document-space model grounded in manifold-like structure must refer to contextual hidden states or document-level representations, not to raw token embeddings.

Zekri and coauthors model large language models as Markov chains [@zekri2024].
Autoregressive decoding moves from one text state to the next by sampling a token from the model's conditional distribution.
The key result is that generation can be formalized as a stochastic process over text states, with a stationary-distribution analysis available at that level.
That result supports the use of "trajectory" for the sequence of generated prefixes, but it does not establish basins of attraction or a smooth dynamical system over documents.

### Transformer computation and program space

Strobl, Merrill, Weiss, Chiang, and Angluin survey the formal-language expressive power of transformers [@strobl2024].
Their survey places transformer architectures in precise computational classes and distinguishes what fixed-depth attention can and cannot express.
Li, Liu, Zhou, and Ma show that chain-of-thought tokens let transformers solve inherently serial problems that bounded-depth computation cannot solve directly [@li2024].
Merrill and Sabharwal characterize how intermediate chain-of-thought steps increase transformer expressivity as the number of generated steps grows [@merrill2023].
The shared key result is computational rather than geometric: extra generated tokens can add serial computation, but these papers do not describe that computation as movement on a manifold.

Gulwani, Polozov, and Singh define program synthesis as the task of finding a program in an underlying language that satisfies a user's intent or specification [@gulwani2017].
For generated code, the key result is that "search over program space" is the standard frame of a mature field, not a new metaphor.
Program synthesis treats the space as a discrete search space of programs, usually organized by grammar, constraints, examples, and specifications.

Milner's full-abstraction result gives the semantic basis for many programs implementing one behavior [@milner1977].
In a fully abstract model, denotational equality coincides with observational equivalence: two program phrases have the same denotation when no program context can distinguish them.
Program texts map many-to-one onto semantic behavior.
A function is represented by an equivalence class of programs, not by a single canonical source string.

Schulte, Fry, Fast, Weimer, and Forrest study software mutational robustness [@schulte2014].
They find that many random program mutations are neutral with respect to the tested behavior, producing a neutral landscape of nearby program variants.
The key result is empirical support for local clustering in program space: syntactically nearby programs often preserve behavior, while non-neutral mutations move to different behavior.
This supports treating buggy code as a nearby program that implements a different function or specification, while still stopping short of proving a continuous metric on program syntax.

<!-- ### Boundary carried into the model

The literature above already supplies formal text categories, statistical manifolds, contextual representation geometry, Markov-chain generation, program-space search, and semantic equivalence classes of programs.
The model in the next section uses those results as constraints.
It treats documents as discrete token sequences with contextual representations; it treats generation as a stochastic trajectory through prefixes; it treats code documents as program texts mapped many-to-one onto functions; and it treats "near," "region," and "manifold" as local modeling terms unless a concrete metric is named. -->

## 3. The Document-Space Model

Let a document be a finite token sequence over a model's tokenizer.
A prompt, an answer, a program, an error message, a retrieved passage, and a transcript are all documents in this sense.
For a fixed language model, each document prefix has two associated objects: the next-token distribution `P(token | prefix)` and the contextual hidden states produced while processing that prefix.
The document-space model concerns those prefixes, distributions, and contextual states.
It does not identify document space with the static token-embedding matrix.

### Documents, prefixes, and trajectories

Generation is a sequence of prefixes.
Starting from an initial document `d_0`, the model samples or selects a token `x_t` from `P(x | d_t)` and forms `d_{t+1} = d_t x_t`.
The finite sequence

```text
d_0, d_1, d_2, ..., d_T
```

is the generation trajectory.
This is a discrete trajectory through token-prefix states, not a continuous path through a proven smooth manifold.
The Markov-chain account of autoregressive language models supplies the formal stochastic-process basis for this view [@zekri2024].

<!-- Figure design alternatives live in posts/llm_manifold/figures/document_trajectory_alternatives.typ. The candidates show a trajectory through local continuation-likelihood contours, a valley/plain/ridge terrain profile, a discrete prefix-state flow, and disconnected task-local regions. -->

A neighborhood in document space can be induced in several ways, and the choice matters.
Two documents may be close because one is a high-probability continuation of the other under the model; because their contextual hidden-state summaries are near under a chosen embedding distance; because their program texts are close under edits or mutations; or because their denotations are observationally equivalent.
There is no single global distance that all of these notions share, but they are generally complementary descriptions of the notion of nearness.

### Programs as documents with denotations

Code is a special case of document generation.
A program document is both a token sequence and, when it is well formed, a syntactic realization of a denotation.
Write

```text
[[p]] = f
```

for the function or behavior denoted by program text `p`.
Many program texts can denote the same function, as full abstraction and observational equivalence make precise [@milner1977].
Program synthesis searches this space for a program satisfying a specification [@gulwani2017].
Mutation-testing and mutational-robustness results show that small syntactic changes often leave behavior unchanged, while other small changes produce a different behavior [@schulte2014].

This gives a direct model of a code-generation target.
For a specification `S`, the acceptable region is

```text
R_S = { p | p satisfies S }
```

or, when the specification denotes a target behavior `f_S`,

```text
R_S = { p | [[p]] is observationally equivalent to f_S }
```

In practice, tests, compilers, type checkers, linters, benchmarks, and human review approximate membership in `R_S`.
A bug is a program document outside that acceptable region.
More specifically, it is often a nearby program document that denotes a similar but subtly different behavior from the one intended.

### Contextual document regions

For non-code text, a target region is not usually a denotational equivalence class.
It is a set of documents satisfying task constraints: a faithful summary, a valid proof sketch, a correctly cited literature review, a user-acceptable email, or a transcript state that accurately reports what happened.
The region is defined by the task and its referents, not by fluency alone.

Contextual hidden states supply the representation-space side of this model.
The evidence from transformer representation geometry and intrinsic-dimension estimation supports local low-dimensional structure in contextual states [@valeriani2023; @tulchinskii2023].
That evidence does not imply that all documents lie on one smooth surface.
It also does not apply to raw token embeddings, which have been shown not to satisfy the manifold hypothesis [@robinson2025].

Accordingly, "document space" means a collection of task-local regions over document prefixes and their contextual representations.
Those regions may be disconnected, may have different intrinsic dimensions, and may overlap only under a particular representation or task.
The union-of-manifolds result for image data is the guiding caution here: natural data should not be assumed to form one global manifold [@brown2023].

<!-- ### What the model claims

The model makes four limited claims.

1. A generated artifact can be represented as a trajectory of document prefixes.
2. A task defines an acceptable region of documents, sometimes by denotation
   and sometimes by external constraints.
3. Contextual representations of those documents can have local
   low-dimensional structure, but raw token embeddings are not the relevant
   object.
4. Any geometric word such as "near," "region," "manifold," or "basin" must be
   read relative to the concrete representation and distance being used.

The model does not claim a global metric on documents, a Riemannian manifold of texts, or a proven basin-of-attraction structure for autoregressive decoding.
It is a local model of generated documents, their contextual representations, and the task-defined regions those documents are meant to reach. -->

## 4. Steering Operators for Agentic Workflows

Each agentic pattern below is an operator acting on the **document trajectory**: the tokens the model actually writes on the way toward, or away from, an acceptable region.
What differs, pattern to pattern, is the operator's **impulse**, the **signal** it uses, and its **referent validation**: whether and how it checks the generated document against an external state that can judge the document's correctness.
Table 1 identifies seven operators using those three columns.

**Table 1.**

**Steering operators and their coupling to a referent.**

| Operator | Impulse | Signal | Referent validation |
| --- | --- | --- | --- |
| Prompting | Fixes the start point and framing before generation begins | The prompt's own conditioning tokens | None internally; user restarting prompt externally |
| Retrieval, HyDE, HyPE, "Jeopardy" expansion | Manufactures one or more intermediate points (a hypothetical answer, or a set of paraphrased queries) and searches around them | Generated stand-ins, embedded and used once, though potentially with subagents | Only implicitly, through whichever real documents happen to sit nearby; nothing confirms the neighborhood is non-empty |
| External tool / execution feedback | Re-derives the next move from an outside verdict — a stack trace, a failing test, an API response | The tool's returned output, fed back into context | Explicitly, and repeatably: each call is a fresh checkpoint against the referent |
| Thinking / chain-of-thought / pause tokens | Buys extra sequential computation before committing to an answer | Nothing external; the extra tokens are spent and discarded | Never — the operator lives entirely inside the document, with limited observation steps |
| Subagents / multi-sample branching | Launches several trajectories from related start points, then collapses to one via selection or voting | The comparison or voting step over the branches | Only as good as the branches' diversity; a shared prompt makes the comparison circular |
| ReAct-style tool interaction | Interleaves a reasoning move, a tool call, and an observation, repeatedly | The observation returned after each tool call | Explicitly, once per step — but only as reliable as whether that observation is actually read and acted on |
| LATS / tree-search agents | Expands a frontier of candidate trajectories with backtracking, guided by a value estimate | A value or selection function over partial trajectories | Only as sound as the value signal; a proxy value function makes the search confidently wrong |

Prompting and thinking act inside the document and have no internal referent validation.
Retrieval expansion creates stand-ins and probes a corpus, but a nearby document is only implicit validation.
External tools and ReAct-style interaction can validate against a referent repeatedly, provided the returned observation is trustworthy and read.
Tree search adds breadth and backtracking, but its validation is only as good as the value signal ranking partial trajectories.

## 5. Worked Analyses

### 5.1 ReAct and tool-interactive agents (the load-bearing case)

**Pattern.**
Codex, Cursor, Claude Code, and similar tool-interactive agents interleave reasoning, tool calls, and observations to complete user-directed coding tasks.

**Impulse.**
Each step combines a reasoning move with a tool call, then appends tool call result to extend the prefix [@yao2023react] before continuing token generation.

**Signal.**
The signal is the returned tool-call observation: what the repository, terminal, browser, or application says actually happened, not what the assistant previously narrated.

**Referent validation.**
When the observation channel is weak, incomplete, or unread, the document trajectory and referent trajectory can diverge.
The model can move its own document into the target region - "I've updated the file," "the test now passes" - while the referent never moves.
A review of hand-picked coding-agent traces (not a random sample, so what follows describes what fails, not how often it fails) found this false-completion pattern to be the single most common failure, and roughly two-thirds of the failing cases carried no error message at all: nothing crashed, so nothing looked wrong.
A prompt-engineering reading can call the answer unhelpful; it does not naturally explain why a no-error trace can be confidently and silently false.
The operator account does: the narration can satisfy the document-level form while the repository, command result, or application state remains outside the acceptable referent region.

**Boundary / counterexample.**
This failure recedes when every claimed state change is observed and verified before being narrated: compare what the agent claimed against what actually changed, and what the user said next, rather than grading the narration alone.
A related boundary case: asked to do something the available tools cannot do at all, such as renaming an object with no rename operation, the agent sometimes claims success anyway.
That is a failure to represent the edge of the acceptable region, not a failure to reach it.

### 5.2 Compiler-error repair and Self-Debug

**Pattern.**
Generate code, run it, feed the failure - a stack trace, a failing test, a type error - back into context, and regenerate.

**Impulse.**
The outside verdict re-derives the next move, shifting the trajectory from "plausible code" toward "code the runtime accepts" [@chen2023].

**Signal.**
The signal is the returned error text, test result, type checker output, or runtime behavior.

**Referent validation.**
The external-vs-intrinsic split is established: intrinsic self-correction, without any external signal, does not reliably help [@huang2023; @kamoi2024].
Without a genuine external signal, model review of model output is intrinsic self-correction.
Nothing outside the document constrains the next move, so reliable improvement should not be expected, and regression remains possible.

**Boundary / counterexample.**
The operator is strongest when the verifier is sound and cheap, such as a compiler or a unit test; it is weakest when the "error" is itself a model-generated critique with no ground truth.
A disciplined red-green-refactor cycle operationalizes this boundary by refusing to accept a fix that is not driven by a failing test.

### 5.3 Chain-of-thought and pause tokens

**Pattern.**
Spend intermediate tokens - explicit reasoning, or even content-free filler - before committing to an answer.

**Impulse.**
The operator buys extra sequential computation before the final answer is emitted.
It does not change the referent, and by itself it does not observe one.

**Signal.**
There is no external signal.
The additional tokens are spent inside the document trajectory and then discarded or hidden from the final answer.

**Referent validation.**
Chain-of-thought lets transformers solve problems that are inherently serial, which they cannot solve in a bounded number of steps without it [@li2024]; expressivity scales with the number of CoT steps [@merrill2023]; even meaning-free filler tokens add usable hidden computation [@pfau2024].
Spatial language such as "widening the search" or "curving the path" is only a gloss; the cited results support serial depth, not geometric curvature.
On tasks that are not bottlenecked by serial computation - simple recall, single-step lookup, or a missing external observation - extra thinking tokens buy little while adding cost and latency.

**Boundary / counterexample.**
The filler-token result [@pfau2024] is the sharp case against a purely semantic reading: depth, not content, is doing the work.
Extra thinking is best gated behind evidence of a serial obstacle, such as a failed proof step, a type error, or a test failure, rather than spent everywhere by default.

### 5.4 HyDE, HyPE, and retrieval expansion

**Pattern.**
Rather than searching with the literal query, generate one or more stand-ins - a hypothetical answer document (HyDE), or a set of paraphrased queries (HyPE) - and search around those stand-ins instead.

**Impulse.**
Retrieval expansion manufactures intermediate points in document space to relocate the search neighborhood before drawing on real evidence.
HyDE expands the answer side by generating a plausible answer and retrieving real documents near it [@gao2023hyde]; HyPE expands the query side by generating plausible variants of the question itself and matching those against precomputed, document-side prompts [@vake2025hype].
Both manufacture stand-ins; they differ in which side of the query-answer gap receives them.

**Signal.**
The signal is the generated stand-in embedded and used once, possibly with subagents producing multiple candidate stand-ins.

**Referent validation.**
The recall improvement from a denser query neighborhood is established method behavior in both papers; treating the stand-ins as points in document space is the analogical step.
When the target neighborhood is genuinely empty - no real document answers the question - the manufactured stand-in has nothing to snap to, and the model can answer from its own fabrication.
This is not hypothetical: coding agents can make things up after a failed search, especially for how-to documentation, exactly when retrieval comes back empty-handed.
Retrieval expansion can therefore amplify hallucination at empty neighborhoods rather than uniformly improving answers.

**Boundary / counterexample.**
The move helps when the corpus is dense near the true answer but the literal query is lexically distant, and hurts when the system has no explicit "found nothing" guard.
HyPE's query-side expansion has a structural advantage here: an empty match against precomputed questions is a legible "nothing exists" signal, rather than a temptation to fabricate one.

### 5.5 Subagent review and multi-sample search

**Pattern.**
Sample multiple candidates, or spawn multiple subagents, then select, vote, or review.

**Impulse.**
The operator launches several trajectories from related start points, then collapses to one via selection or voting.

**Signal.**
The signal is the comparison, vote, review, or aggregation step over the branches.

**Referent validation.**
Sampling and voting over multiple chain-of-thought completions (self-consistency) reliably improves accuracy [@wang2023selfconsistency]; genuinely distinct-role variants extend the same move - multiple personas debating toward consensus [@du2023debate], or layered agents refining each other's output before a final aggregation step [@wang2024moa].
The sampling result is established; saying that branches cover distinct regions of document space is the spatial gloss.
When the branches are N samples from one shared prompt, the diversity is illusory.
They explore one neighborhood under one conditioning, and selection has nothing meaningfully different to choose between.
Multi-sample gains shrink toward zero as shared prompt/context bias dominates, regardless of how large N grows.

**Boundary / counterexample.**
Gains reappear when branches have genuinely distinct start points - different model bindings, providers, or roles, as in a matrix fan-out with a per-arm rollup for selection - because only then does a branch explore a different part of the space rather than resampling the same one.
A panel of judges that all share one system prompt is selection theater, not diversity.

### 5.6 LATS and tree-search agents

**Pattern.**
Expand a search tree of candidate action sequences with backtracking and value estimates, rather than committing to one trajectory.

**Impulse.**
The operator keeps a frontier of partial trajectories alive, expands some candidates, backtracks from others, and selects according to a value estimate.

**Signal.**
The signal is the value or selection function over partial trajectories.

**Referent validation.**
LATS unifies reasoning, acting, and planning into exactly this tree-search procedure [@zhou2024lats].
The search mechanics are established; regions of a document manifold are the interpretive layer.
Cost grows with breadth times depth, and the payoff rides on a trustworthy value signal.
Without a cheap, sound verifier, the search optimizes a proxy, producing an expensive result that may be no better, or confidently wrong at a high-value-estimate dead end.

**Boundary / counterexample.**
The move pays off only when artifacts are cheaply and soundly verifiable and genuine breadth is needed.
A concrete instance is bidirectional forward-backward search: work backward from a passing test and forward from the current state, with the frontier externalized to disk so steps cannot silently drift.
It stays cheap precisely because it keeps the candidate set small and the verifier, a test suite, sound.

### 5.7 Prompting and soft prompts

**Pattern.**
Set a system instruction, user prompt, exemplar set, or learned soft prompt before generation begins.

**Impulse.**
Prompting fixes the start point and framing before generation begins.

**Signal.**
The signal is the prompt's own conditioning tokens.
In an in-context-learning account, the prompt helps identify the latent concept the model should infer from context [@xie2021].
A learned soft prompt is the same operator at a different interface: it changes conditioning before generation, but does not add a referent check after generation starts.

**Referent validation.**
There is no internal validation path.
If the result is wrong, the user can restart externally with a different prompt, but the completed generation has not checked itself against a referent.
Prompting cannot repair drift that requires new evidence after the start point has been fixed.
If the task depends on a compiler verdict, a live repository or application state, an absent document, or a later observation, more prompt text can only move the initial trajectory toward a different plausible region.
It cannot create a return path to the referent.

**Boundary / counterexample.**
Prompting is enough when the desired behavior is mostly a stable framing, style, format, or task concept already present in context.
It fails as a substitute for retrieval, execution feedback, or tool observation when the acceptable region is defined by facts outside the document.

## 6. What This Lens Predicts

A thesis that cannot fail is not doing any work.
This section states seven conditions under which a steering operator should help, fail, or become too expensive to justify.
Each condition names a way an operator can *reverse* from helpful to useless or harmful when its impulse, signal, or referent validation changes — a claim a flat "more prompting helps" account has no separate way to make — and each is already exercised by one of the worked analyses in Section 5.

**Target observability.**
Referent validation only works if that referent is actually observable: a compiler verdict, a passing test, a visible change.
Where the target is unobservable, or only partly surfaced — a "created" claim against a tool that silently no-ops — decoupling follows: the document can report a state no tool has exposed.
Section 5.1's false-completion case is this condition failing in production.

**Feedback reliability.**
The signal returned has to be trustworthy, not merely present.
An external, verifiable signal (a runtime, a test suite) is a different thing from a model's own noisy self-critique.
Where the "verifier" is itself model-generated with no ground truth, the move degrades to intrinsic self-correction and the improvement shrinks or reverses — Section 5.2's compiler-repair case, read against the external-vs-intrinsic split.

**Search breadth.**
Sampling, subagent, and tree-search operators help only when there are genuinely many distinct viable paths to explore.
Where the branches share a start point and conditioning, breadth is illusory — Section 5.5's shared-prompt-bias collapse.

**Artifact inspectability.**
Manufacturing stand-in points helps only when those stand-ins expose something checkable — real, retrievable documents nearby — rather than being consumed as their own answer.
Where the target neighborhood is genuinely empty, the stand-in gets treated as fact instead of scaffolding — Section 5.4's fabrication-on-empty-search finding.

**Serial dependency.**
Chain-of-thought and pause-token operators help only when the task is actually bottlenecked by sequential computation, not by breadth or observability.
On a task that is not serially bottlenecked, extra thinking tokens have a flat return — Section 5.3.

**Cost.**
Search-based operators trade compute for a chance at a better trajectory.
This trade only pays off when the referent validation guiding the search is both cheap and sound; when it is expensive, unsound, or merely a proxy, added breadth is a pure loss rather than a diminishing return — Section 5.6's tree-search cost-explosion case.

**Collapse onto shared prompt/context bias.**
Branching operators whose branches share a start point do not expand the region actually explored.
Adding more samples under one shared conditioning has near-zero marginal return; genuine gains return only when branches have distinct start points — different bindings, providers, or roles — restoring the search-breadth condition above rather than merely restating it.

Read together, these seven conditions are the paper's demonstration of the thesis.
If agentic workflows are steering operators, then changing the impulse, signal, referent validation, cost, or start-point diversity should change whether the operator works.
Each condition names an axis along which the same operator should help in one regime and hurt in another.
A prompt-engineering account of any single worked analysis in Section 5 can describe that one trace; it has no way to state, in advance, the condition under which the same technique would have failed instead.

## 7. Alternative Views and Limitations

The steering-operator reading is one lens among several standing accounts of
the same phenomena, offered as a complementary diagnostic vocabulary rather
than a replacement for any of them.

**Program synthesis.**
Agent workflows that generate and repair code are already studied as search over program space, with a many-to-one map from programs to the functions they implement (Section 3 borrows exactly this framing).
Program synthesis gives a mature account of *what* is being searched; the steering-operator lens adds an account of *how* an agentic workflow's specific impulses — prompting, retrieval, execution feedback — reposition that search over time.
The two are compatible descriptions at different grain sizes, not competitors.

**MDP / control.**
An agent workflow can equally be modeled as a policy choosing actions to maximize an objective, with tool calls as actions and observations as state transitions — and for ReAct and LATS in particular, the underlying mechanics genuinely are search and control procedures.
The steering-operator lens is a representation-space complement to that account: it describes what happens to the *document* the policy produces, not a replacement for the control-theoretic description of the policy itself.

**Information geometry / statistical manifold.**
The mathematical apparatus for treating a model's internal representations as a manifold, with a rigorous metric or curvature structure, already exists and is more precise than anything this paper introduces.
This paper borrows the vocabulary, not the formalism, and defers any metric or curvature claim to that literature — the caveat carried throughout Section 3.

**Category theory.**
Bradley, Terilla, and Vlassopoulos's `[0,1]`-enriched category of texts already formalizes a compositional, probability-weighted structure over language, and is the closest prior art to this paper's picture (Section 2).
This paper does not extend that formalism; its claim sits at the workflow-diagnostic level, which that formalism does not itself address.

**"Just prompt engineering."**
Section 6 is this paper's answer.
If steering operators were merely a rebranding of prompting, none of that section's seven conditions would be falsifiable, because there would be nothing for a condition to reverse against.
Each names a way an operator flips from helpful to useless or harmful, which a flat "more prompting helps" account cannot state.

**Limitations and submission fit.**
This is a synthesis/position paper, not a paper reporting a new theorem, dataset, or benchmark result of its own; main-track NeurIPS/ICML/ICLR fit is correspondingly weaker, and a position track, workshop, TMLR/JAIR-style venue, or arXiv-first circulation is a better match unless a later project adds a genuine empirical or theoretical result.
The mathematical vocabulary here is organizing language, not proof: every geometric or categorical term not grounded in a cited theorem is marked as author analogy in the claim ledger (Section 8).
The Section 5.1 case, this paper's sharpest evidence, comes from hand-picked traces rather than a random sample; the lens's usefulness beyond that one case still has to survive a Lit Group transfer test on a workflow it has not seen (Section 8).
And not every agentic improvement is "steering" in the same sense — Table 1's own prompting row has no internal referent validation, only an external user restart — so treating every operator as one mechanism risks flattening real differences the alternative views above take more seriously.

## 8. Evaluation and Claim Ledger

Every load-bearing claim in this paper is tagged and cited below, using the schema `Claim | Status | Support | Does not support | Paper section | Risk if wrong`.
`Status` is one of `established`, `contested`, `author-analogy`, or `deferred`.
`Does not support` states the boundary where each citation stops; `Risk if wrong` states what part of the argument weakens if the claim does not hold.
This ledger is a quality-control mechanism, not a bibliography: a row with an empty `Does not support` or `Risk if wrong` cell is a citation-drift risk, not a finished row.

**Table 3.**
**Claim ledger.**

| Claim | Status | Support | Does not support | Section | Risk if wrong |
| --- | --- | --- | --- | --- | --- |
| Agentic LLM workflows can be understood as operators steering a document through syntactic space toward a target region of acceptable artifacts; these steering operators can be compared by impulse, signal, referent validation, cost, and failure mode | author-analogy | The seven worked analyses (§5), the steering-operator table (§4), and the seven reversal conditions they generalize into (§6) | No theorem or formal model proves this reading is the correct or unique description of agentic behavior; it is a diagnostic lens, not a result | 4, 5, 6 | If the seven conditions don't transfer beyond §5's worked examples, the thesis reduces to relabeling known techniques (§7's "just prompt engineering" objection) |
| Prompting and soft prompts function as conditioning that locates a generation task, fixing where a trajectory starts without internal referent validation | established (conditioning); author-analogy (spatial framing) | [@xie2021] models in-context learning as inference over a latent concept implied by the prompt | [@xie2021] does not describe or require a document-space geometry; "start point" is this paper's spatial gloss on an inference-over-latent-concept account, and user restart is outside the generation itself | 4, 5.7 | Weakens Table 1's prompting row to an unsupported restatement rather than a grounded conditioning claim |
| External execution feedback improves correction; intrinsic self-correction without such a signal does not reliably help | established/contested split | [@chen2023] (external signal helps); [@huang2023; @kamoi2024] (intrinsic self-correction alone does not reliably help) | These results don't establish that every external signal is trustworthy; a noisy or malformed tool output is not guaranteed to help either | 5.2, 6 | Collapses the external/intrinsic distinction this paper leans on to separate genuine steering from unproductive self-review |
| Chain-of-thought and pause tokens add serial computation depth; "widening" or "curving" the search path is this paper's spatial analogy | established (serial depth); author-analogy (spatial language) | [@li2024; @merrill2023; @pfau2024] | None of these results characterize CoT geometrically; the depth-vs-curvature distinction is this paper's, not theirs | 5.3, 6 | Misattributes a spatial metaphor to a purely computational-depth result |
| Retrieval expansion (HyDE, HyPE) manufactures one or more intermediate document or query stand-ins; the recall improvement is established, the document-space framing is analogy | established (method); author-analogy (geometry) | [@gao2023hyde; @vake2025hype] | Neither paper claims or measures a document-space neighborhood; both describe embedding-space retrieval mechanics, and subagent-generated stand-ins add breadth without proving a referent exists | 5.4 | The empty-neighborhood failure condition (§6, artifact inspectability) loses its mechanistic grounding |
| Subagents, multi-sample search, and tree search implement branch exploration plus selection pressure; the sampling/search mechanics are established, "document-space regions" is analogy | established (mechanics); author-analogy (regions) | [@wang2023selfconsistency; @du2023debate; @wang2024moa; @zhou2024lats; @yao2023react] | None of these papers frame their branches as covering regions of a document space; that reading, and the shared-bias-collapse condition built on it, is this paper's | 5.1, 5.5, 5.6, 6 | Weakens the search-breadth and collapse-onto-shared-bias conditions (§6) to unsupported restatements of known sampling behavior |
| Contextual hidden states may carry low-dimensional structure; raw token embeddings are not the manifold this paper describes, and have been shown to violate the manifold hypothesis outright | established caveat | [@valeriani2023; @tulchinskii2023] (contextual-state structure); [@robinson2025] (token embeddings violate the manifold hypothesis) | [@valeriani2023; @tulchinskii2023] establish low intrinsic dimension, not a single global manifold; see the next row | 3 | Collapsing this distinction lets the paper's document-space language be read as a claim about the disproven token-embedding manifold |
| Real high-dimensional data forms a disconnected union of varying-dimension manifolds, not one smooth surface; this paper's "document space" is always such a union | established/scoping | [@brown2023] (verified for image data) | [@brown2023] does not study text or document representations directly; extending it to documents is this paper's scoping choice, made for caution absent a text-specific replication | 3 | Without this caveat, "document space" reads as one global surface, the exact overclaim §2-3 are structured to avoid |
| Describing a workflow as moving toward a correct "basin" or away from an incorrect one, for single-pass generation, is this paper's analogy, not a theorem | author-analogy (deferred) | [@zekri2024] establishes only that autoregressive decoding is a Markov chain with a stationary distribution | [@zekri2024] says nothing about the shape of that distribution's support; no published result establishes a basin-of-attraction structure for one forward pass | 3, 6 | This paper's single largest overclaim risk if basin language is ever read as more than scaffolding for intuition |
| Bradley, Terilla, and Vlassopoulos's enriched category of texts, and DisCoCat's functorial treatment of language, already formalize the categorical vocabulary this paper's language echoes | established | [@bradley2021; @bradley2025; @coecke2010] | Neither engages the workflow-level, multi-step diagnostic reading in Sections 4-6; that gap is exactly the boundary §2 draws | 2 | If this boundary is wrong — if Bradley et al. already covers the workflow reading — this paper's novelty claim collapses entirely |
| Recent 2026 manifold- and anisotropy-geometry preprints are speculative, single-group related work, not core support for this paper's claims | contested | [@mabrok2026] models representations as a Riemannian manifold with a Fisher-metric structure; [@bernas2026] extends anisotropy arguments to learning dynamics; cited only as evidence this framing is an active, contemporaneous direction | Neither has been independently replicated at the time of writing, and neither supports any load-bearing claim in Sections 2-6; a separate, since-withdrawn 2026 preprint in the same space was deliberately excluded | 2 | None to the paper's core argument — no claim depends on them, so removing them would not weaken any other row |

### Readiness gate

The readiness gate has two halves.
The automated half is the executable gate in `evals/`: the three script checks (`check_sections.py`, `check_citations.py`, `check_pandoc.py`) plus a judge assertion over this ledger requiring every load-bearing row to carry a non-empty, specific `Does not support` and `Risk if wrong` cell (see `manifold.yaml`).
The human half is a Lit Group review: a small group of engineers or CS-masters-level readers reads the finished paper, situates it against prior art, audits this ledger, and completes a scored transfer test on one held-out agentic workflow not covered in Section 5 — recording the five-field rubric (impulse, target region, signal, referent validation, evidence) before seeing this paper's own analysis.
The full transfer-test protocol lives in `design.md`'s User Journey and Metrics section.
Passing both halves is a precondition for circulation, not a substitute for the argument itself.

## 9. Conclusion

The steering-operator lens earns its place only if it changes what a reader does with the next agent workflow they read, design, or debug.
This paper's one reusable artifact for that purpose is a five-question checklist, distilled from the operator table (Section 4), the seven worked analyses (Section 5), and the seven reversal conditions (Section 6):

1. **Impulse.**
   What move does this operator make on the document trajectory: fix a start point, manufacture stand-ins, re-derive from execution feedback, spend serial computation, branch, interact with tools, or search a tree?
2. **Target region.**
   What region of acceptable documents is this operation trying to reach?
3. **Signal.**
   What signal does this move use: prompt conditioning, generated stand-ins, returned tool output, extra tokens, branch comparison, tool observations, or a value estimate?
4. **Referent validation.**
   What external state checks whether the trajectory reached the acceptable region — a compiler, a test, a retrieved fact, a visible change — and is that validation absent, implicit, repeated, or merely proxied?
5. **Evidence.**
   What evidence — cited literature, a production trace, or a worked example — supports that this specific impulse, signal, and validation path works, which Section 6 condition marks where it should reverse, and what is that evidence's own boundary?
   A hand-picked trace is not a base rate; an established result about sampling is not automatically a claim about document-space regions.

A workflow that cannot answer these five questions is not wrong, but it is unexamined: the lens has not yet been applied to it.
Applying it is this paper's claim to usefulness, and Section 8's Lit Group transfer test is exactly this checklist, run on a workflow the reader has not seen before, scored against whether the reader's own answers anticipate the failure mode this paper's analysis would find.

## 10. References

Rendered by pandoc `--citeproc` from `refs.bib` with `ieee.csl`.
See `refs.bib`.
