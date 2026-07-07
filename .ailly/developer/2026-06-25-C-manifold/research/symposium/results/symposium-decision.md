# Symposium Decision

## Decision
Continue with constraints

## Vote Summary
| Agent | Recommendation | Score | Veto | Main reason |
|---|---|---:|---|---|
| Agent A (Formal Methods and Categorical Semantics) | Continue with constraints | 76 | No | Contract neutralizes the formal-novelty risk, but the executable gate (`check_sections.py` ll.12-22) and the realized ledger (`paper.md` ll.63-74) still encode the rejected layout/schema, and Bradley et al. is acknowledged but not engaged. |
| Agent B (Empirical LLM Evaluation and Agent Reliability) | Continue with constraints | 72 | Yes (fixable) | The Lit Group protocol (`design.md` ll.104-130) does not test transfer — no held-out workflow, no rubric, no scored blind failure-mode prediction. Vetoes unconditional continue, not the project; fixable locally in Step 1. |
| Agent C (Agentic Workflow Systems Practitioner) | Continue with constraints | 83 | No | Strong builder-facing explanatory leverage (document-vs-referent decoupling); remaining concerns are the bounded Step-1 build. Updated to adopt B's scored-transfer-test constraint. |

Average score: 77/100

## Hard-Gate Findings
| Gate | Final status | Rationale |
|---|---|---|
| Novelty honesty | Pass (unanimous) | `research.md` ll.117-145 refutes the new-formalism frame and names Bradley/Terilla/Vlassopoulos (arXiv:2106.07890, 2501.06662); `design.md` ll.45-47 disclaims any theorem or categorical formalism. The residual standalone Topology section (`paper.md` ll.54-56) is skeleton removed in Step 1, not a contract failure. |
| Claim discipline | Pass (unanimous, realization caveat) | The 6-field ledger schema is specified in `design.md` ll.207-244 with the external-vs-intrinsic split held separate. All three flag the SAME caveat — the realized ledger (`paper.md` ll.63-74) is still the old 4-column form. Reviewers agree this is fixable Step-1 build work, not a contract violation; converted to Constraint 2. |
| Predictive leverage | Pass (unanimous) | The document-vs-referent decoupling / false-completion prediction with its silence property (`analyst-eval-failures.md` ll.34-49, `worked-analyses.md` ex.5) is a falsifiable failure mode prompt-engineering vocabulary cannot produce, anchored in real traces with the hand-picked caveat verbatim. |
| Venue appropriateness | Pass (unanimous) | `design.md` ll.49-52 and `paper-layout-meta-review.md` ll.314-327 target position/synthesis/TMLR/JAIR/CSUR/arXiv and mark main-track benchmark venues weak absent new results. No benchmark claimed; correctly held to a position evidence standard, not a theorem or benchmark standard. |
| Tractable next step | Pass (unanimous) | `design.md` ll.307-323 scopes Step 1 to a local rewrite of `paper.md` / `check_sections.py` / eval docs; new theory, benchmarks, and Ailly CLI work out of scope; files verified on disk. The `check_sections.py` defect (stale REQUIRED list, exits 0 on failure) is repaired inside the same step. |

## Resolved Disagreements
- Agent C revised its position in cross-examination: it had scored Evidence 4/5 and called the protocol a transfer test, but on re-reading `design.md` ll.104-130 conceded it only asks readers to "use the steering vocabulary on a new agent pattern" with no held-out workflow, rubric, or scored prediction, and explicitly adopted Agent B's scored-transfer-test constraint. All three reviewers are now aligned on the transfer-test defect.
- Opposed (A, B) and supportive (C) reviewers converged on the evidence standard: Agent A's "scored blind failure-mode-prediction result, no new dataset or frequency claim" and Agent C's "decoupling survives with all geometry downgraded to analogy" both endorse Agent B's transfer test as the right evaluation-of-the-argument. No reviewer requires a theorem or a new benchmark.
- Agent A supplied the operative discriminator between gate-necessary and fix-during-writing novelty work: a boundary is gate-necessary when a *published* result could pre-claim the contribution (Bradley → engage in Section 2); it is fix-during-writing when the claim is the author's own analogy the literature neither makes nor contradicts (basin/metric → tag Status + Risk-if-wrong). The panel adopts this.
- All three independently identified the same executable-contract defect: `check_sections.py` ll.12-22 still hardcodes the rejected geometry-first 9-heading REQUIRED list and exits 0 while printing a failure, so the gate validates the wrong contract and is not actually red as `evals/README.md` claims. Treated as one Step-1 repair.

