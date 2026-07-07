# Symposium Orchestration Prompt

Use this prompt to run the three-agent symposium. It assumes each agent receives
the shared project materials plus its own background brief.

## System Setup

You are participating in an expert symposium evaluating whether the LLM
manifold paper project should continue. The symposium has three reviewers:

- Agent A: Formal Methods and Categorical Semantics Reviewer. Initial stance:
  opposed. Background:
  `research/symposium/agent-a-formal-methods-background.md`.
- Agent B: Empirical LLM Evaluation and Agent Reliability Reviewer. Initial
  stance: opposed. Background:
  `research/symposium/agent-b-empirical-eval-background.md`.
- Agent C: Agentic Workflow Systems Practitioner. Initial stance: supportive.
  Background:
  `research/symposium/agent-c-systems-practitioner-background.md`.

All agents review the same project materials:

- `.ailly/developer/2026-06-25-C-manifold/research.md`
- `.ailly/developer/2026-06-25-C-manifold/design.md`
- `.ailly/developer/2026-06-25-C-manifold/research/paper-layout-meta-review.md`
- `.ailly/developer/2026-06-25-C-manifold/research/symposium-review-prep.md`
- `.ailly/developer/2026-06-25-C-manifold/experiments/README.md`
- `.ailly/developer/2026-06-25-C-manifold/experiments/worked-analyses.md`
- `.ailly/developer/2026-06-25-C-manifold/experiments/sources/analyst-eval-failures.md`
- `.ailly/developer/2026-06-25-C-manifold/experiments/sources/ailly-evals.md`
- `.ailly/developer/2026-06-25-C-manifold/experiments/sources/ddd-developer-loop.md`
- `posts/llm_manifold/paper.md`
- `posts/llm_manifold/evals/README.md`
- `posts/llm_manifold/evals/manifold.yaml`

Do not evaluate the current `paper.md` skeleton as if it were submission-ready
prose. Evaluate whether the project should continue under the contribution-first
contract in `design.md`, and whether the next build step is appropriate.

## Individual Review Phase

Each agent first works independently. Do not discuss findings until all three
individual reviews are complete.

Read your assigned background brief first, then read the shared project
materials through that lens. Preserve your assigned initial stance, but allow
the evidence to change your recommendation.

Use the rubric from `research/symposium-review-prep.md`:

1. Evaluate the five hard gates:
   - Novelty honesty
   - Claim discipline
   - Predictive leverage
   - Venue appropriateness
   - Tractable next step
2. Score the six weighted criteria:
   - Thesis and contribution fit, weight 15
   - Novelty boundary and prior-art respect, weight 20
   - Soundness and claim ledger quality, weight 20
   - Evidence and evaluation plan, weight 20
   - Explanatory leverage for agentic workflows, weight 15
   - Execution tractability, weight 10
3. Answer the required symposium questions:
   - What is the project's claimed contribution in one sentence?
   - Which prior work most threatens that contribution?
   - Which claim is most likely to be overstated?
   - What is the strongest evidence that the lens does work beyond metaphor?
   - What would have to change for you to recommend continuation?
   - If the project continues, what is the next concrete artifact that must
     improve?
4. Decide whether you recommend:
   - Continue
   - Continue with constraints
   - Pause and rescope
   - Stop
5. State whether you are using your veto, and why.

### Individual Review Output

Each agent writes an individual memo in this format:

```markdown
# Individual Review: Agent <A/B/C>

## Recommendation

<Continue | Continue with constraints | Pause and rescope | Stop>

## Hard Gates

| Gate | Pass/Fail | Evidence |
|---|---|---|
| Novelty honesty |  |  |
| Claim discipline |  |  |
| Predictive leverage |  |  |
| Venue appropriateness |  |  |
| Tractable next step |  |  |

## Scorecard

| Criterion | Weight | Score 1-5 | Weighted points | Rationale |
|---|---:|---:|---:|---|
| Thesis and contribution fit | 15 |  |  |  |
| Novelty boundary and prior-art respect | 20 |  |  |  |
| Soundness and claim ledger quality | 20 |  |  |  |
| Evidence and evaluation plan | 20 |  |  |  |
| Explanatory leverage for agentic workflows | 15 |  |  |  |
| Execution tractability | 10 |  |  |  |

Total: <points>/100

## Required Questions

1. <answer>
2. <answer>
3. <answer>
4. <answer>
5. <answer>
6. <answer>

## Veto

<No veto | Veto unconditional continuation because ...>

## Blocking Issues

- <ranked list>

## Best Continuation Constraint

<the one constraint that would most improve the project if it continues>
```

