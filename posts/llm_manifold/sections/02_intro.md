## 1. Introduction

Agentic language systems do more than ask a model for a likely continuation.
They take actions to retrieve documents, execute code, preserve intermediate reasoning, branch across several candidates, and use observations or value estimates to decide what happens next [citation to an overview of mid 2026 agent system features].
Some of these actions happen using language model continuation for text generation; [the same?] other actions use deterministic and long established text computation techniques [the same?].
The gestalt of these actions working in a single system delivers an "agentic system".
Agentic workflows improve outputs over one-shot document generation through three broad mechanisms: [adding computation/generating more tokens], adding external evidence, and selecting among alternative continuations.
These mechanisms fail differently.
More computation can explore more of the document space, but it cannot rely upon a fact the context does not contain.
An observation can correct the trajectory, but only within what the observation actually measures.
Branching can create diversity, but it does not provide a principled choice among candidates.

This paper proposes the manifold as a framing device for comparing those mechanisms and the operators that implement them.
It suggests using the idea of document generation as a trajectory on these manifolds as a mental model for considering how proposed agentic techniques will perform in practice, and when and how to use them to their best effect.

In this paper, we consider agent systems' actions in two categories, generation and operators.
Language model generation traces a sequence of document prefixes using stochastic continuation generators.
An agentic harness applies operators as computational techniques that redirect, extend, branch, or select among those trajectories.

The framing joins three existing ideas.
Language-model generation is a stochastic process over prefixes.
Contextual representations can have local low-dimensional structure.
Code generation can be treated as search over program texts constrained by behavior.
None of these establishes a single smooth manifold of documents.
Together, they motivate a useful mental model: **a task has local regions of acceptable and unacceptable documents, and a workflow can steer a generative trajectory through those regions**.

This is a synthesis and position paper for evaluating agentic systems. It keeps the geometric language deliberately at the level of a mental model rather than proposing a new geometric formalism: no global document metric, smooth manifold, or basin of attraction is assumed. Its contribution is a workflow-level vocabulary for asking how harness actions alter generation trajectories, what signals guide those actions, and what external evidence (if any) checks the resulting document.
Section 2 reviews the three strands of prior art.
Section 3 states the document-prefix model.
Section 4 describes the steering operators.
Section 5 considers those operators when evaluating agentic harness techniques.
Section 6 gives competing interpretations and limitations, and Section 7 concludes with a compact diagnostic.
