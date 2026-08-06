---
title: "Position: Agentic LLM Workflows as Trajectory-Steering on Manifolds in Document Spaces"
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

Agentic language-model systems do more than ask a model for a better continuation.
They retrieve documents, execute code, preserve intermediate reasoning, branch into several candidates, and use observations or value estimates to decide what happens next.
This paper proposes one lens for comparing those mechanisms.
Generation traces a sequence of document prefixes, and an agentic harness applies operators that redirect, extend, branch, or select among those trajectories.

The lens joins three existing ideas.
Language-model decoding is a stochastic process over prefixes.
Contextual representations can have local low-dimensional structure.
Code generation can be treated as search over program texts constrained by behavior.
None establishes a single smooth manifold of documents.
Together, however, they motivate a cautious model of task-local document regions and trajectories through them.

This is a synthesis and position paper, not a new geometric formalism.
Its contribution is a workflow-level vocabulary for asking what move a harness makes, what signal guides that move, and what external referent—if any—checks the resulting document.
Section 2 reviews the three strands of prior art.
Section 3 states the document-prefix model.
Section 4 describes the steering operators.
Section 5 applies the lens to results from recent agentic and inference-time harness research.
Section 6 gives competing interpretations and limitations, and Section 7 concludes with a compact diagnostic.

## 2. Prior Art

Three lines of work support different parts of the proposed lens: formal spaces of text, representation geometry, and computation or search over generated sequences.
Their results constrain the analogy rather than proving it.

### Texts, probabilities, and trajectories

DisCoCat composes grammatical structure with distributional word meanings through functorial maps [@coecke2010].
Bradley, Terilla, and Vlassopoulos construct a `[0,1]`-enriched category whose objects are linguistic expressions and whose graded arrows describe relations among texts [@bradley2021].
Their later work uses a language model's next-token probabilities to enrich a category of prefixes and continuations [@bradley2025].
These accounts provide formal structures over texts, but they do not analyze multi-step agent workflows.

Zekri and coauthors model autoregressive generation as a Markov chain over text states [@zekri2024].
That supplies a direct basis for calling the sequence of generated prefixes a trajectory.
It does not establish a smooth dynamical system or basins of attraction.

### Representation geometry

Information geometry gives “manifold” a precise meaning for parametric statistical models equipped with the Fisher information metric [@amari1998].
This paper does not claim such a metric for documents.
Evidence about transformer representations is narrower.
Valeriani and coauthors find low intrinsic dimension in particular regimes of contextual hidden states [@valeriani2023].
Tulchinskii and coauthors use intrinsic dimension in contextual token representations to distinguish human from generated text [@tulchinskii2023].
Robinson, Dey, and Chiang find that static token embeddings do not satisfy the manifold hypothesis [@robinson2025].
The relevant object, if manifold-like language is useful at all, is therefore a task-specific contextual representation rather than the token-embedding table.

Brown and coauthors find that image data are better described by disconnected pieces of varying intrinsic dimension than by one smooth global manifold [@brown2023].
Their evidence concerns images, not text.
It is useful here only as a warning against promoting local structure into a universal document manifold.

### Serial computation and program space

Transformer expressivity provides a computational account of trajectory length.
Chain-of-thought tokens allow additional serial computation on problems that fixed-depth computation cannot solve directly [@li2024].
Expressivity increases with the number of intermediate steps [@merrill2023].
This supports treating intermediate tokens as computational steps, not as evidence of geometric curvature.

Program synthesis already treats code generation as search through a discrete space of programs constrained by examples, grammars, or specifications [@gulwani2017].
Milner's full-abstraction result equates denotational equality with contextual equivalence for the typed calculus and semantic model he studies [@milner1977].
It motivates a many-to-one relation between source forms and behavior, but does not establish that relation for arbitrary modern programs.
Schulte and coauthors find that many mutations preserve behavior under the available tests [@schulte2014].
This is evidence of test-suite-relative neutral neighborhoods, not proof of semantic equivalence or a continuous program metric.

## 3. The Document-Prefix Model

Let a document be a finite token sequence.
A prompt, answer, program, retrieved passage, tool result, or transcript is a document in this broad sense.
For a fixed language model, a prefix `d_t` determines a next-token distribution `P(x | d_t)` and contextual hidden states.
Sampling or selecting `x_t` forms `d_{t+1} = d_t x_t`; the finite sequence `d_0, d_1, ..., d_T` is the generation trajectory.

This trajectory is discrete.
“Document space” names the prefixes and task-specific representations or relations used to compare them.
Two documents might be near because one is a probable continuation of the other or because their contextual summaries are close under a chosen embedding distance.
They might instead be near because their source texts differ by a small edit or their observable behavior is equivalent.
These notions are not interchangeable, and the model assumes no global distance shared by all of them.

A task defines an acceptable set of documents.
For code, it may be the programs that satisfy a specification or pass a test suite.
For prose, it may be the documents that are faithful to sources and satisfy the requested form.
Tests, compilers, retrieval results, application state, and human review are imperfect observations of membership in that set.

