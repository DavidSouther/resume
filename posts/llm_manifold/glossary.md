# LLM-Manifold Glossary

**Bounded context:** The paper's analytic vocabulary for agentic LLM workflows. This glossary governs manuscript prose; it does not claim a standard ontology for all AI agents.

**Status:** Every entry is `[DRAFT]` pending author approval. The paper should use the canonical heading exactly; listed synonyms are permitted only when they preserve the definition below.

## Domain relationships and invariants

- An **agentic system** contains one or more **agentic workflows**. An **agentic harness** is the control layer that executes a workflow's steering decisions; it is not the whole system.
- A **steering operator** transforms a **generation trajectory** (just **trajectory** for short) through a defined **signal**, **move**, and **grounding**. Its contribution has one or more **token kinds**.
- An **agent** may delegate to zero or more **subagents** and integrate their returned material. Neither term asserts a direct ownership or tree edge; use parent/child only when a named framework defines that relation.
- An **external observation** may be admitted into **context**. It counts as **evidence** only with respect to a claim or decision; its **grounding source** determines the extent and reliability of that grounding.
- **Selection** compares, ranks, aggregates, or otherwise advances retained candidate results. It changes the final outcome only when a **selector** applies it.

## Agentic workflow

**Definition:** A structured composition of model calls, tool invocations, state updates, and decision points intended to complete a task. It may be fixed, partially adaptive, or delegated across agents.
**Context:** Workflow-level analysis.
**Synonyms:** workflow (when the context is unambiguous)
**Source:** AWS Well-Architected Agentic AI Lens, “Workflow”; manuscript Sections 1 and 5.

## Agentic system

**Definition:** The deployed or conceptual system that executes one or more agentic workflows, including models, the agentic harness, tools, state, and external services.
**Context:** System boundary.
**Synonyms:** agent system
**Source:** AWS Well-Architected Agentic AI Lens, “Agentic AI system”; manuscript Section 1.

## Agentic harness

**Definition:** The control layer around a language model that constructs context and executes steering operators, including prompting, tool calling, branching, and selection. It is a component of an agentic system, not a synonym for the whole system.
**Context:** Mechanism-level analysis.
**Source:** Manuscript Sections 1, 3, and 5; `[DRAFT]` paper-specific refinement.

## Action

**Definition:** An instruction, with arguments, that requests a tool invocation or another environment-changing or environment-querying operation. An action is not the returned tool output.
**Context:** Tool interaction.
**Synonyms:** tool call (when the action is specifically a tool invocation)
**Source:** Oracle, “Select AI Agent Concepts”; ReAct [Yao et al., 2023].

## Selection

**Definition:** An operator category that compares, ranks, aggregates, or otherwise advances candidate trajectories, documents, or results. Candidate results are the inputs to selection, not a separate canonical operator category.
**Context:** Steering-operator token kinds.
**Synonyms:** selection operator
**Source:** Manuscript Sections 1, 4, and 5; self-consistency [Wang et al., 2023].

## Branch

**Definition:** One trajectory created when a workflow explores candidates from a shared or related starting context. A branch is a trajectory relation; selection compares the resulting candidates.
**Context:** Search and sampling.
**Synonyms:** trajectory branch
**Source:** Manuscript Sections 4 and 5; LATS [Zhou et al., 2024].

## Context

**Definition:** The model-visible input state at a generation step, including the prompt, prior generated tokens, and any admitted observations or retrieved material.
**Context:** Document-prefix model.
**Synonyms:** model context
**Source:** Manuscript Section 3; ReAct [Yao et al., 2023].

## Context window

**Definition:** The maximum amount of context a model can process in one inference call. It is a resource limit, not a steering operator or an evidence source.
**Context:** Model capability and workflow cost.
**Source:** AWS Well-Architected Agentic AI Lens, “Context window”; manuscript Section 5.

## Document

**Definition:** Any finite token sequence used by the paper's model: a prompt, answer, program, retrieved passage, tool result, or transcript.
**Context:** Document-prefix model.
**Source:** Manuscript Section 3.

## Document prefix

**Definition:** The document constructed so far at a generation step. It determines the next-token distribution for a fixed language model.
**Context:** Document-prefix model.
**Synonyms:** prefix
**Source:** Manuscript Section 3; autoregressive-generation account [Zekri et al., 2024].

## Document space

**Definition:** The set of document prefixes together with task-specific representations or relations used to compare them. It is an umbrella term, not one asserted metric space.
**Context:** Geometric framing.
**Source:** Manuscript Section 3.

