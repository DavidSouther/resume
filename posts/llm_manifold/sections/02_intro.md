## 1. Introduction

Agentic language systems do more than ask a model for a likely continuation.
They take actions to retrieve documents, execute code, preserve intermediate reasoning, branch across several candidates, and use observations or value estimates to decide what happens next [citation to an overview of mid 2026 agent system features].
Some of these actions happen using language model continuation for text generation; [the same?] other actions use deterministic and long established text computation techniques [the same?].
The gestalt of these actions working in a single system delivers an "agentic system".
Agentic workflows improve outputs over one-shot document generation through three broad mechanisms: adding generative tokens, adding external evidence, and selecting among candidate continuations.
These mechanisms fail differently.
More computation can explore more of the document space, but it cannot rely upon a fact the context does not contain.
An observation can correct the trajectory, but only within what the observation actually measures.
Branching can create diversity, but it does not provide a principled choice among candidates.

This paper proposes the manifold as a framing device for comparing those mechanisms and the steering operators that implement them. Language-model generation traces a sequence of document prefixes using stochastic continuation; an agentic harness adds tokens to redirect, extend, branch, or select among those trajectories. Those added tokens can be **generative** (more continuation), **evidence** (external observations or source material admitted to assess a claim or decision), or **selection** (a comparison or result that advances one candidate over another); prompting is the null case, which conditions the initial trajectory without adding a later token source. The operators make those distinctions operational through a **signal** that guides the agentic harness, a **move** that changes the trajectory, and **grounding** in relevant external state. This gives practitioners a mental model for asking how a proposed agentic technique will perform in practice and when it is best used.

The framing joins three existing ideas.
Language-model generation is a stochastic process over prefixes.
Contextual representations can have local low-dimensional structure.
Code generation can be treated as search over program texts constrained by behavior.
None of these establishes a single smooth manifold of documents.
Together, they motivate a useful mental model: **a task has local regions of acceptable and unacceptable documents, and a workflow can steer a generative trajectory through those regions**.

This is a synthesis and position paper for evaluating agentic systems. It keeps the geometric language deliberately at the level of a mental model rather than proposing a new geometric formalism: no global document metric, smooth manifold, or basin of attraction is assumed. Its contribution is a workflow-level vocabulary for asking how agentic harness actions alter generation trajectories, what signals guide those actions, and what external evidence (if any) checks the resulting document.
Section 2 reviews the three strands of prior art.
Section 3 states the document-prefix model.
Section 4 describes the steering operators.
Section 5 considers those operators when evaluating agentic harness techniques.
Section 6 gives competing interpretations and limitations, and Section 7 concludes with a compact diagnostic.