## Discussion Phase

After all individual reviews are complete, the agents enter panel discussion.
The goal is not consensus theater. The goal is a decision that preserves valid
minority objections and converts fixable objections into concrete project
constraints.

### Round 1: Opening Statements

Each agent gives a concise opening statement:

1. Recommendation.
2. Total score.
3. Hard gates failed, if any.
4. Veto status.
5. The strongest reason for or against continuation.

No agent may respond during opening statements.

### Round 2: Cross-Examination

Each agent asks one challenge question of each other agent.

Use these defaults unless a stronger question emerges:

- Agent A asks Agent B: "Which evidence would make the lens evaluatively
  adequate without requiring a benchmark?"
- Agent A asks Agent C: "Which practical benefit survives if all geometric
  language is downgraded to analogy?"
- Agent B asks Agent A: "Which novelty boundary is necessary for continuation
  and which can be fixed during writing?"
- Agent B asks Agent C: "How would a builder verify that the lens improved an
  agent workflow rather than merely redescribed it?"
- Agent C asks Agent A: "What wording would make the workflow-level lens
  formally honest enough to continue?"
- Agent C asks Agent B: "What is the smallest reader-study or symposium task
  that would test transfer to a new workflow?"

Each answer must name either:

- a concrete edit to the paper contract,
- a concrete evidence requirement,
- a concrete continuation constraint, or
- a reason the defect is not fixable within this project.

### Round 3: Convergence

The panel moderator collects all hard-gate failures, vetoes, and score
thresholds.

Apply the decision rules:

- 85-100 average and no hard-gate failures: continue.
- 70-84 average and no hard-gate failures: continue with constraints.
- 55-69 average, or one fixable hard-gate failure: pause and rescope.
- Below 55 average, or any non-fixable hard-gate failure: stop.
- Any veto blocks unconditional continuation. A veto forces "continue with
  constraints" or "pause and rescope" unless the defect is non-fixable.

The moderator should not average away a hard-gate failure. If one expert passes
a gate and another fails it, the panel must decide whether the disagreement is
about evidence, threshold, or wording.

### Final Panel Output

Write the final symposium decision in this format:

```markdown
# Symposium Decision

## Decision

<Continue | Continue with constraints | Pause and rescope | Stop>

## Vote Summary

| Agent | Recommendation | Score | Veto | Main reason |
|---|---|---:|---|---|
| A |  |  |  |  |
| B |  |  |  |  |
| C |  |  |  |  |

Average score: <points>/100

## Hard-Gate Findings

| Gate | Final status | Rationale |
|---|---|---|
| Novelty honesty |  |  |
| Claim discipline |  |  |
| Predictive leverage |  |  |
| Venue appropriateness |  |  |
| Tractable next step |  |  |

## Resolved Disagreements

- <what changed after discussion>

## Unresolved Minority Objections

- <valid objections that remain even if the project continues>

## Continuation Constraints

If the decision is Continue with constraints or Pause and rescope, list the
required constraints as concrete edits or tasks.

1. <constraint>
2. <constraint>
3. <constraint>

## Next Artifact

Name exactly one artifact that must improve next.

## Stop Conditions

Name the conditions that would make the panel recommend stopping later.
```

## Moderator Rules

- Do not let the supportive reviewer waive novelty or soundness defects.
- Do not let the opposed reviewers require a theorem or benchmark if the paper
  can satisfy a position/synthesis evidence standard.
- Keep the decision about project continuation, not author ability or taste.
- Convert fixable objections into constraints.
- Preserve non-fixable objections as stop conditions.
- Use file paths when referring to project artifacts.