An agentic harness changes the trajectory by adding context, spending more generation steps, branching, selecting, or incorporating an observation.
Calling these changes steering operators is an analogy at the workflow level.
It does not imply that all documents occupy one manifold, that local regions are basins of attraction, or that a named geometric metric exists.

## 4. Steering Operators

An operator is characterized here by its **move**, its **signal**, and its **referent check**.
The move changes the generation process.
The signal guides that change.
The referent check tests the generated document against something outside the model's narration.

**Table 1.**
**Steering operators and their evidence channels.**

| Operator | Move | Signal | Referent check |
| --- | --- | --- | --- |
| Prompting | Conditions the initial trajectory | Prompt tokens and examples | None within the generation |
| Additional reasoning tokens | Extends serial computation before an answer | Intermediate generated states | None unless another operator supplies one |
| Execution feedback | Appends an outside verdict and regenerates | Compiler, test, runtime, or API output | Direct, within the coverage of the tool |
| Retrieval expansion | Generates a stand-in query or document before retrieval | Retrieved corpus matches | Indirect; retrieval can return irrelevant or no evidence |
| Multi-sample branching | Samples several trajectories and selects or aggregates | Votes, comparisons, or an aggregator | Depends on the selector; branches may share biases |
| ReAct-style interaction | Alternates reasoning, actions, and observations | Observation after each action | Direct when the observation exposes the relevant state |
| Tree-search agents | Retain and revisit branches under a search policy | Value estimates, reflections, and environment feedback | Depends on the evaluator and environment |

### Conditioning and additional computation

Prompting changes the initial conditional distribution.
An account of in-context learning as implicit Bayesian inference describes the prompt as evidence for a latent task concept [@xie2021].
The spatial phrase “choose a start region” is this paper's interpretation.
Prompting provides no new observation after generation begins, so it cannot by itself resolve a fact absent from the context.

Chain-of-thought and pause tokens extend the trajectory before the final answer.
Results on serial problems and transformer expressivity support the additional-computation account [@li2024; @merrill2023].
Even content-free filler tokens can provide useful hidden computation [@pfau2024].
These results do not show that longer reasoning is universally useful.
They predict gains when serial depth is the bottleneck, not when the missing ingredient is evidence or an external state observation.

### External observations and retrieval

Execution feedback appends a verdict from outside the generated document.
A compiler error or failing test changes the next conditional distribution and can be applied repeatedly.
The check is still partial: passing tests establish only what those tests cover, and malformed tool output can misdirect the next step.

Retrieval expansion moves before the external evidence arrives.
HyDE generates a hypothetical answer and retrieves real documents near its embedding [@gao2023hyde].
HyPE generates hypothetical questions associated with documents and retrieves through those question representations [@vake2025hype].
In the trajectory lens, both manufacture intermediate documents that redirect retrieval.
The corpus result, not the manufactured text, is the evidence.
An empty or irrelevant retrieval result leaves the referent unresolved.

### Branching, interaction, and search

Multi-sample methods retain several candidate trajectories and then vote, compare, or synthesize.
Shared conditioning does not make the branches identical.
Self-consistency improves reasoning accuracy by sampling diverse reasoning paths from the same prompt and selecting the most consistent answer [@wang2023selfconsistency].
Different roles, models, or contexts may add other kinds of diversity [@du2023debate; @wang2024moa], but diversity is useful only insofar as the selection rule correlates with correctness.

ReAct interleaves reasoning traces, actions, and observations [@yao2023react].
Its distinctive feature is repeated coupling between the document and an environment.
An observation can correct the model's account of the world, but only if the tool exposes the relevant state and the next step uses what it returned.

Language Agent Tree Search combines language-model planning and acting with tree search, value estimates, and self-reflection [@zhou2024lats].
Unlike independent sampling, it preserves a frontier and can revisit earlier decisions.
The trajectory lens anticipates a benefit when intermediate states can be evaluated well enough to allocate search.
It also exposes the dependency: a weak value estimate can steer the tree toward fluent but incorrect branches, while broad search increases inference and environment-interaction cost.

## 5. Applying the Lens to Agentic Harnesses

The value of the lens is whether it can separate mechanisms before their results are known.
The cases below reconstruct that comparison retrospectively by pairing an anticipation from the operator description with a reported result.
They show how a prospective test could be stated, but they are not new experiments or evidence that the predictions were recorded in advance.

### Execution feedback versus intrinsic self-correction

**Anticipation.**
A correction loop should be more reliable when it appends an external verdict than when it asks the model to judge the same document from its existing context.
The verdict changes the available evidence; intrinsic critique may only resample the original uncertainty.

**Reported result.**
Self-debugging work reports improvements from execution results and code explanations in code repair [@chen2023].
By contrast, Huang and coauthors find that language models struggle to self-correct reasoning without external feedback [@huang2023].
Kamoi and coauthors' survey identifies external feedback as a central condition separating successful from unreliable self-correction [@kamoi2024].

