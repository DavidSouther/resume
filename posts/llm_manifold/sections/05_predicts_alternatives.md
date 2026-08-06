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
