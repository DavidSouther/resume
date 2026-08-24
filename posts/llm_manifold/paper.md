---
title: "Position: Agentic LLM Workflows as Trajectory-Steering on Manifolds in Document Spaces"
author:
  - name: David Souther
    affiliation: Independent researcher, Brooklyn, New York, USA
    email: davidsouther@gmail.com
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

Agentic language-model systems do more than ask a model for a likely continuation.
They take actions to retrieve documents, execute code, preserve intermediate reasoning, branch across several candidates, and use observations or value estimates to decide what happens next.
Some of these actions happen using language model continuation for text generation; other actions use deterministic and long established text computation techniques.
The gestalt of these actions working in a single system delivers an "agentic system".
Agentic workflows improve outputs through three broad mechanisms: adding computation, adding external evidence, and generating or selecting among alternatives. These mechanisms fail differently. More computation can explore more of the document space, but it cannot supply a fact the context does not contain. Branching can create diversity, but it does not provide a principled choice among candidates. An observation can correct the trajectory, but only within what the observation actually measures.

This paper proposes the manifold as a framing device for comparing those mechanisms and the operators that implement them.

In this paper, we consider agent systems' actions in two categories, generation and operators.
Language model generation traces a sequence of document prefixes using stochastic continuation generators.
An agentic harness applies operators as computational techniques that redirect, extend, branch, or select among those trajectories.

The framing joins three existing ideas.
Language-model generation is a stochastic process over prefixes.
Contextual representations can have local low-dimensional structure.
Code generation can be treated as search over program texts constrained by behavior.
None of these establishes a single smooth manifold of documents.
Together, they motivate a useful mental model: a task has local regions of acceptable and unacceptable documents, and a workflow can steer a generation trajectory through those regions.

This is a synthesis and position paper for evaluating agentic systems. It keeps the geometric language deliberately at the level of a mental model rather than proposing a new geometric formalism: no global document metric, smooth manifold, or basin of attraction is assumed. Its contribution is a workflow-level vocabulary for asking how harness actions alter generation trajectories, what signals guide those actions, and what external evidence (if any) checks the resulting document.
Section 2 reviews the three strands of prior art.
Section 3 states the document-prefix model.
Section 4 describes the steering operators.
Section 5 considers those operators when evaluating agentic harness techniques.
Section 6 gives competing interpretations and limitations, and Section 7 concludes with a compact diagnostic.

## 2. Prior Art

Three lines of work support different parts of the proposed lens: formal spaces of text, representation geometry, and computation or search over generated sequences.
Their results constrain the analogy rather than proving it.

### Texts, probabilities, and trajectories

DisCoCat composes grammatical structure with distributional word meanings through functorial maps [@coecke2010].
Bradley, Terilla, and Vlassopoulos construct a `[0,1]`-enriched category whose objects are linguistic expressions and whose graded arrows describe relations among texts [@bradley2021].
Their later work uses a language model's next-token probabilities to enrich a category of prefixes and continuations [@bradley2025].
These accounts provide formal structures over texts, but they do not analyze multi-step agent workflows. They make “document space” a useful framing question without supplying the single space or distance used by this paper.

Zekri and coauthors model autoregressive generation as a Markov chain over text states [@zekri2024].
That supplies a direct basis for calling the sequence of generated prefixes a trajectory. It does not establish a smooth dynamical system or basins of attraction; here, trajectory names the evolving sequence of context that the harness can extend, branch, or redirect.

### Representation geometry

Information geometry gives “manifold” a precise meaning for parametric statistical models equipped with the Fisher information metric [@amari1998].
This paper does not claim such a metric for documents. “Manifold” is retained because the framing helps explain why steering operators feel different: they move generation through task-local regions without requiring those regions to form a mathematically defined global surface.
Evidence about transformer representations is narrower.
Valeriani and coauthors find low intrinsic dimension in particular regimes of contextual hidden states [@valeriani2023].
Tulchinskii and coauthors use intrinsic dimension in contextual token representations to distinguish human from generated text [@tulchinskii2023].
Robinson, Dey, and Chiang find that static token embeddings do not satisfy the manifold hypothesis [@robinson2025].
The relevant object, if manifold-like language is useful at all, is therefore a task-specific contextual representation rather than the token-embedding table.

