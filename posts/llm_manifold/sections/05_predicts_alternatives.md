## 5. Evaluating a New Technique

The operators in Section 4 are not a closed taxonomy. They are a way to orient ourselves when a new technique arrives with a more specific name: a critique loop, a delegation scheme, a memory design, or a larger context window. The useful question is not whether the technique sounds agentic. It is what kind of movement it creates through task-local document space, and what can pull that movement toward an acceptable document.

Operator selections compose.
A workflow may generate several plans, execute each one, and ask a model to select among the results.
In that case, the relevant question is not which operator appears strongest in isolation.
It is whether evidence reaches the decision point that relies on it.
A generated summary can become the agent's entire view of a test result; a self-written memory can become the source for a later prompt; a judge can select a fluent answer that every branch got wrong.
The composition inherits the weakest point at which its evidence can be lost or misread.

### Self-critique and revision

A self-critique pass is best understood first as a generative operator: it adds a critique and revision to one document-prefix trajectory. It exploits the serial-computation idea from prior art by giving the model more intermediate steps; as a probabilistic trajectory it may revisit or redirect a task-local contextual region, without supplying a global geometry or a missing observation. When the document is code, the revision is also a step through a discrete candidate-program space, whose behavioral constraints still come from a specification, tests, or another observation; for other documents, the corresponding constraints may be source fidelity or form. If both stages are generated from the existing context, the pass adds computation but no new evidence. It can help notice an inconsistency or unpack a difficult chain of reasoning, but should not be expected to recover a missing fact or reliably correct an error shared by the model and its rubric.

The composition becomes generative plus evidence when the critique receives an execution result, retrieved passage, or other external observation or source material that bears on its decision: this material constrains the next prefix in the trajectory and, where applicable, checks a candidate program's behavior. This is why self-debugging methods that condition critique on execution results differ from purely internal self-correction [@chen2023; @huang2023; @kamoi2024]. The important distinction is not the label “critique,” but whether something outside the generated account can disagree with it.

### Delegation and context isolation

Delegation is not inherently a selection operator. A subagent assigned one independent subtask contributes generative work, evidence gathering, or both; delegation becomes selection only when the agent compares competing subagent outputs or selects among them. A constructed brief starts a distinct document-prefix trajectory and can choose a cleaner task-local contextual region. When outputs compete, several subagents explore distinct probabilistic trajectories; when the task concerns code, their patches are also discrete candidate programs whose behavioral constraints must still be observed. None of these relations establishes a shared global document geometry. The agent usually receives a generated report rather than the observation that justified it.

That boundary matters. If a subagent runs tests and sends back only “the patch passes,” the agent cannot distinguish a real test result from a plausible narration. The safer composition preserves the raw test output, diff, or tool transcript alongside the subagent's conclusion. The agent can then use the report as an interpretation while retaining access to the referent that may disagree with it.

Role or model diversity can improve aggregate performance [@du2023debate; @wang2024moa], but those results do not establish that delegation preserves evidence across an agent-subagent boundary. The serial work done within a subagent and the contextual region selected by its brief are benefits separate from grounding; alternate trajectories are an additional benefit only when outputs are actually compared.

### Best-of-N and model judges

Best-of-N is a selection operator. It samples several document-prefix trajectories, which can provide diversity in the probabilistic sense described by prior art; candidates may also occupy different task-local representation regions, without those regions forming a common metric space. For code, these branches are a discrete program search, but multiple candidates do not satisfy behavioral constraints until a specification, test suite, or other observation evaluates them; for prose and other tasks, the relevant constraints differ. The judge may recognize differences among candidates, but its ranking is not an external check unless it sees evidence unavailable to the candidates and can use it reliably.

This creates a simple bound on the method. More samples can cover more candidate trajectories, but they do not improve the judge's ability to tell correctness from fluency. If all branches share an error, the judge can select the most polished version of that error, making the final answer appear more confident without making it more accurate. Self-consistency benefits from diversity in sampled reasoning paths [@wang2023selfconsistency], but the same limitation applies: a selector cannot correct an error that every candidate shares.

Replacing the model judge with a test suite changes the composition to selection plus execution-feedback evidence. The workflow still spends generation on branches, but the selector now has an external signal. The test suite covers only what it exercises, yet it can disagree with a generated answer in a way another generated answer cannot.

### Persistent memory

Persistent memory is a time-shifted prompting or retrieval operator, and becomes an evidence operator only when its stored material retains a verifiable referent. It carries material from an earlier document-prefix trajectory into a later one, potentially restoring a useful task-local contextual region without claiming that the two histories have a global geometric relation. It can preserve a convention, layout decision, or settled plan that would otherwise require more serial generation; it can also preserve a mistake. For code, a remembered patch or claim is not a behavioral constraint on a discrete program merely because it was once stored: current tests or specifications must still establish that relation.

The difference is whether the remembered material carries its own means of verification. A remembered symbol name may have been correct when stored and stale after a rename. A remembered project decision may remain useful, but a remembered claim about the current code should be checked against the code. Storing the source, test result, or revalidation path with the memory keeps the later workflow connected to the evidence that justified it.

### Larger context windows

A larger context window is not an operator; it relaxes a constraint on operators already in use. It lets a document-prefix trajectory retain more tokens: a prompt can carry more examples, retrieval more passages, and an interaction loop more observations. This may preserve richer local contextual representations and reduce needless reconstruction, but it adds neither serial computation, a candidate trajectory, nor a new external referent by itself. In a code task it can retain more of the discrete program's specification or test evidence, but it does not itself search candidate programs or establish their behavior; other document tasks have analogous source and form constraints.

The same distinction applies to a faster model, a cache, or a cheaper decoder. These may materially improve cost, latency, or the amount of computation a workflow can afford. They do not, by themselves, change what the workflow is able to observe or how it decides that a document is acceptable.

### What this comparison cannot establish

This comparison classifies mechanisms; it does not measure them. Two techniques may both add computation or both use execution feedback while differing substantially in quality, cost, and robustness. The framing does not rank them or predict that a reported gain will transfer unchanged to another agentic harness.

It does provide a practical starting point for an experiment. State which operators add serial computation, evidence, and selection; then say how their document-prefix trajectories compose, what task-local representation relation is being assumed, and where the claim does *not* require a global manifold. For code, identify the discrete candidate-program space and the behavioral constraints that observations actually cover; for other documents, state the corresponding acceptability constraints. Measure branch diversity and selector quality separately. Preserve the raw referent when a generated summary crosses a workflow boundary. These details turn a compelling technique description into a claim that can be tested.

## 6. Alternative Views and Limitations

The manifold framing complements, rather than replaces, more formal accounts. Program synthesis describes code generation as search over discrete programs and specifications. Control theory describes an agent as a policy choosing actions from states and observations. Retrieval, inference-time compute, and search terminology already describe the mechanics of the operators discussed here. Those accounts are preferable when their formal variables are available.

The framing is useful because it keeps the evolving document and its evidence in view across different kinds of agentic harness. It can also flatten important differences. A prompt, a compiler, and a learned value function are not the same causal mechanism merely because each redirects generation. The operator vocabulary should therefore support comparison, not substitute for an account of the system's actual mechanics.

The geometric language has the same boundary. No global document metric, smooth manifold, curvature, or basin of attraction is established. Results about contextual representations do not automatically transfer to whole documents or workflows. The examples in Section 5 are design analyses, not measurements of the framing. A stronger empirical contribution would state operator-level predictions in advance, measure the relevant signals and branch diversity, compare against compute-matched baselines, and test whether the relevant referent survives each workflow boundary.
