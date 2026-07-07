# Individual Review: Agent B

## Recommendation

Continue with constraints

## Hard Gates

| Gate | Pass/Fail | Evidence |
|---|---|---|
| Novelty honesty | Pass | `research.md` and `design.md` explicitly abandon the new-formalism claim and define the contribution as the workflow-level steering lens, not "LLMs are manifolds" or a new categorical model. The current `paper.md` skeleton is still geometry-first, so this pass depends on the contribution-first rewrite. |
| Claim discipline | Pass | `design.md` requires a richer claim ledger with `Support`, `Does not support`, section, and risk-if-wrong fields. This is the right control for citation drift, but it is not yet implemented in `paper.md`. |
| Predictive leverage | Pass | The strongest prediction is concrete: in ReAct-style tool agents, weak or unread observations let the document trajectory say "done" while the referent state never changes. `analyst-eval-failures.md` reports false completion and silent failures in hand-picked production traces. |
| Venue appropriateness | Pass | The contract targets a synthesis/position paper, Lit Group review, arXiv-first/workshop-style circulation, and explicitly rejects main-track benchmark/theory claims unless new empirical or theoretical work is added. |
| Tractable next step | Pass | The next step is local and bounded: rewrite `posts/llm_manifold/paper.md` to the contribution-first outline, upgrade the ledger, and keep `posts/llm_manifold/evals/` red until structural, citation, pandoc, and ledger checks pass. |

## Scorecard

| Criterion | Weight | Score 1-5 | Weighted points | Rationale |
|---|---:|---:|---:|---|
| Thesis and contribution fit | 15 | 4 | 12 | The claimed contribution is now understandable: compare agentic patterns as steering operators over document/syntactic trajectories. It still needs to be made the first-page thesis in `paper.md`. |
| Novelty boundary and prior-art respect | 20 | 4 | 16 | The materials handle Bradley/Terilla/Vlassopoulos, DisCoCat, information geometry, program synthesis, CoT expressivity, and self-correction honestly. The risk is implementation drift when the prose is written. |
| Soundness and claim ledger quality | 20 | 3 | 12 | The ledger design is strong, especially the `Does not support` and `Risk if wrong` fields. The current skeleton ledger is too thin, so soundness is planned rather than demonstrated. |
| Evidence and evaluation plan | 20 | 3 | 12 | The Analyst traces and worked analyses give venue-appropriate examples, and the Lit Group plan can test transfer. The current protocol is not yet concrete enough to show that new readers can apply the lens to unseen workflows. |
| Explanatory leverage for agentic workflows | 15 | 4 | 12 | False completion, intrinsic-vs-external correction, empty-neighborhood HyDE hallucination, branch collapse, and value-signal failure are real diagnostic predictions rather than labels. |
| Execution tractability | 10 | 4 | 8 | The continuation plan is scoped to the paper, ledger, bibliography, and colocated evals. It does not require a new benchmark, theorem, or Ailly CLI infrastructure before paper value appears. |

Total: 72/100

## Required Questions

1. The project's claimed contribution is a synthesis lens that reads LLM agent workflows as sequences of steering operators that move document/syntactic trajectories toward task-local target regions.
2. The most dangerous prior work for the overall project is Bradley/Terilla/Vlassopoulos for geometric/categorical novelty; for the workflow contribution, ReAct, Self-Debug/CRITIC, LATS, and agent-evaluation work threaten to make the lens look like relabeling unless the paper shows extra predictive leverage.
3. The claim most likely to be overstated is that the Analyst false-completion evidence generalizes beyond observed hand-picked traces; it supports "this failure occurs" and a mechanism hypothesis, not prevalence.
4. The strongest evidence beyond metaphor is the Analyst false-completion pattern: the lens predicts document/referent decoupling under weak observation channels, including silent failures where the assistant narrates success without external state change.
5. For continuation, the project must make the transfer evaluation explicit: readers must apply the steering lens to a new workflow, identify steering moves, predict failure modes, audit claim support, and distinguish observed failures from general results.
6. The next concrete artifact that must improve is `posts/llm_manifold/paper.md`, starting with the contribution-first outline, the steering-operator table, and the upgraded claim ledger.

## Veto

Veto unconditional continuation because the project should not proceed as ordinary prose expansion until the read-cold transfer protocol and richer claim ledger are implemented; the automated eval is necessary but not sufficient evidence of scholarly adequacy.

## Blocking Issues

- The Lit Group protocol must become an executable review task, not just a discussion agenda: at least one unseen agent workflow or trace should be classified by readers using the lens.
- The current `paper.md` skeleton is still geometry-first and risks inviting rejection before the workflow contribution is visible.
- The claim ledger in `paper.md` lacks `Support`, `Does not support`, `Paper section`, and `Risk if wrong`, so it cannot yet prevent citation drift.
- Analyst traces must carry the hand-picked-not-random caveat anywhere counts or "most common" language appears.
- The paper must keep external execution/tool feedback separate from intrinsic self-correction and must not let "steering" flatten distinct mechanisms into one slogan.
- The eval documentation must continue to say that script checks and the intended judge gate are readiness controls, not proof that the argument is correct.

## Best Continuation Constraint

Before expanding prose section-by-section, add a concrete transfer-test artifact to the review packet: give Lit Group readers a new agent workflow or trace and require them to identify the target region, steering operators, referent checks, predicted failure modes, claim statuses, and evidence boundaries; continuation should depend on readers applying that protocol without blocking novelty, soundness, or evaluation objections.
