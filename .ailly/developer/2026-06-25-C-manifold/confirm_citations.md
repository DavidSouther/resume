# Confirm citations — five missing `refs.bib` keys

Source: `plan.md` Step 0's citation-key checklist, `experiments/worked-analyses.md`.
For each row, open the link, confirm the paper actually supports the claim text,
then fill in `Y` or `N` in the last column. `N` means: find a different paper,
or flag the claim/key for rework in `plan.md` Step 2.

| Key | Worked analysis | Claim in `paper.md` this citation must support | Candidate paper | Authors | arXiv (unverified) | Link | Confirmed? |
|---|---|---|---|---|---|---|---|
| `yao2023react` | §5.5 ReAct / tool-interactive (the load-bearing example) | Interleaving reasoning, tool calls, and observations, where each tool call's *observation* is meant to re-couple the document trajectory to the external referent before the next move — established behavior; the "walks the document manifold toward a goal region" framing is the paper's own analogy, not this paper's claim. | "ReAct: Synergizing Reasoning and Acting in Language Models" | Yao et al. | 2210.03629 | https://arxiv.org/abs/2210.03629 | |
| `gao2023hyde` | §5.3 HyDE / retrieval expansion | Generating a hypothetical answer/document, embedding it, and retrieving real documents near it improves recall via a denser query neighborhood — established method behavior; the "manufacture an intermediate point in document space" framing is analogy. | "Precise Zero-Shot Dense Retrieval without Relevance Labels" (HyDE) | Gao et al. | 2212.10496 | https://arxiv.org/abs/2212.10496 | |
| `zhou2024lats` | §5.6 LATS / tree-search agents | Expanding a search tree of action sequences with backtracking and value estimates, rather than committing to one trajectory — established search procedure; "regions of the document manifold" is analogy. | "Language Agent Tree Search Unifies Reasoning, Acting, and Planning in Language Models" (LATS) | Zhou et al. | 2310.04406 | https://arxiv.org/abs/2310.04406 | |
| `wang2023selfconsistency` | §5.4 Subagent review / multi-sample search | Sampling many candidates from one prompt and selecting/voting over them (self-consistency / pass@k) improves output quality — established for the sampling result; "branches cover distinct document-space regions" is analogy, and the paper's own predicted failure mode is that branches collapse onto shared prompt/context bias. | "Self-Consistency Improves Chain of Thought Reasoning in Language Models" | Wang et al. | 2203.11171 | https://arxiv.org/abs/2203.11171 | |
| `chen2024agentless` | §5.4 Subagent review / multi-sample search (second citation, "or similar") | A second source for the *subagent/multi-sample-selection* half of §5.4, distinct from bare temperature-sampling self-consistency — e.g. genuinely distinct start points (different bindings, providers, or roles) with a per-arm rollup for selection, as opposed to N samples from one shared prompt. `worked-analyses.md` ll.33-35 flags this key itself as tentative — the topic and the "Chen" author may not belong to the same paper. | Uncertain — closest topical match found is "Agentless: Demystifying LLM-based Software Engineering Agents," authored by Xia et al., not Chen. May need a different key/paper (e.g. a mixture-of-agents or multi-agent-debate paper) rather than confirming this one. | Xia et al. (if Agentless) | 2407.01489 (if Agentless) | https://arxiv.org/abs/2407.01489 | |

## If a row comes back `N`

Note it inline in this file (a short reason next to `N` is enough), then carry
the replacement key/paper into `plan.md` Step 2 before writing `refs.bib` —
Step 2 is explicitly gated on verified metadata, not on this checklist's
tentative IDs.
