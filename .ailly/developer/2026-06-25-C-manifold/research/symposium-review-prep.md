# Symposium Review Prep: Manifold Paper Continuation Decision

Date: 2026-06-29

Purpose: prepare an expert symposium to evaluate whether the LLM manifold
paper project is appropriate to continue, continue with constraints, pause for
rescope, or stop. This note evaluates the project materials as they exist now:
the research memo, contribution-first design, paper-layout meta-review,
worked-analysis notes, eval notes, and the current `posts/llm_manifold/paper.md`
skeleton.

## Materials Under Review

- `research.md`: establishes the core pivot from "new formalism" to
  synthesis/position paper, identifies the agentic-workflow lens as the real
  contribution, and records the highest-risk novelty and soundness boundaries.
- `design.md`: defines the project as a paper-writing project, gives the
  contribution-first outline contract, defines the Lit Group acceptance
  condition, and specifies the automated readiness gate.
- `research/paper-layout-meta-review.md`: translates venue-review expectations
  into a contribution-first paper structure and names rejection risks.
- `experiments/worked-analyses.md`: proposes the concrete examples that should
  prove the lens does work beyond rephrasing prompt engineering.
- `experiments/sources/*.md`: grounds the worked analyses in observed agentic
  systems, especially the Analyst false-completion failure mode.
- `posts/llm_manifold/paper.md`: current paper skeleton. It is still
  geometry-first and incomplete, so the symposium should evaluate project
  viability and the proposed contract, not treat the skeleton as submission
  prose.
- `posts/llm_manifold/evals/`: automated half of the Closing Bell. It is
  deliberately red today because the paper is still a skeleton.

## Run Packet

The reusable agent materials live under `research/symposium/`:

- `README.md`: index and intended use.
- `agent-a-formal-methods-background.md`: opposed formal-methods reviewer.
- `agent-b-empirical-eval-background.md`: opposed empirical-evaluation reviewer.
- `agent-c-systems-practitioner-background.md`: supportive systems-practitioner
  reviewer.
- `symposium-orchestration-prompt.md`: prompt for individual review, panel
  discussion, convergence, and final decision.

## Expert Panel Backgrounds

### Expert A: Formal Methods and Categorical Semantics Reviewer

Initial stance: opposed.

Background: senior researcher in formal semantics, category-theoretic language
models, denotational semantics, and program equivalence. Familiar with DisCoCat,
enriched categories of text, information geometry, program synthesis, and the
risks of mathematical vocabulary being used as metaphor.

Likely opening objection:

> The paper appears to repackage prior formal work under "document manifold" and
> "trajectory steering" language. Unless it proves a theorem or states a clean
> non-formal contribution, it risks being neither mathematics nor rigorous
> synthesis.

Primary review focus:

- Does Section 2 bound novelty early enough against Bradley/Terilla/Vlassopoulos,
  DisCoCat, information geometry, program synthesis, and manifold literature?
- Are mathematical claims tagged accurately as established, contested,
  author-analogy, or deferred?
- Does the claim ledger prevent citation drift by saying what each citation does
  not support?
- Is "document manifold" a useful organizing model, or does it smuggle in
  smoothness, topology, basins, or metric continuity that the paper cannot
  defend?

What could persuade this expert:

- The paper explicitly rejects "new formalism" as its contribution.
- The workflow-level lens is stated as a bounded synthesis and diagnostic
  vocabulary, not as a theorem.
- Every geometric or categorical phrase is either supported by a source,
  bounded as analogy, or removed.
- The alternatives section honestly explains why program synthesis, MDP/control,
  information geometry, and category theory are complements rather than
  strawmen.

Blind spot to compensate for:

- This reviewer may overweight formal novelty and underweight practical
  usefulness for engineers. The rubric should force a separate score for
  explanatory leverage and operational value.

### Expert B: Empirical LLM Evaluation and Agent Reliability Reviewer

Initial stance: opposed.

Background: applied ML researcher focused on LLM evaluation, agent benchmarks,
tool-use reliability, causal claims, and reproducibility. Familiar with ReAct,
Self-Debug, CRITIC, LATS, pass@k, self-consistency, and critiques such as
evaluation brittleness in agent papers.

Likely opening objection:

> This may be an elegant story, but without controlled experiments or a real
> reader study it may not establish that the lens predicts anything. Observed
> failures from hand-picked traces are useful examples, not evidence of rates or
> generality.

Primary review focus:

- Does the paper make at least one falsifiable prediction beyond "this is a nice
  metaphor"?
- Are observed Analyst failure modes used only for what they support: what can
  go wrong, not how often?
- Does the evaluation plan measure whether readers can use the lens on new
  agent patterns?
- Are external feedback, intrinsic self-correction, retrieval expansion,
  subagent search, and tree search evaluated with their different mechanisms and
  failure modes kept separate?
