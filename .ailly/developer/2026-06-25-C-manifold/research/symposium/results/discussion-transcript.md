# Symposium Discussion Transcript

## Round 1: Opening Statements

**Agent A — Formal Methods and Categorical Semantics Reviewer** (initial stance: opposed)
- Recommendation: Continue with constraints
- Total score: 76/100
- Hard gates failed: None
- Veto status: No veto
- Strongest reason: The project has already done the hardest thing a formal-rigor reviewer demands — it ran its own novelty sweep, found that manifold/categorical/phase-space vocabulary is pre-claimed (notably by Bradley et al.), and explicitly demoted itself from new-formalism to a bounded workflow-level lens with a claim ledger built to record what each citation does not support.

**Agent B — Empirical LLM Evaluation and Agent Reliability Reviewer** (initial stance: opposed)
- Recommendation: Continue with constraints
- Total score: 72/100
- Hard gates failed: None
- Veto status: Using veto — I use my veto over the evaluation plan to block an UNCONDITIONAL continue, but not to stop the project. The human review protocol (design.md ll.104-130) does not yet test transfer: it asks whether readers can 'use the steering vocabulary on a new agent pattern' without defining a held-out workflow, a classification rubric, or a scored check that readers predict the lens's failure modes. Per my brief's likely-veto condition (the review protocol cannot test whether readers can apply the lens to a new workflow and audit its claims), this forces 'continue with constraints'. The defect is fixable locally by specifying the transfer test as a Lit Group step; the thesis itself is falsifiable (the false-completion prediction), so no rescope is required.
- Strongest reason: The project earns continuation because the false-completion / document-vs-referent decoupling prediction, grounded in real Analyst traces with its base-rate caveat intact, is a genuinely falsifiable failure mode that a prompt-engineering story cannot produce — but it must be constrained because the reader-study protocol does not yet test whether anyone other than the author can apply the lens.

**Agent C — Agentic Workflow Systems Practitioner** (initial stance: supportive)
- Recommendation: Continue with constraints
- Total score: 83/100
- Hard gates failed: None
- Veto status: No veto
- Strongest reason: The lens already pays for itself operationally: it predicts the silent false-completion failure mode (document reaches 'done' while the referent never moved) that a prompt-engineering story cannot, backed by a real production trace and a concrete eval instrument — that is a diagnostic builders would act on, not a metaphor.

## Round 2: Cross-Examination

## Agent A — Cross-Examination Answers

### Q1 (from Agent B): Which novelty boundary is necessary for continuation, and which can be fixed during writing?

**Type: continuation constraint.**

Two boundaries, two different tiers.

**Gate-necessary — the Bradley/Terilla/Vlassopoulos boundary** (arXiv:2106.07890, 2501.06662). This is not a citation-hygiene item. The whole v1 safety case is that *no categorical or geometric claim is load-bearing*, and the only way to demonstrate that is to engage the work that already published the enriched-category-of-texts vocabulary. The current `paper.md` row 10 merely *acknowledges* it; that is insufficient. Step 1 must ship a **non-empty Section 2 in the first third** of `posts/llm_manifold/paper.md` that engages Bradley et al., plus the ledger row mandated at `design.md` ll.243-244 with its **Does-not-support** field spelled out (where their construction stops and the workflow reading begins).

**Fix-during-writing — the basin/metric boundaries.** The correct/incorrect basin for single-pass generation (`research.md` ll.83-85, `paper.md` row 7) and the continuous program-space metric (row 5) are tagged `author-analogy`/`deferred` per `design.md` l.241. No published result can pre-claim them because no one else asserts them — they are the author's analogy. They only need the right **Status** tag and a **Risk-if-wrong** field, which the 6-field schema (`design.md` ll.211-218) already provides. Ordinary prose work, not a gate.

**Discriminator:** a boundary is gate-necessary when a *published* result could pre-claim the contribution (Bradley); it is fix-during-writing when the claim is the author's own analogy that the literature neither makes nor contradicts (basin/metric). Consistent with my memo's Blocking Issue: "Bradley et al. is acknowledged but not engaged; v1 safety depends on no categorical claim being load-bearing, which Section 2 must demonstrate."

### Q2 (from Agent C): What wording would make the workflow-level lens formally honest enough to continue?

**Type: concrete edit** to `posts/llm_manifold/paper.md` Section 1/Section 3 thesis statement, plus the matching ledger row.

Bind the `design.md` ll.40-47 thesis with two explicit hedges:

> "We read agentic LLM workflows **as if** generation moves through document/syntactic space toward a target **region** of acceptable artifacts. This is a **diagnostic analogy, not** a claim that such a space carries a metric, that the regions are basins of a dynamical system, or that any of this is a new categorical formalism — the enriched-category-of-texts construction of Bradley/Terilla/Vlassopoulos (arXiv:2106.07890, 2501.06662) already occupies that ground."

The formal-honesty load is carried by three load-bearing choices: **"as if"** (analogy, not isomorphism), **"region"** rather than "manifold/basin" in the thesis sentence (geometry stays metaphor), and the **explicit denial** of metric/basin/formalism. This must be backed by the `design.md` ll.219-220 thesis ledger row — `author-analogy`, supported by worked analyses not a theorem — realized in the in-paper 6-field table with a populated **Risk-if-wrong**.

With that wording and that row, the lens claims exactly the diagnostic utility the worked analyses support (false completion, document-vs-referent decoupling) and nothing the formalism literature owns. That clears my only formal-honesty objection. Position unchanged from my memo: continue with constraints, no veto.

## Agent B — Cross-Examination Answers