Brown and coauthors find that image data are better described by disconnected pieces of varying intrinsic dimension than by one smooth global manifold [@brown2023].
Their evidence concerns images, not text.
It is useful here only as a conceptual bounding that trajectories over certain regions are likely to generate "similar" documents.

### Serial computation and program space

Transformer expressivity provides a computational account of trajectory length.
Chain-of-thought tokens allow additional serial computation on problems that fixed-depth computation cannot solve directly [@li2024].
Expressivity increases with the number of intermediate steps [@merrill2023].
This supports treating intermediate tokens as computational steps. In the framing used here, longer trajectories cover more of the available document space; they do not thereby acquire evidence from outside the trajectory.

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
“Document space” names the prefixes and task-specific representations or relations used to compare them. The manifold is a framing device for reasoning about local regions in that space, not a claim that the space has one smooth geometry.
Two documents might be near because one is a probable continuation of the other or because their contextual summaries are close under a chosen embedding distance.
They might instead be near because their source texts differ by a small edit or their observable behavior is equivalent.
These notions are not interchangeable, and the model assumes no global distance shared by all of them.

A task defines an acceptable set of documents.
For code, it may be the programs that satisfy a specification or pass a test suite.
For prose, it may be the documents that are faithful to sources and satisfy the requested form.
Tests, compilers, retrieval results, application state, and human review are imperfect observations of membership in that set.

An agentic harness changes the trajectory by adding context, spending more generation steps, branching, selecting, or incorporating an observation. Calling these changes steering operators preserves the useful mental structure of the manifold framing: each operator changes how the workflow moves through task-local document space, and each has a different source of guidance.
It remains an analogy at the workflow level. It does not imply that all documents occupy one manifold, that local regions are basins of attraction, or that a named geometric metric exists.

## 4. Steering Operators

An operator is characterized here by its **move**, its **signal**, and its **referent check**. These describe how a workflow moves through the task-local document space, not coordinates in a formal geometry.
The move changes the generation process by adding tokens to the generation trajectory.
The signal is the information available to the harness to direct tool calling or other processing to generate the move tokens.
The referent check tests the generated document against something outside the current trajectory.

**Table 1.**
**Steering operators and their evidence channels.**

| Operator | Move | Signal | Referent check |
| --- | --- | --- | --- |
| Prompting | Conditions the initial trajectory | Prompt tokens and examples | None within the generation, human or agent operator when used in a harness |
| Additional reasoning tokens | Extends length of the trajectory before generating a final "response" document | Intermediate generated states | None unless another operator supplies one |
| Execution feedback | Appends an outside verdict and regenerates | Compiler, test, runtime, or API output | Direct, within the coverage of the tool |
| Retrieval expansion | Generates a stand-in query or document before retrieval | Retrieved corpus matches | Indirect; retrieval can return irrelevant or no evidence |
| Multi-sample branching | Samples several trajectories and selects or aggregates | Votes, comparisons, or an aggregator | Depends on the selector; branches may share biases |
| ReAct-style interaction | Alternates reasoning, actions, and observations | Observation after each action | Direct when the observation exposes the relevant state |
| Tree-search agents | Retain and revisit branches under a search policy | Value estimates, reflections, and environment feedback | Depends on the evaluator and environment |

### Conditioning and additional computation

Prompting changes the initial conditional distribution.
An account of in-context learning as implicit Bayesian inference describes the prompt as evidence for a latent task concept [@xie2021].
The spatial phrase “choose a starting point” is a framing for the way a prompt selects an initial region of likely continuations.
Prompting provides no new observation after generation begins, so it cannot by itself resolve a fact absent from the context.

Chain-of-thought and pause tokens extend the trajectory before the final answer.
Results on serial problems and transformer expressivity support the additional-computation account [@li2024; @merrill2023].
Even content-free filler tokens can provide useful hidden computation [@pfau2024].
These results do not show that longer reasoning is universally useful. Longer trajectories cover more of the available document space and can help when serial depth is the bottleneck; they cannot supply evidence or an external state observation that is missing.

