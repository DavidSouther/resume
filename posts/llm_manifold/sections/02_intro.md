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
