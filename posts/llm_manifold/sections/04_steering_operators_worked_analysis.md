## 4. Steering Operators

Steering operators add tokens to a trajectory. Their primary token kind is **generative**, **evidence**, or **selection**; prompting is the **null** case, which establishes a trajectory without a later added-token source. An operator is also characterized by a **signal**, the information the agentic harness can use to direct processing; a **move**, the change that appends or conditions a trajectory; and **grounding**, the connection between that movement and relevant external state. These terms keep distinct the way a workflow moves through task-local document space from the reason to trust that movement.

**Table 1.**
**Steering operators, signals, moves, and grounding.**

| Operator | Signal | Move | Grounding |
| --- | --- | --- | --- |
| **Prompting**<br><em>Null</em> | Prompt tokens and examples | Conditions the initial trajectory | None within generation; a human or agentic harness may supply the prompt |
| **Thinking Tokens**<br><em>Generative</em> | Intermediate generated states | Extends the trajectory before the final response | None unless another operator supplies it |
| **Execution Feedback**<br><em>Evidence</em> | Compiler, test, runtime, or API output | Appends an outside verdict and regenerates | Direct, within the tool's coverage |
| **Retrieval Expansion**<br><em>Generative + Evidence</em> | Generated query or stand-in document; retrieved corpus matches | Generates a retrieval representation, then appends returned material | Direct when returned corpus material is authoritative and relevant; the generated representation routes there, and relevance or coverage can fail |
| **Multi-sample Branching**<br><em>Selection</em> | Votes, comparisons, or an aggregator | Samples several trajectories and selects or aggregates | Depends on the selector; branches may share biases |
| **ReAct-style Interaction**<br><em>Evidence when the observation bears on the decision</em> | Observation after each action | Alternates reasoning, actions, and observations | Direct when the observation exposes the relevant state |
| **Tree-search Agents**<br><em>Generative + Selection; Evidence with environment feedback</em> | Value estimates, reflections, and, when observed, environment feedback | Retains and revisits branches under a search policy | Depends on the evaluator; environment feedback is direct only within its coverage |

### Prompting and Thinking Tokens

Prompting is the null operator and thinking tokens are generative operators: together they set and then extend a single trajectory without an outside observation or a competing branch. They are therefore best suited to work whose bottleneck is choosing a useful initial region or carrying out serial computation, not discovering a missing fact.

**Signal.** Prompting uses the prompt's instructions and examples; thinking uses the intermediate generated state. An account of in-context learning as implicit Bayesian inference describes the prompt as evidence for a latent task concept [@xie2021]. The spatial phrase “choose a starting point” names the way that conditioning selects an initial region of likely continuations.

**Move.** Prompting changes the initial conditional distribution. Chain-of-thought and pause tokens extend the trajectory before the final answer. Results on serial problems and transformer expressivity support this additional-computation account [@li2024; @merrill2023], and even content-free filler tokens can provide useful hidden computation [@pfau2024].

**Grounding.** Neither operator grounds itself in external state. Longer trajectories can cover more of the available document space when serial depth is the bottleneck, but cannot supply evidence or an external observation that is missing; a separate evidence operator must do that work.

### Execution Feedback and Retrieval Expansion

Execution feedback is an evidence operator; retrieval expansion composes a generative retrieval representation with an evidence operator. Both can redirect a trajectory toward regions that internal continuation alone cannot reach, but only insofar as their observations cover the relevant external state.

**Signal.** Execution uses compiler, test, runtime, or API output. Retrieval uses a generated stand-in document or query to locate corpus matches. HyDE generates a hypothetical answer to retrieve real documents near its embedding [@gao2023hyde], while HyPE generates hypothetical questions associated with documents and retrieves through those question representations [@vake2025hype].

**Move.** Execution appends a verdict and regenerates, repeatedly when needed. Retrieval first manufactures an intermediate document that redirects retrieval through task-local space, then appends the corpus result. In both cases the new tokens alter the next conditional distribution rather than merely lengthening the existing trajectory.

**Grounding.** A compiler error or failing test grounds the next step directly within the tool's coverage; passing tests establish only what they cover, and malformed output can misdirect the next step. The corpus result—not the manufactured text—grounds retrieval when it is authoritative and relevant to the question. The generated representation only routes the search to that evidence; an empty or irrelevant result, or corpus coverage that omits the needed material, leaves the referent unresolved.

### Branching, Interaction, and Search

Multi-sample branching is a selection operator; ReAct combines generated reasoning with external observations that can provide evidence; tree search can combine all three kinds. They are best used when the workflow can profit from distinct candidate trajectories or repeated environment contact, and when its selector or observation can distinguish a better path from a merely fluent one.

**Signal.** Multi-sample methods use votes, comparisons, or an aggregator. Self-consistency samples diverse reasoning paths from one prompt and selects the most consistent answer [@wang2023selfconsistency]; different roles, models, or contexts may add diversity [@du2023debate; @wang2024moa]. ReAct uses the observation after each action [@yao2023react]. Tree search uses value estimates, reflections, and environment feedback [@zhou2024lats].

**Move.** Branching retains several candidate trajectories and then votes, compares, or synthesizes. ReAct interleaves reasoning traces, actions, and observations, repeatedly coupling a document to an environment. Language Agent Tree Search preserves a frontier and can revisit earlier decisions while combining language-model planning and acting with tree search [@zhou2024lats].

**Grounding.** Diversity matters only insofar as the selection rule correlates with correctness: shared conditioning does not make branches identical, but neither does it give a judge an external check. ReAct's observation can correct the account of the world only when the tool exposes the relevant state and the next step uses it. Tree search helps when intermediate states can be evaluated well enough to allocate search; a weak value estimate can instead steer it toward fluent but incorrect branches, while broad search increases inference and environment-interaction cost.
