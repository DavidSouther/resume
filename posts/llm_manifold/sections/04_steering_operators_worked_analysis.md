## 4. Steering Operators for Agentic Workflows

Each agentic pattern below is an operator acting on the **document trajectory**: the tokens the model actually writes on the way toward, or away from, an acceptable region.
What differs, pattern to pattern, is the operator's **impulse**, the **signal** it uses, and its **referent validation**: whether and how it checks the generated document against an external state that can judge the document's correctness.
Table 1 identifies seven operators using those three columns.

**Table 1.**

**Steering operators and referent couplings**

| Operator | Impulse | Signal | Referent validation |
| --- | --- | --- | --- |
| Prompting | Fixes the start point and framing before generation begins | The prompt's own conditioning tokens | None internally; user restarting prompt externally |
| Thinking / chain-of-thought / pause tokens | Buys extra sequential computation before committing to an answer | Nothing external; the extra tokens are spent and discarded | Never — the operator lives entirely inside the document, with limited observation steps |
| External tool / execution feedback | Re-derives the next move from an outside verdict — a stack trace, a failing test, an API response | The tool's returned output, fed back into context | Explicitly, and repeatably: each call is a fresh checkpoint against the referent |
| Retrieval, HyDE, HyPE, "Jeopardy" expansion | Manufactures one or more intermediate points (a hypothetical answer, or a set of paraphrased queries) and continues trajecrtories from them | Generated stand-ins, embedded and used once, though potentially with subagents | Implicitly with whichever real documents happen to sit nearby; nothing confirms the neighborhood is non-empty |
| Subagents / multi-sample branching | Launches several trajectories from related start points, then collapses to one via selection, voting, or synthesis | The comparison or voting step over the branches | Only as good as the branches' diversity; a shared prompt makes the comparison circular |
| ReAct-style tool interaction | Interleaves a reasoning move, a tool call, and an observation, repeatedly | The observation returned after each tool call | Explicitly, once per step — but only as reliable as whether that observation is actually read and acted on |

Prompting and thinking act inside the model and have no internal referent validation.
Retrieval expansion creates stand-ins and probes a corpus, but a nearby document is only implicit validation.
External tools and ReAct-style interaction can validate against a referent repeatedly, provided the returned observation is trustworthy and read.

## 5. Worked Analyses

### Prompting

**Pattern.**
Set a system instruction, user prompt, exemplar set, or learned soft prompt before generation begins.

**Impulse.**
Prompting fixes the start point and framing before generation begins.

**Signal.**
The signal is the prompt's own conditioning tokens.
In an in-context-learning account, the prompt helps identify the latent concept the model should infer from context [@xie2021].
A learned soft prompt is the same operator at a different interface: it changes conditioning before generation, but does not add a referent check after generation starts.

**Referent validation.**
There is no internal validation path.
If the result is wrong, the user can restart externally with a different prompt, but the completed generation has not checked itself against a referent.
Prompting cannot repair drift that requires new evidence after the start point has been fixed.
If the task depends on a compiler verdict, a live repository or application state, an absent document, or a later observation, more prompt text can only move the initial trajectory toward a different plausible region.
It cannot create a return path to the referent.

**Boundary / counterexample.**
Prompting is enough when the desired behavior is mostly a stable framing, style, format, or task concept already present in context.
It fails as a substitute for retrieval, execution feedback, or tool observation when the acceptable region is defined by facts outside the document.

### Chain-of-thought and pause tokens

**Pattern.**
Spend intermediate tokens - explicit reasoning, or even content-free filler - before committing to an answer.

**Impulse.**
The operator buys extra sequential computation before the final answer is emitted.
It does not change the referent, and by itself it does not observe one.

**Signal.**
There is no external signal.
The additional tokens are spent inside the document trajectory and then discarded or hidden from the final answer.

**Referent validation.**
Chain-of-thought lets transformers solve problems that are inherently serial, which they cannot solve in a bounded number of steps without it [@li2024]; expressivity scales with the number of CoT steps [@merrill2023]; even meaning-free filler tokens add usable hidden computation [@pfau2024].
Spatial language such as "widening the search" or "curving the path" is only a gloss; the cited results support serial depth, not geometric curvature.
On tasks that are not bottlenecked by serial computation - simple recall, single-step lookup, or a missing external observation - extra thinking tokens buy little while adding cost and latency.

**Boundary / counterexample.**
The filler-token result [@pfau2024] is the sharp case against a purely semantic reading: depth, not content, is doing the work.
Extra thinking is best gated behind evidence of a serial obstacle, such as a failed proof step, a type error, or a test failure, rather than spent everywhere by default.

### External Tool / execution feedback

**Pattern.**
Generate code, run it, feed the failure - a stack trace, a failing test, a type error - back into context, and regenerate.

**Impulse.**
The outside verdict directs the next move, shifting the trajectory from "plausible code" toward "code the runtime accepts" [@chen2023].

**Signal.**
The signal is the returned error text, test result, type checker output, or runtime behavior.

