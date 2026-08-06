## 4. Steering Operators

An operator is characterized here by its **move**, its **signal**, and its **referent check**.
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
The spatial phrase “choose a starting point” is this paper's interpretation.
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