- Are the automated checks necessary but not oversold as sufficient for
  scholarly quality?

What could persuade this expert:

- The paper leads with the false-completion prediction for ReAct-style agents:
  the document trajectory can reach "done" while the referent never moves,
  especially when observations are weak or unread.
- The claim ledger clearly separates established literature from author analogy.
- The symposium or Lit Group protocol tests transfer: readers must classify a new
  workflow, identify steering moves, predict failure modes, and audit claims.
- The paper states that main-track benchmark venues are weak fits unless later
  work adds experiments.

Blind spot to compensate for:

- This reviewer may reject position/synthesis work for lacking a benchmark even
  when a position venue would allow a rigorous evaluative argument. The rubric
  should score venue-appropriate evidence, not benchmark evidence only.

### Expert C: Agentic Workflow Systems Practitioner

Initial stance: supportive.

Background: senior software engineer or research engineer who builds and debugs
LLM-powered development tools, eval harnesses, tool-using agents, and review
workflows. Familiar with red-green-refactor loops, trace analysis, eval
assertions, retrieval systems, subagents, and production failure modes.

Likely opening support:

> The lens names a pattern practitioners already use: prompts, tools, retries,
> evals, subagents, and search are steering operations. If the paper can make
> this precise enough to debug agent failures, it is worth continuing.

Primary review focus:

- Does the paper help a builder decide which steering operation to use for which
  failure mode?
- Does it distinguish document success from referent success in tool-using
  agents?
- Are the operator table, worked analyses, and checklist reusable by someone
  designing or reviewing an agent workflow?
- Does the eval plan capture what matters in practice: claims, tool calls,
  observed state changes, user follow-up, and whole-trajectory behavior?
- Is the next implementation path tractable in the current repo?

What could make this expert withdraw support:

- The paper stays geometry-first and buries the agentic workflow contribution.
- The worked examples remain summaries of known papers rather than operational
  diagnostics with predicted failure modes.
- The claim ledger becomes a citation table instead of a risk-control device.
- The project continues to add scope, especially new formal theory or a new
  benchmark, before the synthesis paper is coherent.

Blind spot to compensate for:

- This reviewer may forgive weak novelty or formal precision if the lens feels
  useful. The rubric should give opposing reviewers veto power over novelty and
  soundness hard gates.

## Symposium Decision Rubric

### Decision Outcomes

- **Continue:** proceed with the contribution-first paper project as designed.
- **Continue with constraints:** continue only after recording specific blocking
  fixes as project steps.
- **Pause and rescope:** stop prose work until the thesis, venue, or evidence
  contract is narrowed.
- **Stop:** discontinue the project in its current form because the contribution
  is subsumed, unsupported, or not appropriate for the stated circulation goals.

### Hard Gates

Any hard-gate failure prevents an unconditional continue, regardless of score.

| Gate | Pass condition | Fail signal |
|---|---|---|
| Novelty honesty | The paper clearly says the contribution is the workflow-level lens, not a new manifold, category, or information-geometric formalism. | It claims novelty for vocabulary already occupied by prior art. |
| Claim discipline | Every load-bearing claim can be classified as established, contested, author-analogy, or deferred, with support boundaries. | The paper cites sources for stronger claims than they actually support. |
| Predictive leverage | The lens predicts at least one failure mode or boundary condition that a generic prompt-engineering story would miss. | "Steering" only renames prompts, retries, and tools. |
| Venue appropriateness | The project targets position/synthesis-friendly circulation unless new empirical or theoretical results are added. | The paper aims at a main-track benchmark/theory venue without benchmark/theory evidence. |
| Tractable next step | The next build step is a bounded rewrite of the outline, ledger, and eval contract, not an expanding research program. | The project requires proving a new theorem, building a benchmark, or finishing unrelated tooling before any paper value appears. |

### Weighted Scorecard

Score each criterion from 1 to 5, then apply the weight. A score of 3 means
"adequate for continuation with fixable issues"; 5 means "strong and ready to
build on"; 1 means "blocking or nearly blocking."

| Criterion | Weight | What a high score requires |
|---|---:|---|
| 1. Thesis and contribution fit | 15 | A reader can state the thesis as "agent workflows are steering operators on a document/syntactic trajectory" and distinguish it from the already-published formal work. |
| 2. Novelty boundary and prior-art respect | 20 | Bradley/Terilla/Vlassopoulos, DisCoCat, information geometry, program synthesis, manifold/union-of-manifolds, CoT expressivity, and self-correction work are handled before the paper asks for trust. |
| 3. Soundness and claim ledger quality | 20 | The ledger records claim, status, support, does-not-support, paper section, and risk-if-wrong; caveats are visible in the main argument. |
| 4. Evidence and evaluation plan | 20 | The automated checks gate mechanics, and the human symposium/Lit Group tests whether readers can apply the lens to new workflows and audit claims. |
| 5. Explanatory leverage for agentic workflows | 15 | Worked analyses predict concrete failure modes: false completion, intrinsic self-correction limits, empty-neighborhood HyDE hallucination, branch collapse, value-signal failure in tree search. |
| 6. Execution tractability | 10 | The next steps are local to `posts/llm_manifold/paper.md`, `refs.bib`, and `evals/`; the project does not depend on new theory, benchmark infrastructure, or unrelated Ailly CLI work. |