**Referent validation.**
Intrinsic self-correction, without any external signal, does not reliably help [@huang2023; @kamoi2024].
Without a genuine external signal, model review of model output is intrinsic self-correction.
Nothing outside the document constrains the next move, so reliable improvement should not be expected, and regression remains possible.

**Boundary / counterexample.**
The operator is strongest when the verifier is sound and cheap, such as a compiler or a unit test; it is weakest when the "error" is itself a model-generated critique with no ground truth.
A disciplined red-green-refactor cycle operationalizes this boundary by refusing to accept a fix that is not driven by a failing test.

### HyDE, HyPE, and retrieval expansion

**Pattern.**
Rather than searching with the literal query, generate one or more stand-ins - a hypothetical answer document (HyDE), or a set of paraphrased queries (HyPE) - and search around those stand-ins instead.

**Impulse.**
Retrieval expansion manufactures intermediate points in document space to relocate the search neighborhood before drawing on real evidence.
HyDE expands the answer side by generating a plausible answer and retrieving real documents near it [@gao2023hyde]; HyPE expands the query side by generating plausible variants of the question itself and matching those against precomputed, document-side prompts [@vake2025hype].
Both manufacture stand-ins; they differ in which side of the query-answer gap receives them.

**Signal.**
The signal is the generated stand-in embedded and used once, possibly with subagents producing multiple candidate stand-ins.

**Referent validation.**
The recall improvement from a denser query neighborhood is established method behavior in both papers; treating the stand-ins as points in document space is the analogical step.
When the target neighborhood is genuinely empty - no real document answers the question - the manufactured stand-in has nothing to snap to, and the model can answer from its own fabrication.
This is not hypothetical: coding agents can make things up after a failed search, especially for how-to documentation, exactly when retrieval comes back empty-handed.
Retrieval expansion can therefore amplify hallucination at empty neighborhoods rather than uniformly improving answers.

**Boundary / counterexample.**
The move helps when the corpus is dense near the true answer but the literal query is lexically distant, and hurts when the system has no explicit "found nothing" guard.
HyPE's query-side expansion has a structural advantage here: an empty match against precomputed questions is a legible "nothing exists" signal, rather than a temptation to fabricate one.

### Subagent review and multi-sample search

**Pattern.**
Sample multiple candidates, or spawn multiple subagents, then select, vote, or review.

**Impulse.**
The operator launches several trajectories from related start points, then collapses to one via selection or voting.

**Signal.**
The signal is the comparison, vote, review, or aggregation step over the branches.

**Referent validation.**
Sampling and voting over multiple chain-of-thought completions (self-consistency) reliably improves accuracy [@wang2023selfconsistency]; genuinely distinct-role variants extend the same move - multiple personas debating toward consensus [@du2023debate], or layered agents refining each other's output before a final aggregation step [@wang2024moa].
The sampling result is established; saying that branches cover distinct regions of document space is the spatial gloss.
When the branches are N samples from one shared prompt, the diversity is illusory.
They explore one neighborhood under one conditioning, and selection has nothing meaningfully different to choose between.
Multi-sample gains shrink toward zero as shared prompt/context bias dominates, regardless of how large N grows.

**Boundary / counterexample.**
Gains reappear when branches have genuinely distinct start points - different model bindings, providers, or roles, as in a matrix fan-out with a per-arm rollup for selection - because only then does a branch explore a different part of the space rather than resampling the same one.
A panel of judges that all share one system prompt is selection theater, not diversity.

### ReAct and tool-interactive agents

**Pattern.**
Codex, Cursor, Claude Code, and similar tool-interactive agents interleave reasoning, tool calls, and observations to complete user-directed coding tasks.

**Impulse.**
Each step combines a reasoning move with a tool call, then appends tool call result to extend the prefix [@yao2023react] before continuing token generation.

**Signal.**
The signal is the returned tool-call observation: what the repository, terminal, browser, or application says actually happened, not what the assistant previously narrated.

**Referent validation.**
When the observation channel is weak, incomplete, or unread, the document trajectory and referent trajectory can diverge.
The model can move its own document into the target region - "I've updated the file," "the test now passes" - while the referent never moves.
A review of hand-picked coding-agent traces (not a random sample, so what follows describes what fails, not how often it fails) found this false-completion pattern to be the single most common failure, and roughly two-thirds of the failing cases carried no error message at all: nothing crashed, so nothing looked wrong.
A prompt-engineering reading can call the answer unhelpful; it does not naturally explain why a no-error trace can be confidently and silently false.
The operator account does: the narration can satisfy the document-level form while the repository, command result, or application state remains outside the acceptable referent region.

**Boundary / counterexample.**
This failure recedes when every claimed state change is observed and verified before being narrated: compare what the agent claimed against what actually changed, and what the user said next, rather than grading the narration alone.
A related boundary case: asked to do something the available tools cannot do at all, such as renaming an object with no rename operation, the agent sometimes claims success anyway.
That is a failure to represent the edge of the acceptable region, not a failure to reach it.