## Evidence

**Definition:** An observation or source material that can support, constrain, or challenge a decision or claim because it bears on the relevant external state. Evidence is not synonymous with every token admitted to context.
**Context:** Steering-operator token kinds and evaluation.
**Source:** Oracle, “Select AI Agent Concepts”; EnvTrustBench [Sheng et al., 2026]; manuscript Sections 4 and 5.

## Grounding

**Definition:** The extent to which an operator's movement is anchored to relevant external state through an observation or source. Grounding may be direct, partial, indirect, or unavailable according to the authority, relevance, freshness, and coverage of the available observation.
**Context:** Steering-operator analysis.
**Source:** ReAct [Yao et al., 2023]; EnvTrustBench [Sheng et al., 2026]; manuscript Section 4.

## External observation

**Definition:** Information received from an environment, tool, user, or retrieval system, typically as feedback after an action. It may be text, structured data, media, an error, or a state signal. It becomes evidence only relative to a claim or decision it bears on.
**Context:** Tool interaction and grounding.
**Synonyms:** observation, tool result, tool output (at provider API boundaries)
**Source:** ReAct [Yao et al., 2023]; Oracle, “Select AI Agent Concepts.”

## Generative operator

**Definition:** A steering operator whose added tokens are model-generated continuation, rather than an external observation or a retained competing candidate.
**Context:** Steering-operator token kinds.
**Synonyms:** generation-only operator
**Source:** Manuscript Sections 1 and 4.

## Generation trajectory

**Definition:** The finite sequence of document prefixes produced as a model samples or selects successive tokens.
**Context:** Document-prefix model.
**Synonyms:** trajectory
**Source:** Manuscript Section 3; autoregressive-generation account [Zekri et al., 2024].

## Grounding source

**Definition:** The external source or state from which an observation is obtained and against which a decision can be checked. Its authority, relevance, freshness, and coverage determine the quality of any resulting grounding.
**Context:** Steering operators and evaluation.
**Synonyms:** referent (only when emphasizing the thing observed)
**Source:** Manuscript Sections 4 and 5; EnvTrustBench [Sheng et al., 2026].

## Move

**Definition:** The trajectory transformation performed by a steering operator: conditioning an initial trajectory, extending it, appending an observation, creating branches, or selecting among candidates.
**Context:** Steering-operator analysis.
**Source:** Manuscript Section 4; `[DRAFT]` paper-specific analytical field.

## Prompt

**Definition:** The initial instructions, examples, and task material used to condition a model call. A prompt is part of context, but context may additionally contain history and observations.
**Context:** Model input.
**Source:** Manuscript Sections 1 and 4; in-context-learning account [Xie et al., 2021].

## Selector

**Definition:** The process or component that compares candidates and chooses, ranks, aggregates, or otherwise advances one outcome. A selector may be model-based or externally grounded.
**Context:** Selection and search.
**Synonyms:** selection policy
**Source:** Manuscript Sections 4 and 5; LATS [Zhou et al., 2024].

## Model judge

**Definition:** A selector implemented by a language model. It is a narrower term than selector and is not, by itself, an external check.
**Context:** Best-of-N evaluation.
**Synonyms:** judge (only when the model implementation is explicit)
**Source:** Manuscript Section 5; `[DRAFT]` paper-specific refinement.

## Signal

**Definition:** The information available to the agentic harness that guides an operator's next action or transformation. A signal may be generated, heuristic, or externally observed; it is not necessarily evidence.
**Context:** Steering-operator analysis.
**Source:** Manuscript Section 4; `[DRAFT]` paper-specific analytical field.

## Steering operator

**Definition:** A workflow-level mechanism that changes a generation trajectory by conditioning, extending, appending observations, branching, or selecting. The paper classifies its token contribution as null, generative, evidence, or selection and analyzes its signal, move, and grounding.
**Context:** Central analytic construct.
**Synonyms:** operator (only within a clear steering-operator context)
**Source:** Manuscript Sections 1, 3, and 4; `[DRAFT]` paper-specific term.

## Subagent

**Definition:** An agent delegated a bounded subtask by another agent within a delegated multi-agent workflow. It has a distinct trajectory and may return generated reports, observations, or candidate results for selection.
**Context:** Delegation and multi-agent workflow.
**Synonyms:** worker agent (when its role is execution rather than general delegation)
**Source:** Anthropic, “How we built our multi-agent research system”; manuscript Section 5.