Total score: 100 points.

### Score Interpretation

- **85-100 and no hard-gate failures:** continue.
- **70-84 and no hard-gate failures:** continue with constraints. The symposium
  must name the constraints and assign them to concrete build steps.
- **55-69, or one hard-gate failure that is clearly fixable:** pause and
  rescope. Resume only after the blocking issue is rewritten and reviewed.
- **Below 55, or any non-fixable hard-gate failure:** stop in this form.

### Expert-Specific Veto Rules

- Expert A can veto continuation if novelty honesty or claim discipline fails.
- Expert B can veto continuation if predictive leverage or evaluation plan fails.
- Expert C can veto continuation if the paper cannot explain an actionable
  workflow diagnostic after the contribution-first rewrite.
- A veto does not automatically mean "stop"; it forces "continue with
  constraints" or "pause and rescope" unless the panel agrees the defect is not
  fixable within the project.

### Required Symposium Questions

Each expert answers these before scoring:

1. What is the project's claimed contribution in one sentence?
2. Which prior work most threatens that contribution?
3. Which claim is most likely to be overstated?
4. What is the strongest evidence that the lens does work beyond metaphor?
5. What would have to change for you to recommend continuation?
6. If the project continues, what is the next concrete artifact that must improve?

### Continuation Contract

If the project continues, the next build phase should be constrained to:

1. Rewrite `posts/llm_manifold/paper.md` to the contribution-first outline.
2. Upgrade the claim ledger to the richer schema from `design.md`.
3. Move prior-art and novelty boundaries into the first third of the paper.
4. Add the steering-operator table and make it the load-bearing contribution.
5. Promote the false-completion/ReAct example as the strongest predictive worked
   analysis, with the hand-picked-trace caveat intact.
6. Keep `posts/llm_manifold/evals/` red until the paper satisfies the structural,
   citation, pandoc, and claim-ledger checks.

The project should not continue by adding new theorem work, a new benchmark, or
new Ailly CLI infrastructure before these six steps have produced a coherent
paper skeleton.

## Rubric Review

### Correctness

Finding: the rubric is aligned with the current project documents. It treats the
current `paper.md` as an incomplete skeleton, not as final prose. It preserves
the central design decision that the project is a synthesis/position paper whose
contribution is the workflow-level lens. It carries the main caveats from the
research and meta-review: novelty is bounded by prior formal work; geometry is
often analogy; observed Analyst traces are evidence of failure modes, not base
rates; and the automated eval is necessary but not sufficient.

Revision made: the hard gates separate "venue appropriateness" from "evidence
and evaluation" so an empirical reviewer cannot require a benchmark when a
position/synthesis venue would accept a strong argument, but also cannot let the
paper proceed without predictive leverage.

### Completeness

Finding: the rubric covers the user's requested dimensions: expert backgrounds,
appropriateness, continuation decision, and rubric review. It also covers the
project-specific risks already named in the materials: overclaiming formal
novelty, metaphor without leverage, citation drift, geometry-first structure,
and tractability.

Remaining gap: the rubric does not assign actual scores because the symposium
has not read a completed contribution-first paper. That is intentional. Scoring
the current skeleton would mostly measure incompleteness, not project viability.

### Clarity

Finding: the rubric is operational enough for the panel to use. The hard gates
state pass/fail signals, the scorecard gives weights, and the continuation
contract converts a "continue" decision into concrete next work.

Revision made: expert vetoes are framed as escalation to constraints or rescope,
not as automatic cancellation. This prevents the two initially opposed experts
from ending the project for fixable defects while still preserving their
authority over novelty, soundness, and evaluation.

### Conciseness

Finding: the artifact is longer than a meeting agenda but short enough to serve
as the symposium packet. The length is justified because it must brief three
different expert roles and encode the decision rules before the user returns.

Tightening applied: the rubric uses one 100-point scorecard rather than separate
scorecards for each expert, and it moves repeated concerns into hard gates plus
expert-specific veto rules.

### Overall Review Verdict

The rubric is fit for the next symposium stage. Its main strength is that it
does not let the supportive practitioner enthusiasm override novelty and
soundness, and it does not let the opposed reviewers collapse a position paper
into a demand for a theorem or benchmark. The decision rules should produce one
of three useful outcomes: continue with the current contribution-first plan,
continue with named constraints, or pause for a narrow rescope.