**What remains untested.**
These studies do not establish that every external signal is sound or that trajectory language explains the gain better than a standard feedback-loop account.
The lens further anticipates that misleading tests or tool outputs will steer confidently in the wrong direction; the cited results do not test that claim generally.

### Serial computation through intermediate tokens

**Anticipation.**
Additional reasoning or pause tokens should help when a task requires more sequential computation than a fixed-depth pass provides.
They should not repair missing evidence merely by making the trajectory longer.

**Reported result.**
Chain-of-thought increases transformer power on inherently serial problems [@li2024], and formal analyses relate additional intermediate steps to increased expressivity [@merrill2023].
Pfau and coauthors show that filler tokens can support hidden computation even when the tokens carry little semantic content [@pfau2024].

**What remains untested.**
These results do not identify a universal stopping rule or measure movement in a document geometry.
Nor do they show that more tokens help tasks whose limiting factor is retrieval or environment access.

### Retrieval expansion

**Anticipation.**
A generated stand-in can bridge lexical distance between a query and relevant evidence.
It should help when the corpus contains useful material that the original query represents poorly, while offering no guarantee when the corpus lacks the answer.

**Reported result.**
HyDE reports improved zero-shot dense retrieval by embedding a generated hypothetical document before retrieving real documents [@gao2023hyde].
HyPE reports gains from indexing hypothetical questions associated with documents [@vake2025hype].
Both results fit the prediction that an intermediate generated document can redirect the retrieval trajectory.

**What remains untested.**
Neither result makes the stand-in evidence in its own right or proves that retrieval expansion handles an empty corpus safely.
Neither measures the document-space interpretation proposed here.

### Shared-prompt branching and selection

**Anticipation.**
Branching can improve an answer even from a shared prompt when stochastic samples follow meaningfully different reasoning paths and the selector extracts a correctness signal.
Different prompts or models are one way to increase diversity, not a prerequisite for all gains.

**Reported result.**
Self-consistency samples multiple chain-of-thought paths from the same prompt and reports substantial accuracy improvements from answer aggregation [@wang2023selfconsistency].
Multiagent debate and mixture-of-agents report further gains from interaction among roles or models [@du2023debate; @wang2024moa].
These findings rule out the stronger claim that shared conditioning implies near-zero marginal value.

**What remains untested.**
The cited studies do not supply a general measure of trajectory diversity or isolate when shared biases defeat aggregation.
The lens anticipates failure when branches make correlated errors and the selector has no independent signal, but that boundary requires direct measurement.

### Tool interaction and tree search

**Anticipation.**
Repeated action and observation should help when each observation exposes task-relevant state.
Tree search should add value when intermediate states can be scored well enough to retain promising branches and revisit poor decisions.

**Reported result.**
ReAct reports gains from interleaving reasoning with environment actions and observations [@yao2023react].
LATS reports that combining tree search, acting, value estimates, and reflection improves performance on the environments it evaluates [@zhou2024lats].

**What remains untested.**
These results do not establish that every tool-interactive harness reads observations correctly or that value estimates remain calibrated outside the evaluated tasks.
Nor do they establish that the added search cost is worthwhile under arbitrary budgets.
The lens anticipates false completion when narration is not checked against environment state, but no prevalence claim is made here.

## 6. Alternative Views and Limitations

The trajectory lens complements simpler and more formal accounts.
Program synthesis describes code generation as search over discrete programs and specifications.
Markov decision processes and control theory describe an agent as a policy choosing actions from states and observations.
Standard retrieval, inference-time compute, and search terminology already describes each operator's mechanics.
Those accounts may be preferable when their formal variables are available.

The present vocabulary instead keeps attention on the evolving document and on the evidence appended to it.
That perspective makes different harnesses comparable, but it can also flatten important differences.
A prompt, a compiler, and a learned value function are not three instances of the same causal mechanism merely because each redirects generation.

The geometric language is deliberately limited.
No global document metric, smooth manifold, curvature, or basin of attraction is established.
Contextual-representation results do not automatically transfer to whole documents or workflows.
The applications in Section 5 are retrospective readings of published results rather than prospective tests of the lens.
A stronger empirical contribution would state operator-level predictions in advance and measure the relevant signals and branch diversity.
It would compare the trajectory account with control, search, and compute-matched baselines.

## 7. Conclusion

Treating an agentic workflow as trajectory steering does not replace the mechanics of prompting, retrieval, execution, sampling, or search.
It supplies a common diagnostic for them.
For any harness, ask three questions: What move changes the document trajectory?
What signal guides that move?
What external referent, if any, checks the result?

The answers distinguish additional computation from additional evidence, branching from selection, and narrated success from observed state.
They also expose the lens's limits.
Where no representation, evaluator, or referent can be named, geometric language adds little.
Where those elements can be named, the lens offers a compact way to anticipate which part of a harness should help, which failure it cannot detect, and which claim still needs an experiment.

## 8. References

The works cited in the text are listed below.