## Agent

**Definition:** A language-model-driven participant in an agentic workflow that can generate, act through tools, make decisions, and optionally delegate subtasks. When an agent delegates and integrates subagent results, it is acting as a coordinator; this is a role, not a separate named entity.
**Context:** Delegation and multi-agent workflow.
**Synonyms:** orchestrator (when the coordination role is primary)
**Source:** AWS Well-Architected Agentic AI Lens, “Agentic AI system”; Anthropic, “How we built our multi-agent research system.”

## Task-local region

**Definition:** A task-specific set of comparatively acceptable or unacceptable documents under a chosen representation or relation. It does not imply a global metric, smooth manifold, or basin of attraction.
**Context:** Geometric framing.
**Synonyms:** local region
**Source:** Manuscript Sections 1 and 3.

## Tool

**Definition:** A callable function, API, or other interface through which an agent queries or acts on an external system. A tool performs a query or action and may return an external observation.
**Context:** Tool interaction.
**Source:** AWS Well-Architected Agentic AI Lens, “Tool”; Oracle, “Select AI Agent Concepts.”

## Token kind

**Definition:** The provenance-oriented class of a steering operator's contribution: **null** for initial conditioning; **generative** for model continuation; **evidence** for externally obtained material admitted as evidence; and **selection** for comparing or advancing retained candidates. Operators may compose kinds.
**Context:** Steering-operator analysis.
**Source:** Manuscript Sections 1 and 4; `[DRAFT]` paper-specific classification.

## Suggested consolidations and replacements

| Current expressions | Decision | Rationale |
| --- | --- | --- |
| `agentic workflow`, `agentic system`, `agentic harness` | Keep all three, with the scopes above. | They name a process, its enclosing system, and its control layer; collapsing them hides implementation boundaries. |
| `observation`, `evidence`, `tool output`, `referent check`, `fix` | Use **external observation** for received material, **evidence** for its epistemic role, **grounding source** for its origin, and **grounding** for the operator field. Replace `referent check` and `fix` with **grounding**. | Agent research often calls action feedback an observation; provider APIs more often say tool result or tool output. Grounding is established language for the connection between model behavior and relevant external state. |
| `thinking tokens`, `reasoning tokens`, `intermediate generated states` | Use **generated intermediate tokens** generically; retain **thinking tokens** only as the familiar label of the table row. | “Reasoning token” can overclaim that visible text is faithful internal reasoning. |
| `alternative`, `branch`, `candidate`, `selection` | Use **selection** for the operator category, **branch** for its trajectory, and **candidate** for a result under consideration. Treat `alternative` as ordinary descriptive prose, not a canonical category. | This separates search topology, candidate inputs, and the decision mechanism. |
| `selector`, `judge`, `value estimate`, `vote`, `aggregator` | Use **selector** generically; qualify the implementation as a model judge, vote, value estimate, or aggregator. | A judge is one selector type; no selector is automatically grounded. |
| `parent agent`, `child agent`, `lead agent`, `orchestrator`, `subagent` | Use **agent** and **subagent**. Use **orchestrator** only when the coordination role is salient; use parent/child only when describing a framework's explicit ownership or tree relation. | Agent/subagent is enough to express delegation without creating a separate named coordinator entity. |
| `document space`, `manifold`, `task-local region`, `neighborhood` | Use **document space** as the umbrella and **task-local region** for the actionable comparison set. Reserve **manifold** for the paper's explicitly limited framing. | This preserves the paper's stated non-claim of a global metric or smooth geometry. |
| `prompt`, `context`, `context window` | Keep all three with the scoped definitions above. | A prompt is one component of context; a context window is a capacity limit. |

## Questions for author review

### Ask

- Confirm that **grounding** replaces `fix` and `referent check` as the operator field for the connection to external state.
- Confirm that an **agentic harness** is the control layer around an LLM-driven workflow; do not use unqualified `harness` in manuscript prose.
- Confirm that **selection** is the canonical operator category; a delegated report is a candidate input only when it enters a selection decision.

### Confirm

- Confirm that **agent** / **subagent** are the manuscript's canonical terms for delegated coordination, while parent/child remains available for a framework's explicit ownership or tree relation.
- Confirm that **external observation** is the canonical term for returned tool or environment material, while **evidence** names its epistemic role.
- Confirm that **generated intermediate tokens** is preferred in prose over `reasoning tokens`, except where citing or naming established techniques.