### External observations and retrieval

Execution feedback appends a verdict from outside the generated document.
A compiler error or failing test changes the next conditional distribution and can be applied repeatedly.
The check is still partial: passing tests establish only what those tests cover, and malformed tool output can misdirect the next step.

Retrieval expansion moves before the external evidence arrives.
HyDE generates a hypothetical answer and retrieves real documents near its embedding [@gao2023hyde].
HyPE generates hypothetical questions associated with documents and retrieves through those question representations [@vake2025hype].
Both methods manufacture intermediate documents that redirect retrieval through the task-local space.
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
Tree search should help when intermediate states can be evaluated well enough to allocate search.
It also exposes the dependency: a weak value estimate can steer the tree toward fluent but incorrect branches, while broad search increases inference and environment-interaction cost.

## 5. Evaluating a New Technique

The operators in Section 4 are not a closed taxonomy. They are a way to orient ourselves when a new technique arrives with a more specific name: a critique loop, a delegation scheme, a memory design, or a larger context window. The useful question is not whether the technique sounds agentic. It is what kind of movement it creates through task-local document space, and what can pull that movement toward an acceptable document.

Three distinctions organize the comparison.

First, a technique may add computation. More reasoning tokens extend the trajectory and allow the model to cover more of the available document space before committing to an answer. This can help when the task requires serial steps. It cannot provide a fact, a file, or an application state that never entered the context.

Second, a technique may add evidence. Retrieval, execution, and interaction append material from outside the current trajectory. This can move generation toward a region that internal continuation alone would not reach. The gain is bounded by the quality and coverage of the observation: a retrieval result can be irrelevant, a test suite can be incomplete, and a tool can expose the wrong state.

Third, a technique may add alternatives. Sampling, delegation, debate, and search can explore different paths through the space. Diversity is useful only when some selection rule can distinguish the better paths. A judge, vote, value estimate, or parent agent is still another generated process unless it is grounded in an external check.

These mechanisms compose. A workflow may generate several plans, execute each one, and ask a model to select among the results. In that case, the relevant question is not which operator appears strongest in isolation. It is whether the evidence survives each boundary. A generated summary can become the parent's entire view of a test result; a self-written memory can become the source for a later prompt; a judge can select a fluent answer that every branch got wrong. The composition inherits the weakest point at which its evidence can be lost or misread.

### Self-critique and revision

A self-critique pass adds a critique and a revision to the trajectory. If both are generated from the existing context, the pass adds computation but no new evidence. It can help the model notice an inconsistency, unpack a difficult chain of reasoning, or search more of the document space before answering. It should not be expected to recover a missing fact or reliably correct an error shared by the model and its rubric.

The classification changes when the critique receives an execution result, a retrieved passage, or another observation. The external material then supplies a new constraint on the next generation. This is why self-debugging methods that condition critique on execution results differ from purely internal self-correction [@chen2023; @huang2023; @kamoi2024]. The important distinction is not whether the workflow contains a step called “critique”; it is whether something outside the generated account can disagree with it.

### Delegation and context isolation

Delegation starts a new trajectory from a constructed brief and brings the child's report back into the parent's context. Isolation can give the child a shorter, cleaner starting region. Multiple children can also provide diversity. But the parent usually receives a generated report rather than the observation that justified it.

That boundary matters. If a child runs tests and sends back only “the patch passes,” the parent cannot distinguish a real test result from a plausible narration. The safer composition preserves the raw test output, diff, or tool transcript alongside the child's conclusion. The parent can then use the report as an interpretation while retaining access to the referent that may disagree with it.

Role or model diversity can improve aggregate performance [@du2023debate; @wang2024moa], but those results do not establish that delegation preserves evidence across a parent-child boundary. The benefit of isolation and diversity therefore remains separate from the question of whether the resulting selection is grounded.

### Best-of-N and model judges

Best-of-N adds alternatives and uses a judge to select one. The judge may recognize differences among the candidates, but its ranking is not an external check unless it sees evidence unavailable to the candidates and can use that evidence reliably.