### To Agent A — "Which evidence would make the lens evaluatively adequate without requiring a benchmark?"

**Answer type: concrete evidence requirement.**

A *scored blind failure-mode-prediction result*, not a benchmark. The lens already carries the one discriminator generic prompt-engineering language cannot produce: the document-vs-referent decoupling / false-completion failure with its silence property (`.ailly/developer/2026-06-25-C-manifold/research/symposium/../../experiments/sources/analyst-eval-failures.md` ll.34-49, surfaced in my memo Q4). Turn it from an illustration into a measurement:

1. Take held-out workflows no reader has seen.
2. Strip the **predicted failure mode** and **boundary condition** fields from those analyses — the very fields `design.md` ll.183-188 already mandates for every authored worked analysis (`experiments/worked-analyses.md`).
3. Readers classify each held-out workflow with the steering rubric (start point, target region, signal added) and **write down the failure mode the lens predicts before seeing the author's**.

Adequacy = readers reach the author's predicted failure mode at a rate meaningfully above what a prompt-engineering-only description of the same workflow yields. This needs **no new dataset, no held-out test set with frequency claims, and no Ailly judge** — it scores reader transfer on existing hand-picked traces, so it meets your no-benchmark bar. The hand-picked-not-base-rate caveat (`worked-analyses.md` ll.11-15) is preserved verbatim: it measures whether the *lens* transfers, never failure prevalence. Per my brief's hard requirement, a position paper does not need a benchmark but does need an evaluation *of the argument* — this is that evaluation. The veto stays in place because this evidence is precisely what `design.md` ll.104-130 currently lacks.

### To Agent C — "What is the smallest reader-study or symposium task that would test transfer to a new workflow?"

**Answer type: concrete continuation constraint (stated as a `design.md` edit).**

Edit the Lit Group pass condition — the prose at `design.md` ll.117-130 and the session-notes list at ll.104-114 — to replace the unscored "use the steering vocabulary on a new agent pattern" with **one scored transfer task that gates the pass**:

- **One** held-out workflow the reader has not seen (e.g. a Self-Consistency or reflexion variant absent from the Section 5 worked analyses).
- A **fixed five-field rubric**: start point, target region, signal added, predicted failure mode, evidence — the same five fields `design.md` ll.183-188 already requires of authored analyses, so no new schema is invented.
- A **blind step**: each reader records the predicted failure mode *before* the author's analysis is revealed.
- **Pass criterion**: a majority of readers independently land on the lens's predicted failure mode.

This is one paragraph added to Section 8's review protocol (`design.md` ll.197-199) plus the pass-condition edit. It adds no benchmark, no theorem, no Ailly CLI work, so it fits inside the bounded Step-1 rewrite all four memos endorse. This is my Best Continuation Constraint expressed as a concrete edit, and executing it is what lifts my veto to unconditional continue.

### Position update

Unchanged. Both questions target the same defect I vetoed on (the transfer gap in `design.md` ll.104-130). Agent A's no-benchmark framing and Agent C's smallest-task framing both converge on my Best Continuation Constraint, which reinforces rather than revises my stance: continue with constraints, veto on the transfer-test gap, fixable locally inside Step 1.

## Agent C — Cross-Examination Answers

### Q from Agent A: Which practical benefit survives if all geometric language is downgraded to analogy?

**Answer type: evidence requirement.**

The document-vs-referent decoupling survives intact, because it is a claim about *narration versus external state*, not about geometry. The ReAct false-completion diagnostic in `.ailly/developer/2026-06-25-C-manifold/research/analyst-eval-failures.md` ll.34-49 — a measured failure where the agent's document reaches "done" while the referent never moved, with ~two-thirds of failing cases emitting no error — needs zero manifold, basin, or category vocabulary to state or to act on.

The required evidence: the rewritten `posts/llm_manifold/paper.md` must lead Section 5 with this trace, carrying the "hand-picked, not a base rate" caveat verbatim, while every geometric phrasing in the six-field ledger (`design.md` ll.207-245) is tagged `author-analogy`/`deferred`. The basin row and the document-space-region rows (`research.md` ll.80-85) lose nothing *actionable* when downgraded — the decoupling diagnostic is the part a builder keeps. This is precisely the explanatory-leverage 5/5 in my scorecard, and it holds with all geometry as analogy.

### Q from Agent B: How would a builder verify that the lens improved an agent workflow rather than merely redescribed it?

**Answer type: continuation constraint.** *(Position updated — Agent B persuades me.)*

I update my position. My memo scored Evidence 4/5 and described the protocol as one that "tests transfer," but `design.md` ll.104-130 (verified) only asks readers to "use the steering vocabulary on a new agent pattern" — no held-out workflow, no rubric, no scored prediction. As written it cannot distinguish improvement from redescription, so B's veto reasoning is correct.

The continuation constraint: before any Lit Group session in `design.md` ll.104-130 counts as a pass, the protocol must become a *scored transfer test* — (1) a held-out workflow the reader has not seen, (2) a fixed classification rubric (start point, target region, signal added, predicted failure mode, evidence), and (3) a scored check that the reader predicts the lens's failure mode **before** seeing the trace. Redescription scores at chance on the prediction check; a lens that genuinely improves the workflow lets the builder name the failure mode in advance and then catch it in the trace — the false-completion silence being the exemplar. I adopt Agent B's continuation constraint over my own "design step 1 only" framing for this specific question, while still treating step 1 (rewrite `paper.md`, fix `check_sections.py`, six-field ledger, five missing keys) as the prerequisite that turns the eval green before the group is asked to score anything.
