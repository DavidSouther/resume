# Individual Review: Agent B

## Recommendation
Continue with constraints

## Hard Gates
| Gate | Pass/Fail | Evidence |
|---|---|---|
| Novelty honesty | Pass | design.md ll.44-47 and research.md ll.116-145 refute the new-formalism frame and name Bradley et al. (arXiv:2106.07890, 2501.06662) as the dangerous prior art; paper.md ledger row 10 bounds categorical novelty. The contribution is the workflow lens, not a theorem. |
| Claim discipline | Pass | Richer 6-field ledger schema specified in design.md ll.211-218; external-vs-intrinsic self-correction split held separate in research.md ll.96-100, design.md ll.73-75, worked-analyses.md ex.1. Caveat: paper.md ll.63-74 still ships the OLD 4-column ledger; upgrading is design step 1 (fixable). |
| Predictive leverage | Pass | analyst-eval-failures.md ll.34-49 + worked-analyses.md ex.5 give the document-vs-referent decoupling / false-completion prediction with its silence property — a falsifiable failure mode prompt-engineering language cannot produce. Hand-picked-not-random caveat carried verbatim (ll.11-15). |
| Venue appropriateness | Pass | design.md ll.49-52 and paper-layout-meta-review.md ll.314-327 target position/synthesis/TMLR/JAIR/arXiv and mark main-track benchmark venues weak absent new evidence. No benchmark claimed. |
| Tractable next step | Pass | design.md ll.18-31 / symposium-review-prep.md ll.253-267 scope the next step to a bounded rewrite of paper.md, ledger, section checker, evals/. All target files exist locally (verified). No new theorem/benchmark/Ailly-CLI dependency. |

## Scorecard
| Criterion | Weight | Score 1-5 | Weighted points | Rationale |
|---|---:|---:|---:|---|
| Thesis and contribution fit | 15 | 4 | 12 | Crisp, consistently restated thesis (design.md ll.40-47); clearly distinct from published formal work. Loses a point: the single sharpest falsifiable form is still 'not sure yet' (research.md ll.189-195). |
| Novelty boundary and prior-art respect | 20 | 4 | 16 | Honest novelty sweep treated as load-bearing (research.md ll.102-145); boundary moved into first third by design. Not 5: the live paper.md has no prior-art section yet — the bound lives only in the contract. |
| Soundness and claim ledger quality | 20 | 3 | 12 | Designed schema strong (does-not-support + risk fields, design.md ll.211-244), but implemented ledger (paper.md ll.63-74) is the old 4-column form and check_sections.py enforces the rejected outline. Sound on paper, not in the gate. |
| Evidence and evaluation plan | 20 | 3 | 12 | Automated half honestly scoped as necessary-not-sufficient (evals/README.md). Human half tests transfer only weakly: no held-out workflow, no rubric, no scored failure-mode prediction (design.md ll.104-130). |
| Explanatory leverage for agentic workflows | 15 | 4 | 12 | Six five-field worked analyses with distinct predicted failure modes; ex.5 is measured, not metaphor. Not 5: ex.3/4/6 lean on analogy and four citation keys are missing from refs.bib. |
| Execution tractability | 10 | 4 | 8 | Local, well-sequenced next steps; scripts and refs.bib exist. Minor: check_sections.py encodes the old 9-heading list and exits 0 even when it prints a failure. |

Total: 72/100

## Required Questions
1. The claimed contribution is a workflow-level diagnostic lens reading agent patterns (prompting, retrieval/HyDE, external feedback, thinking/CoT, subagents, ReAct, tree search) as a unified sequence of steering operators moving generation through document space toward a task-local region of acceptable artifacts.
2. Bradley/Terilla/Vlassopoulos's enriched [0,1]-category of texts with next-token LM probabilities (arXiv:2106.07890, 2501.06662) most threatens the contribution by pre-claiming the geometric/categorical vocabulary; the project neutralizes it by dropping the formalism claim, but it is why any geometric phrasing must stay analogy.
3. The likely overstatement is the 'basin of attraction toward a correct vs incorrect region' for single-pass generation (paper.md ledger row 7; research.md ll.83-85) — no published grounding; must remain author-analogy/deferred.
4. The strongest beyond-metaphor evidence is the document-vs-referent decoupling borne out in real Analyst traces: false completion where narration reaches 'done' while external state never moved, with ~two-thirds of failing cases emitting no error (analyst-eval-failures.md ll.18-49).
5. I move to unconditional continue once the Lit Group protocol becomes a structured transfer test: a held-out workflow the reader has not seen, a fixed classification rubric (start point, target region, signal added, predicted failure mode), and a scored check that readers predict the lens's failure mode before seeing it.
6. The next concrete artifact that must improve is paper.md, rewritten to the contribution-first 10-section outline with the novelty boundary in the first third, the 6-field ledger replacing the 4-column table, and check_sections.py updated to enforce that contract and actually exit non-zero on failure.

## Veto
Veto unconditional continuation because the evaluation plan does not yet test transfer: design.md ll.104-130 asks readers to 'use the steering vocabulary on a new agent pattern' without a held-out workflow, a classification rubric, or a scored failure-mode-prediction check. Per my brief's likely-veto condition (the protocol cannot test whether readers can apply the lens to a new workflow and audit its claims), this forces continue-with-constraints. The defect is fixable locally and the thesis is itself falsifiable, so no rescope is needed.

## Blocking Issues
- The Lit Group protocol does not test transfer: no held-out workflow, no rubric, no scored failure-mode prediction (design.md ll.104-130). This is the defect I veto on.
- The live gate enforces the wrong contract: check_sections.py REQUIRED is the rejected geometry-first 9-heading skeleton, not the contribution-first 10-section outline (design.md ll.162-204); it also exits 0 while printing an empty-section failure, so it is not red as evals/README.md claims.
- The single sharpest falsifiable form of the thesis is still undecided (research.md ll.189-195); without it the predictive section risks relabeling prompt engineering for the non-ReAct operators.
- Four worked-analysis citation keys (yao2023react, gao2023hyde, zhou2024lats, wang2023selfconsistency) are missing from refs.bib, so most non-false-completion predictions are not yet literature-anchored.
- The implemented ledger (paper.md ll.63-74) is the old 4-column table lacking the does-not-support and risk-if-wrong fields that guard against citation drift.

## Best Continuation Constraint
Before any Lit Group session counts as a pass, upgrade the review protocol into a structured transfer test: a held-out agent workflow the reader has not seen, a fixed classification rubric (start point, target region, signal added, predicted failure mode, evidence), and a scored check that readers correctly predict the failure mode the lens claims — turning 'is the lens useful' from a group vibe into a measurable transfer result.
