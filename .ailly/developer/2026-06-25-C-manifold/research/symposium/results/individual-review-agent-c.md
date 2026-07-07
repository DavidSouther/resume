# Individual Review: Agent C

## Recommendation
Continue with constraints

## Hard Gates
| Gate | Pass/Fail | Evidence |
|---|---|---|
| Novelty honesty | Pass | research.md ll.116-145 refutes the 'new formalism' framing and names Bradley/Terilla/Vlassopoulos (2021/2025), DisCoCat, Amari, mode connectivity as prior art; design.md ll.45-48 states the paper is not a new theorem or categorical formalism; design.md Section 2 contract forces a prior-art-vs-additions table before the reader trusts the paper. |
| Claim discipline | Pass | design.md ll.207-245 defines the six-field ledger (Claim/Status/Support/Does-not-support/Section/Risk-if-wrong) with correct established/contested/author-analogy rows; worked-analyses.md splits external vs intrinsic feedback and carries the 'hand-picked, not random' caveat. The current paper.md ledger is incomplete, but completing it IS the build work, not a contract violation (fixable: Yes, and is the planned step). |
| Predictive leverage | Pass | Document-vs-referent decoupling predicts false completion and its silence — two-thirds of failing cases emit no error (analyst-eval-failures.md ll.34-49). Every operator has a predicted failure mode (worked-analyses.md ll.20-29). Meets the brief's standard. |
| Venue appropriateness | Pass | design.md ll.49-52 and meta-review ll.314-327 target position/synthesis/TMLR/JAIR/arXiv and mark main-track benchmark venues as weak fits absent experiments; AAAI-26 integrative track named. |
| Tractable next step | Pass | design.md ll.307-309 scopes the next step to a local rewrite of paper.md/checker/eval docs; new theory and benchmarks explicitly out of scope; standalone checkers run today without the Ailly CLI. |

## Scorecard
| Criterion | Weight | Score 1-5 | Weighted points | Rationale |
|---|---:|---:|---:|---|
| Thesis and contribution fit | 15 | 4 | 12 | Crisp, restatable thesis (design.md ll.40-48); sharpest falsifiable form still unsettled (research.md l.195). |
| Novelty boundary and prior-art respect | 20 | 4 | 16 | Disciplined prior-art handling (research.md ll.102-113); Section 2 table mandated but not yet in prose. |
| Soundness and claim ledger quality | 20 | 4 | 16 | Six-field schema is a real risk-control device; current paper.md ledger missing does-not-support and five bib keys absent. |
| Evidence and evaluation plan | 20 | 4 | 16 | Separates mechanical gating from argument quality; tests transfer; Ailly judge bridge deferred. |
| Explanatory leverage for agentic workflows | 15 | 5 | 15 | Concrete builder diagnostics: false completion, empty-neighborhood HyDE, branch collapse, CoT flat-return, LATS dead-ends. The document/referent split is the cleanest practical payoff. |
| Execution tractability | 10 | 4 | 8 | Bounded, dependency-free next step; checker must be updated in lockstep with the outline (it still hardcodes the old headings). |

Total: 83/100

## Required Questions
1. Agentic LLM workflows can be read as a sequence of steering operators moving generation through document/syntactic space toward a target region of acceptable artifacts, and that reading is a usable diagnostic lens.
2. Bradley/Terilla/Vlassopoulos's enriched category of texts with next-token LM probabilities (2025) — it subsumes any categorical/manifold formalism novelty; the project survives only by claiming the workflow reading.
3. The claim that distinct samples/subagents/branches cover distinct document-space regions, and the single-pass correct/incorrect 'basin' — no theorem exists (research.md ll.80-85); must stay author-analogy.
4. The Analyst traces: a ReAct agent's document reaches 'done' while the referent never moved, ~two-thirds silently — a measured (hand-picked) failure the lens predicts and prompt-engineering cannot.
5. Nothing more to keep my supportive recommendation; for an unconditional continue I need design step 1 executed (Section 2 table in prose, six-field ledger with does-not-support, five missing keys, checker updated).
6. The rewritten posts/llm_manifold/paper.md and its check_sections.py, with Section 4 operator table and Section 5 led by the ReAct false-completion example.

## Veto
No veto. The lens already explains an actionable diagnostic after the planned rewrite, and the design defers all new theory/benchmark/tooling scope, so neither veto condition in my brief is met. My concerns force "continue with constraints," not cancellation.

## Blocking Issues
- Execute design step 1: replace the geometry-first paper.md and update check_sections.py, which still hardcodes the OLD 9-heading geometry-first REQUIRED list (verified) — the gate currently validates the wrong contract.
- Upgrade the in-paper ledger to the six-field schema with does-not-support and risk-if-wrong populated; without does-not-support it cannot stop citation drift.
- Add the five missing worked-analysis keys (yao2023react, gao2023hyde, zhou2024lats, wang2023selfconsistency, chen2024agentless — all confirmed absent from refs.bib).
- Pin the single sharpest falsifiable thesis form (research.md open item 2) at holistic review so the predictive section is not a restatement.
- Lead Section 5 with the ReAct false-completion document-vs-referent example, carrying the 'hand-picked, not a base rate' caveat verbatim.

## Best Continuation Constraint
Constrain the next phase to design step 1 only — rewrite paper.md to the contribution-first outline, update check_sections.py to enforce that same outline, populate the six-field ledger, and add the five missing citation keys, with the ReAct false-completion decoupling as the load-bearing worked analysis — adding no new theory, benchmark, or Ailly CLI work until that produces a coherent skeleton that turns the eval green.