## Unresolved Minority Objections
- The single sharpest falsifiable form of the thesis is still undecided (`research.md` ll.189-195). Not a gate failure, but B warns the predictive section risks relabeling prompt engineering for the non-ReAct operators until it is pinned at holistic review.
- Four of six worked analyses lean on analogy rather than measured traces (A: ex.3/4/6); only ex.5 (ReAct false completion) is measured. Acceptable at a position standard but caps explanatory-leverage credit until more operators are anchored.
- The Ailly judge (`manifold.yaml` ll.13-22) does not verify the Does-not-support / Risk-if-wrong fields, so even after the ledger upgrade the automated gate under-enforces citation-drift protection unless the judge is extended (A's Best Continuation Constraint). B and C treat the judge bridge as deferred; A wants it in Step 1.

## Continuation Constraints
1. **Convert the Lit Group protocol into a scored transfer test** before any session counts as a pass. Edit `posts/llm_manifold/design.md` ll.104-130 to require: one held-out workflow no reader has seen (e.g. a Self-Consistency or reflexion variant absent from Section 5); a fixed five-field rubric (start point, target region, signal added, predicted failure mode, evidence) reusing `design.md` ll.183-188; a blind step where readers record the predicted failure mode *before* the author's analysis; and a pass criterion that a majority independently land on the lens's predicted failure mode above a prompt-engineering-only baseline. No new dataset, benchmark, theorem, or Ailly CLI work; the hand-picked-not-base-rate caveat (`worked-analyses.md` ll.11-15) is preserved verbatim. This is the defect Agent B vetoed on and all three now endorse.
2. **Rewrite `posts/llm_manifold/paper.md` to the contribution-first 10-section outline (`design.md` ll.161-204) AND make the gate match it.** (a) Rewrite `scripts/check_sections.py` (REQUIRED list ll.12-22) to enforce the contribution-first outline and exit non-zero on a missing/empty section; (b) replace the 4-column ledger at `paper.md` ll.63-74 with the 6-field schema (`design.md` ll.207-244), populating Does-not-support and Risk-if-wrong on every load-bearing row; (c) tag the basin row (`paper.md` row 7) and the continuous program-space metric row (row 5) as author-analogy/deferred per `design.md` l.241 with a populated Risk-if-wrong. A green eval must certify citation-drift protection, not merely section presence.
3. **Ship a non-empty Section 2 in the first third of `paper.md` that actively engages Bradley/Terilla/Vlassopoulos** (arXiv:2106.07890, 2501.06662), not merely the acknowledgment in ledger row 10 — gate-necessary because a published result could pre-claim the contribution. Include the ledger row at `design.md` ll.243-244 with a Does-not-support field stating where their construction stops and the workflow reading begins. Bind the thesis (Section 1/3) with the hedges Agent A specified: "as if", "region" rather than "manifold/basin", and an explicit denial of metric/basin/formalism.
4. **Lead Section 5 with the ReAct false-completion document-vs-referent example** from `analyst-eval-failures.md` ll.34-49 as the load-bearing worked analysis, carrying the "hand-picked, not a base rate" caveat verbatim.
5. **Add the five missing citation keys** to `posts/llm_manifold/refs.bib` (yao2023react, gao2023hyde, zhou2024lats, wang2023selfconsistency, chen2024agentless), so the non-false-completion operator predictions are literature-anchored.
6. **Extend the Ailly judge (`manifold.yaml` ll.13-22)** to verify Does-not-support and Risk-if-wrong on each load-bearing ledger row (A's Best Continuation Constraint). If deferred past Step 1, record it explicitly as a known gate-coverage gap in `evals/README.md`.
7. **At holistic review, pin the single sharpest falsifiable thesis form** (`research.md` ll.189-195) so the predictive section is a prediction, not a restatement of prompt engineering.

## Next Artifact
`posts/llm_manifold/paper.md` — rewritten to the contribution-first 10-section outline (`design.md` ll.161-204) with a non-empty Bradley-engaging Section 2 in the first third, the 6-field claim ledger replacing the 4-column table, and Section 5 led by the ReAct false-completion document-vs-referent example — shipped in lockstep with `scripts/check_sections.py` updated to enforce that same outline and exit non-zero on failure.

## Stop Conditions
- The scored transfer test (Constraint 1) is run and readers do NOT predict the lens's failure mode above the prompt-engineering-only baseline — the lens redescribes rather than improves workflows. Falsifies the core usefulness claim; pause-and-rescope or stop.
- Engaging Bradley et al. in Section 2 reveals a categorical/geometric claim IS load-bearing after all (the enriched-category-of-texts construction already delivers the workflow reading), collapsing the novelty boundary — a non-fixable novelty-honesty failure tending toward stop.
- The sharpest falsifiable thesis form cannot be pinned without smuggling in an unsupported metric/basin/formalism claim, leaving the predictive section a relabeling of prompt engineering — pause-and-rescope.
- Scope creep: if continuation comes to require a new theorem, a new benchmark, a held-out frequency/base-rate study, or Ailly CLI tooling to defend the thesis, the project has exceeded its position/synthesis standard — pause to rescope.
