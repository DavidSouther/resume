## 5. Evaluating a New Technique

The operators in Section 4 are not a closed taxonomy. They are a way to orient ourselves when a new technique arrives with a more specific name: a critique loop, a delegation scheme, a memory design, or a larger context window. The useful question is not whether the technique sounds agentic. It is what kind of movement it creates through task-local document space, and what can pull that movement toward an acceptable document.

Three distinctions organize the comparison.

First, a technique may add computation. More reasoning tokens extend the trajectory and allow the model to cover more of the available document space before committing to an answer. This can help when the task requires serial steps. It cannot provide a fact, a file, or an application state that never entered the context.

Second, a technique may add evidence. Retrieval, execution, and interaction append material from outside the current trajectory. This can move generation toward a region that internal continuation alone would not reach. The gain is bounded by the quality and coverage of the observation: a retrieval result can be irrelevant, a test suite can be incomplete, and a tool can expose the wrong state.

Third, a technique may add alternatives. Sampling, delegation, debate, and search can explore different paths through the space. Diversity is useful only when some selection rule can distinguish the better paths. A judge, vote, value estimate, or parent agent is still another generated process unless it is grounded in an external check.

These mechanisms compose. A workflow may generate several plans, execute each one, and ask a model to select among the results. In that case, the relevant question is not which operator appears strongest in isolation. It is whether the evidence survives each boundary. A generated summary can become the parent's entire view of a test result; a self-written memory can become the source for a later prompt; a judge can select a fluent answer that every branch got wrong. The composition inherits the weakest point at which its evidence can be lost or misread.

### Self-critique and revision

A self-critique pass adds a critique and a revision to the trajectory. If both are generated from the existing context, the pass adds computation but no new evidence. It can help the model notice an inconsistency, unpack a difficult chain of reasoning, or search more of the document space before answering. It should not be expected to recover a missing fact or reliably correct an error shared by the model and its rubric.

The classification changes when the critique receives an execution result, a retrieved passage, or another observation. The external material then supplies a new constraint on the next generation. This is why self-debugging methods that condition critique on execution results differ from purely internal self-correction [@chen2023; @huang2023; @kamoi2024]. The important distinction is not whether the workflow contains a step called “critique”; it is whether something outside the generated account can disagree with it.

### Delegation and context isolation

Delegation starts a new trajectory from a constructed brief and brings the child's report back into the parent's context. Isolation can give the child a shorter, cleaner starting region. Multiple children can also provide diversity. But the parent usually receives a generated report rather than the observation that justified it.

That boundary matters. If a child runs tests and sends back only “the patch passes,” the parent cannot distinguish a real test result from a plausible narration. The safer composition preserves the raw test output, diff, or tool transcript alongside the child's conclusion. The parent can then use the report as an interpretation while retaining access to the referent that may disagree with it.

Role or model diversity can improve aggregate performance [@du2023debate; @wang2024moa], but those results do not establish that delegation preserves evidence across a parent-child boundary. The benefit of isolation and diversity therefore remains separate from the question of whether the resulting selection is grounded.

### Best-of-N and model judges

Best-of-N adds alternatives and uses a judge to select one. The judge may recognize differences among the candidates, but its ranking is not an external check unless it sees evidence unavailable to the candidates and can use that evidence reliably.

This creates a simple bound on the method. More samples can cover more alternatives, but they do not improve the judge's ability to tell correctness from fluency. If all branches share an error, the judge can select the most polished version of that error, making the final answer appear more confident without making it more accurate. Self-consistency benefits from diversity in sampled reasoning paths [@wang2023selfconsistency], but the same limitation applies: a selector cannot correct an error that every candidate shares.

Replacing the model judge with a test suite changes the composition. The workflow is now branching over execution feedback, and the selector has an external signal to use. The test suite still covers only what it exercises, but it can disagree with a generated answer in a way that another generated answer cannot.

### Persistent memory

Persistent memory retrieves material from earlier trajectories and uses it to condition a later one. It is therefore a time-shifted form of prompting and retrieval. Memory can preserve a convention, a layout decision, or a settled plan that would otherwise have to be reconstructed. It can also preserve a mistake.

The difference is whether the remembered material carries its own means of verification. A remembered symbol name may have been correct when stored and stale after a rename. A remembered project decision may remain useful, but a remembered claim about the current code should be checked against the code. Storing the source, test result, or revalidation path with the memory keeps the later workflow connected to the evidence that justified it.

### Larger context windows

A larger context window does not itself add a new operator. It relaxes a constraint on operators already in use. A prompt can carry more examples, retrieval can return more passages, and an interaction loop can retain more observations. The window can therefore enable better steering, but it does not supply a move, signal, or referent of its own.

The same distinction applies to a faster model, a cache, or a cheaper decoder. These may materially improve cost, latency, or the amount of computation a workflow can afford. They do not, by themselves, change what the workflow is able to observe or how it decides that a document is acceptable.

### What this comparison cannot establish

This comparison classifies mechanisms; it does not measure them. Two techniques may both add computation or both use execution feedback while differing substantially in quality, cost, and robustness. The framing does not rank them or predict that a reported gain will transfer unchanged to another harness.

It does provide a practical starting point for an experiment. State which part of the workflow adds computation, which part adds evidence, and which part supplies alternatives. Identify the external state each observation actually covers. Measure branch diversity and selector quality separately. Preserve the raw referent when a generated summary crosses a workflow boundary. These details turn a compelling technique description into a claim that can be tested.

## 6. Alternative Views and Limitations

The manifold framing complements, rather than replaces, more formal accounts. Program synthesis describes code generation as search over discrete programs and specifications. Control theory describes an agent as a policy choosing actions from states and observations. Retrieval, inference-time compute, and search terminology already describe the mechanics of the operators discussed here. Those accounts are preferable when their formal variables are available.

The framing is useful because it keeps the evolving document and its evidence in view across different kinds of harness. It can also flatten important differences. A prompt, a compiler, and a learned value function are not the same causal mechanism merely because each redirects generation. The operator vocabulary should therefore support comparison, not substitute for an account of the system's actual mechanics.

The geometric language has the same boundary. No global document metric, smooth manifold, curvature, or basin of attraction is established. Results about contextual representations do not automatically transfer to whole documents or workflows. The examples in Section 5 are design analyses, not measurements of the framing. A stronger empirical contribution would state operator-level predictions in advance, measure the relevant signals and branch diversity, compare against compute-matched baselines, and test whether the relevant referent survives each workflow boundary.
