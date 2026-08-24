## 4. Steering Operators

Steering operators add additional tokens into a trajectory. We identify three substantive ways an operator can find the tokens it adds to the trajectory.

First, an operator may simpy generate tokens.
More reasoning tokens extend the trajectory and allow the model to cover more of the available document space before committing to an answer.
This can help when the task requires serial steps.
It cannot provide a fact, a file, or an application state that never entered the context, and facts in the learned model suffer from hallucinatory tendencies.

Second, an operator may add evidence.
Retrieval, execution, and user interaction all append documents from outside the current trajectory.
This can move generation toward a region that internal trajectory generation alone would not reach.
The gain is bounded by the quality and coverage of the observation: a retrieval result can be irrelevant, a test suite can be incomplete, and a tool can expose the wrong state.

Third, an operator may add alternatives. Sampling, delegation, debate, and search can explore different paths through the space.
Diversity is useful only when some selection rule can distinguish the better paths.
A judge, vote, value estimate, or parent agent is still another generated process unless it is grounded in an external check.
Alternatives are created by starting multiple ancillary generators (typically called subagents), and extracting a document from their output to append to the original trajectory.

An operator is further characterized here by its **move**, its **signal**, and its **referent check**.
These describe how a workflow moves through the task-local document space.
The signal is the information available to the harness to direct tool calling or other processing to generate the move tokens.
The move changes the generation process by adding tokens to the generation trajectory.
The fix identifies where to get the tokens for the trajectory, often against something outside the current trajectory.

**Table 1.**
**Steering operators and their evidence channels.**

| Operator | Impulse | Signal | Fix | Tokens |
| --- | --- | --- | --- | --- |
| Prompting | Conditions the initial trajectory | Prompt tokens and examples | None within the generation, human or agent operator when used in a harness | Null |
| Thinking Tokens | Extends length of the trajectory before generating a final "response" document | Intermediate generated states | None unless another operator supplies one | Generative |
| Execution Feedback | Appends an outside verdict and regenerates | Compiler, test, runtime, or API output | Direct, within the coverage of the tool | Evidence |
| Retrieval Expansion | Generates a stand-in query or document before retrieval | Retrieved corpus matches | Indirect; retrieval can return irrelevant or no evidence | Generative and Alternatives |
| Multi-sample Branching | Samples several trajectories and selects or aggregates | Votes, comparisons, or an aggregator | Depends on the selector; branches may share biases | Alternatives |
| ReAct-style Interaction | Alternates reasoning, actions, and observations | Observation after each action | Direct when the observation exposes the relevant state | Evidence |
| Tree-search Agents | Retain and revisit branches under a search policy | Value estimates, reflections, and environment feedback | Depends on the evaluator and environment | Generative, Evidence, and Alternatives |

### Prompting and Thinking Tokens

Prompting changes the initial conditional distribution.
An account of in-context learning as implicit Bayesian inference describes the prompt as evidence for a latent task concept [@xie2021].
The spatial phrase “choose a starting point” is a framing for the way a prompt selects an initial region of likely continuations.
Prompting provides no new observation after generation begins, so it cannot by itself resolve a fact absent from the context.

Chain-of-thought and pause tokens extend the trajectory before the final answer.
Results on serial problems and transformer expressivity support the additional-computation account [@li2024; @merrill2023].
Even content-free filler tokens can provide useful hidden computation [@pfau2024].
These results do not show that longer reasoning is universally useful. Longer trajectories cover more of the available document space and can help when serial depth is the bottleneck; they cannot supply evidence or an external state observation that is missing.

### Execution Feedback and Retrieval Expansion

Execution Feedback appends a verdict from outside the generated document.
A compiler error or failing test changes the next conditional distribution and can be applied repeatedly.
The check is still partial: passing tests establish only what those tests cover, and malformed tool output can misdirect the next step.

Retrieval Expansion occurs before appending external evidence.
HyDE generates a hypothetical answer to retrieve real documents near its embedding [@gao2023hyde].
HyPE generates hypothetical questions associated with documents and retrieves through those question representations [@vake2025hype].
Both methods manufacture intermediate documents that redirect retrieval through the task-local space.
The corpus result, not the manufactured text, is the evidence.
An empty or irrelevant retrieval result leaves the referent unresolved.

### Branching, Interaction, and Search

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