This creates a simple bound on the method. More samples can cover more alternatives, but they do not improve the judge's ability to tell correctness from fluency. If all branches share an error, the judge can select the most polished version of that error, making the final answer appear more confident without making it more accurate. Self-consistency benefits from diversity in sampled reasoning paths [@wang2023selfconsistency], but the same limitation applies: a selector cannot correct an error that every candidate shares.

Replacing the model judge with a test suite changes the composition. The workflow is now branching over execution feedback, and the selector has an external signal to use. The test suite still covers only what it exercises, but it can disagree with a generated answer in a way that another generated answer cannot.

### Persistent memory

Persistent memory retrieves material from earlier trajectories and uses it to condition a later one. It is therefore a time-shifted form of prompting and retrieval. Memory can preserve a convention, a layout decision, or a settled plan that would otherwise have to be reconstructed. It can also preserve a mistake.

The difference is whether the remembered material carries its own means of verification. A remembered symbol name may have been correct when stored and stale after a rename. A remembered project decision may remain useful, but a remembered claim about the current code should be checked against the code. Storing the source, test result, or revalidation path with the memory keeps the later workflow connected to the evidence that justified it.

### Larger context windows

A larger context window does not itself add a new operator. It relaxes a constraint on operators already in use. A prompt can carry more examples, retrieval can return more passages, and an interaction loop can retain more observations. The window can therefore enable better steering, but it does not supply a move, signal, or referent of its own.

The same distinction applies to a faster model, a cache, or a cheaper decoder. These may materially improve cost, latency, or the amount of computation a workflow can afford. They do not, by themselves, change what the workflow is able to observe or how it decides that a document is acceptable.

### What this comparison cannot establish

This comparison classifies mechanisms; it does not measure them. Two techniques may both add computation or both use execution feedback while differing substantially in quality, cost, and robustness. The framing does not rank them or predict that a reported gain will transfer unchanged to another harness.

It does provide a practical starting point for an experiment. State which part of the workflow adds computation, which part adds evidence, and which part supplies alternatives. Identify the external state each observation actually covers. Measure branch diversity and selector quality separately. Preserve the raw referent when a generated summary crosses a workflow boundary. These details turn a compelling technique description into a claim that can be tested.

## 6. Alternative Views and Limitations

The manifold framing complements, rather than replaces, more formal accounts. Program synthesis describes code generation as search over discrete programs and specifications. Control theory describes an agent as a policy choosing actions from states and observations. Retrieval, inference-time compute, and search terminology already describe the mechanics of the operators discussed here. Those accounts are preferable when their formal variables are available.

The framing is useful because it keeps the evolving document and its evidence in view across different kinds of harness. It can also flatten important differences. A prompt, a compiler, and a learned value function are not the same causal mechanism merely because each redirects generation. The operator vocabulary should therefore support comparison, not substitute for an account of the system's actual mechanics.

The geometric language has the same boundary. No global document metric, smooth manifold, curvature, or basin of attraction is established. Results about contextual representations do not automatically transfer to whole documents or workflows. The examples in Section 5 are design analyses, not measurements of the framing. A stronger empirical contribution would state operator-level predictions in advance, measure the relevant signals and branch diversity, compare against compute-matched baselines, and test whether the relevant referent survives each workflow boundary.

## 7. Conclusion

Treating an agentic workflow as trajectory steering does not replace the mechanics of prompting, retrieval, execution, sampling, or search. The manifold is a framing device: it gives those mechanics a shared mental structure without asserting a formal geometry of documents.
For any harness, ask three questions: Which operator changes the document trajectory?
What signal guides that operator?
What external referent, if any, checks the result?
For a harness that composes several operators, ask all three of each step and keep the weakest referent in the chain.

The answers distinguish additional computation from additional evidence, branching from selection, and narrated success from observed state. More computation and longer trajectories cover more of the available document space; diversity produces alternatives but not a principled choice among them.
They also expose the framing's limits.
Where no representation, evaluator, or referent can be named, geometric language adds little.
Where those elements can be named, the framing offers a compact way to anticipate which part of a harness should help, which failures it cannot detect, and which claims still need an experiment.

## 8. References

The works cited in the text are listed below.
