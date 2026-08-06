## 1. Introduction

Agentic language-model systems do more than ask a model for a likely continuation.
They take actions to retrieve documents, execute code, preserve intermediate reasoning, branch across several candidates, and use observations or value estimates to decide what happens next.
Some of these actions happen using language model continuation for text generation; other actions use deterministic and long established text computation techniques.
The gestalt of these actions working in a single system delivers an "agentic system".
This paper proposes one lens for comparing the effect and effectiveness of those actions.

In this paper, we consider agent systems' actions in two categories, generation and operators.
Language model generation traces a sequence of document prefixes using stochastic continuation generators.
An agentic harness applies operators as computational techniques that redirect, extend, branch, or select among those trajectories.

The lens joins three existing ideas.
Language-model generation is a stochastic process over prefixes.
Contextual representations can have local low-dimensional structure.
Code generation can be treated as search over program texts constrained by behavior.
None of these establishes a single smooth manifold of documents.
Together, however, they cautiously motivate a mental model of task-local document regions and trajectories through them.

This is a synthesis and position paper for mentally evaluating agentic systems, and does not propose a new geometric formalism.
Its contribution is a workflow-level vocabulary for asking how harness actions can alter generation trajectories, what signals guide those actions, and what external referent (if any) checks the resulting document.
Section 2 reviews the three strands of prior art.
Section 3 states the document-prefix model.
Section 4 describes the steering operators.
Section 5 applies the lens to results from recent agentic and inference-time harness research.
Section 6 gives competing interpretations and limitations, and Section 7 concludes with a compact diagnostic.
