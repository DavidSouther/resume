# Individual Review: Agent A

## Recommendation
Continue with constraints

## Hard Gates
| Gate | Pass/Fail | Evidence |
|---|---|---|
| Novelty honesty | Pass | `research.md` ll.117-145 explicitly refutes the new-formalism framing and names Bradley/Terilla/Vlassopoulos (arXiv:2106.07890, 2501.06662) as "the single most dangerous prior art"; `design.md` ll.45-47, 81-85 state the contribution is the workflow-level reading, "not a new theorem, a new categorical formalism, or a claim that LLMs are manifolds." The one residue — a standalone "Topology of the Space" section in `paper.md` ll.54-56 that `paper-layout-meta-review.md` ll.304-306 flags as a grab bag — is skeleton, not prose, and Step 1 removes it. |
| Claim discipline | Pass | `design.md` ll.207-244 mandates the 6-field ledger (Claim/Status/Support/Does-not-support/Paper-section/Risk-if-wrong) with rows for the basin analogy and the Bradley novelty bound; `worked-analyses.md` ll.218-221 requires the "hand-picked, not random" caveat verbatim with a "Does not support: base-rate frequency" field. Contract-level pass. The realized table in `paper.md` ll.63-74 is still the old 4-column schema — that is the Step 2 deliverable, not a contract failure. |
| Predictive leverage | Pass | `analyst-eval-failures.md` ll.16-49 and `worked-analyses.md` ll.138-170 predict document-vs-referent decoupling for ReAct (false completion) AND its silence (~two-thirds no error) — neither follows from a prompt-engineering account. Section 6 (`paper-layout-meta-review.md` ll.137-157) codifies help/fail/cost conditions. |
| Venue appropriateness | Pass | `design.md` ll.49-51, 155-160 target a position/synthesis venue; `paper-layout-meta-review.md` ll.314-327 names position/workshop/TMLR/JAIR/CSUR fits and flags main-track venues as weak without empirical/theoretical results. |
| Tractable next step | Pass (with a fix folded in) | `design.md` ll.307-323 scopes Step 1 to `paper.md`/`check_sections.py`/eval docs; no theorem/benchmark/CLI prerequisite. Scripts verified on disk. Fixable wrinkle: `check_sections.py` ll.12-22 still hard-codes the rejected geometry-first REQUIRED list, so the gate currently enforces the layout `design.md` rejects — repair inside Step 1. |

## Scorecard
| Criterion | Weight | Score 1-5 | Weighted points | Rationale |
|---|---:|---:|---:|---|
| Thesis and contribution fit | 15 | 4 | 12 | Crisp, identical across `research.md` l.193, `design.md` ll.39-47, `symposium-review-prep.md` l.213; the single sharpest falsifiable claim is still open (`research.md` ll.190-195). |
| Novelty boundary and prior-art respect | 20 | 4 | 16 | `research.md` area-5 (ll.102-113) treats its own sweep as falsification; `design.md` ll.53-85 moves prior art to the first third. Not yet realized in prose; Bradley acknowledged (row 10) but not engaged. |
| Soundness and claim ledger quality | 20 | 3 | 12 | Schema (`design.md` ll.207-244) is exactly what I require; the realized ledger (`paper.md` ll.63-74) is the old 4-column form with no Does-not-support/Risk-if-wrong and TODO cites; the judge (`manifold.yaml`) does not check those fields. |
| Evidence and evaluation plan | 20 | 4 | 16 | Checkers present on disk + Lit Group transfer study (`design.md` ll.87-135); empirical anchor scoped as "what, not how often." Judge is coarse; `check_sections` encodes the wrong outline. |
| Explanatory leverage for agentic workflows | 15 | 4 | 12 | False-completion and external-vs-intrinsic split are real leverage (`worked-analyses.md` ll.40-62, 138-170); four of six examples lean on analogy (ll.225-228). |
| Execution tractability | 10 | 4 | 8 | Local to `posts/llm_manifold/`; no new theory/benchmark/CLI. Eval is bridged not runnable (`evals/README.md` ll.33-41) and the section gate is stale — both small. |

Total: 76/100

## Required Questions
1. A workflow-level diagnostic lens reading agentic LLM patterns (prompting, retrieval/HyDE, external feedback, CoT/pause tokens, subagents, ReAct, tree search) as comparable trajectory-steering operators toward a target region of acceptable artifacts — not a new formalism (`design.md` ll.39-47).
2. Bradley/Terilla/Vlassopoulos's enriched-category-of-texts, esp. the 2025 next-token-probability follow-up (arXiv:2106.07890, 2501.06662); `research.md` ll.108-113 names it the most dangerous prior art.
3. The "correct/incorrect basin of attraction" for single-pass generation (`paper.md` row 7; `research.md` ll.84-85) — must stay author-analogy/deferred; secondary risk is the continuous program-space metric (row 5).
4. Document-vs-referent decoupling for ReAct, grounded in real Analyst traces: false completion, ~two-thirds silent (`analyst-eval-failures.md` ll.16-49) — observed, not metaphor, with the hand-picked caveat.
5. Realize the contribution-first `paper.md` and fix `check_sections.py` (it enforces the rejected outline); upgrade the realized ledger to the 6-field schema and make the judge verify Does-not-support/Risk-if-wrong; keep basin/metric rows as analogy. All fixable in the bounded step.
6. The contribution-first `paper.md`: a non-empty Section 2 in the first third engaging Bradley et al., plus the upgraded ledger and the false-completion worked analysis carrying its predicted-failure-and-silence verbatim.

## Veto
No veto. My brief authorizes veto only if the project still claims formal novelty or the ledger lacks support boundaries / risk-if-wrong entries; the contract (`research.md` ll.117-145, `design.md` ll.207-244) satisfies both. The remaining defects are realization gaps in a skeleton the symposium was told not to grade as prose, and all are fixable in Step 1.

## Blocking Issues
- The executable gate contradicts the contract: `check_sections.py` ll.12-22 and `paper.md` ll.26-56 still encode the rejected geometry-first outline instead of the contribution-first one in `design.md` ll.161-204.
- The realized claim ledger (`paper.md` ll.63-74) is the old 4-column schema with no Does-not-support/Risk-if-wrong and TODO cites — the citation-drift protection is specified but not present.
- The judge (`manifold.yaml` ll.13-22) does not verify the Does-not-support/Risk-if-wrong fields, so the gate under-enforces drift protection.
- Bradley et al. is acknowledged but not engaged; v1 safety depends on no categorical claim being load-bearing, which Section 2 must demonstrate.
- The single sharpest falsifiable thesis is still open (`research.md` ll.190-195) and four of six worked analyses lean on analogy.

## Best Continuation Constraint
Step 1 must ship the contribution-first `paper.md` AND make the gate match it: rewrite `check_sections.py` to the new outline, upgrade the in-paper ledger to the 6-field schema (Does-not-support + Risk-if-wrong on every load-bearing row, basin/metric rows tagged author-analogy/deferred), and extend the `manifold.yaml` judge to verify those two fields — so a green eval certifies citation-drift protection, not merely section presence.
