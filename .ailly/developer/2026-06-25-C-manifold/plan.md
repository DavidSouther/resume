# Implementation Plan: Manifold paper Step 1 — outline + claim-ledger contract + eval gate

**Feature test:** `posts/llm_manifold/evals/manifold.yaml` — its three script
assertions (`check_sections.py`, `check_citations.py`, `check_pandoc.py`) all
exit 0 against the rewritten `paper.md`, and its `judge` assertion grades `P`
against the rewritten claim ledger. Run the three scripts directly during
build (per `evals/README.md`'s "Standalone" instructions); the judge assertion
is graded by manual/LLM review since the Ailly CLI bridge is out of scope
(design.md, "Dependency on Ailly tooling").

**User story:** As a Lit Group reader opening `paper.md`, I see the
contribution-first outline the symposium approved — thesis first, novelty
boundary against Bradley et al. in the first third, a load-bearing steering-
operator section, and a six-field claim ledger with no unresolved TODO
placeholders — so I can review the paper's argument instead of its scaffolding.

**Steps:**
- [x] Step 0: Contract stubs (REQUIRED section list, ledger header, citation-key checklist)
- [ ] Step 1: Sections 4–5 — Steering Operators, Worked Analyses
- [ ] Step 2: Sections 6–7 — What This Lens Predicts, Alternative Views and Limitations
- [ ] Step 3: Sections 2–3 — Prior Art and Novelty Boundaries, The Document-Space Model
- [ ] Step 4: Section 8 — Evaluation and Claim Ledger
- [ ] Step 5: Sections 1, 9, 10 — Introduction, Conclusion, References
- [ ] Step 6: Abstract
- [ ] Step 7: Scored transfer-test protocol + judge extension (or recorded gap)

Write order runs contribution-first, background-second: the load-bearing
sections (4–5) go down while the symposium's constraints are freshest, then
the predictive/limitations discussion that follows directly from them (6–7),
then back to prior art and the document-space model (2–3) now that it's clear
exactly how much geometry the lens actually uses, then the cross-cutting
ledger (8), then Introduction/Conclusion/References together (1, 9, 10) once
there's real content to frame and recap, then the Abstract last of all.

## Step 0: Contract stubs

New/changed contract surfaces — no prose bodies yet, only the shapes the
later steps must fill:

```python
# posts/llm_manifold/evals/scripts/check_sections.py
REQUIRED = [
    "Introduction",
    "Prior Art and Novelty Boundaries",
    "The Document-Space Model",
    "Steering Operators for Agentic Workflows",
    "Worked Analyses",
    "What This Lens Predicts",
    "Alternative Views and Limitations",
    "Evaluation and Claim Ledger",
    "Conclusion",
    "References",
]
```

```markdown
<!-- posts/llm_manifold/paper.md, future Section 8 — six-field ledger header
     (design.md ll.240-247) replacing the current 4-column table -->
| Claim | Status | Support | Does not support | Paper section | Risk if wrong |
|---|---|---|---|---|---|
```

Citation-key checklist (names only — real metadata is Step 1's job; resolution
status below is from `confirm_citations.md`, confirmed 2026-07-08):

- `yao2023react` — ReAct, arXiv:2210.03629 — **confirmed**
- `gao2023hyde` — HyDE, arXiv:2212.10496 — **confirmed**
- `zhou2024lats` — LATS, arXiv:2310.04406 — **confirmed**
- `wang2023selfconsistency` — self-consistency/pass@k, arXiv:2203.11171 — **confirmed**
- `chen2024agentless` — **rejected** (Agentless's approach reduces the explored
  space rather than exemplifying branch-and-select, and its SWEBench-ambiguity
  methodology is disqualifying). Needs a replacement citation, or drop the
  second §5.4 citation and lean on `wang2023selfconsistency` plus the internal
  Ailly `assemble` matrix-fan-out instance already in `worked-analyses.md`
  ll.129-131 for the "genuinely distinct start points" case — open question,
  see session.

**Enables:** `check_sections.py` enforces the *new* 10-heading contract. It
will still fail against the current `paper.md` (wrong headings, old ledger)
— expected; this step changes what "red" means, not the color.

**Tests**

```
test "check_sections rejects the old geometry-first skeleton":
  run check_sections.py against the current paper.md
  assert exit code == 1
  assert output lists missing headings from the NEW REQUIRED list
  (e.g. "missing section: 'Prior Art and Novelty Boundaries'")
```

- Edge case: a heading substring collision (e.g. "Introduction" matching
  inside another heading's text) — current `req.lower() in h.lower()` matching
  is substring-based; verify none of the 10 new titles are substrings of each
  other in a way that causes a false match.
- Edge case: `check_citations.py` run with no `refs.bib` changes yet — must
  still report 0 failures (no new keys are cited yet, so nothing new to
  resolve).

**Implementation Outline**

Replace the `REQUIRED` list literal in `check_sections.py` in place; no other
logic in that file changes (the substring/TODO-stripping matcher already
works generically over whatever list it's given).

## Step 1: Sections 4–5

**Enables:** non-empty check for "Steering Operators for Agentic Workflows"
and "Worked Analyses"; `check_citations.py` resolution of the five new keys
once they're both added to `refs.bib` (with verified metadata — see Step 0's
checklist) and actually cited in this section's prose.

1. **Steering Operators for Agentic Workflows** — the load-bearing
   contribution section. Build the reusable operator table: prompting,
   retrieval/HyDE/Jeopardy, external tool/execution feedback, thinking/CoT/
   pause tokens, subagents/multi-sample branching, ReAct-style tool
   interaction, LATS/tree-search.
2. **Worked Analyses** — lead with the ReAct/tool-interactive false-completion
   example (Constraint 4, from `analyst-eval-failures.md` ll.34-49): the
   document trajectory says "done" while the external referent hasn't
   changed, often silently. Carry the hand-picked-not-base-rate caveat
   verbatim. Required examples: ReAct/tool-interactive; compiler-error repair/
   Self-Debug; CoT/pause tokens; HyDE/retrieval expansion; subagent review or
   multi-sample search; LATS/tree-search. Each example: pattern, steering
   move, literature support, predicted failure mode, boundary
   condition/counterexample.

**Tests**

```
test "worked analyses lead with the ReAct false-completion example":
  run check_sections.py -- assert no failure for the two new sections
  assert Section 5's first worked example is the ReAct/tool-interactive one
  assert the "hand-picked, not a base rate" caveat text is present verbatim
  run check_citations.py -- assert the 5 new keys resolve
```

- Edge case: a worked example cites a key not yet in `refs.bib` — must fail
  loudly (this is exactly what `check_citations.py` is for); do not add prose
  citing a key before its `refs.bib` entry exists.
- Edge case: the operator table must stay a reusable artifact (design.md's
  "Figures and reusable artifacts") — check it enumerates all 7 operator rows
  named in design.md's Specification, not a subset.

**Implementation Outline**

Verify each of the five tentative arXiv IDs from Step 0's checklist against a
live source (`research:papers` or `research:public`) before writing the
`refs.bib` entries — the plan's tentative IDs are unverified. Add the verified
entries to `refs.bib` in the same pass as citing them, so `check_citations.py`
never sees an orphan citation.

## Step 2: Sections 6–7

**Enables:** non-empty check for "What This Lens Predicts" and "Alternative
Views and Limitations".

1. **What This Lens Predicts** — conditions under which steering helps, fails,
   or gets too expensive: target observability, feedback reliability, search
   breadth, artifact inspectability, serial dependency, cost, collapse onto
   shared prompt/context bias.
2. **Alternative Views and Limitations** — compare program synthesis,
   MDP/control, information geometry, category theory, "just prompt
   engineering." Include submission-fit limitations: main-track benchmark
   venues are a weaker fit absent new empirical/theoretical results.

**Tests**

```
test "predictive section states falsifiable conditions, not restated prompt engineering":
  run check_sections.py -- assert no failure for either section
  assert Section 6 names at least the 7 conditions listed in design.md's
    "What this lens predicts" spec (observability, feedback reliability,
    search breadth, inspectability, serial dependency, cost, prompt-bias collapse)
```

- Edge case: this is the section the symposium's Unresolved Minority
  Objections flagged as risking "relabeling prompt engineering" — the
  sharpest-thesis pin is deferred to holistic review (project step N-1), but
  this step's prose must not read as pure restatement in the meantime.

**Implementation Outline**

Write both sections as prose with the "alternative views" section closing on
the venue-fit limitation named in the meta-review.

## Step 3: Sections 2–3

**Enables:** `check_sections.py` non-empty check for "Prior Art and Novelty
Boundaries" and "The Document-Space Model"; `check_citations.py` resolution of
`[@bradley2021]`, `[@bradley2025]`, `[@coecke2010]` once actually cited in
prose (today they only appear in the old ledger table).

1. **Prior Art and Novelty Boundaries** — non-empty, in the first third of the
   paper. Must actively engage Bradley/Terilla/Vlassopoulos (not just cite
   them): what their `[0,1]`-enriched category of texts and next-token-
   probability follow-up already formalize, and where that stops and this
   paper's workflow-level diagnostic reading begins. Cover DisCoCat,
   information geometry, union-of-manifolds, transformer formal-language work,
   program synthesis, CoT expressivity, self-correction — a table separating
   "already formalized" from "what this paper adds" (design.md l.188).
2. **The Document-Space Model** — only the geometry the workflow lens needs:
   functions/programs/documents; generation as trajectory. Carry the hard
   caveats verbatim: contextual hidden states not raw token embeddings; union
   of manifolds not one smooth surface; basin language is author-analogy
   unless grounded.

**Tests**

```
test "sections 2-3 are non-empty and Bradley is engaged, not just cited":
  run check_sections.py
  assert no failure for Prior Art and Novelty Boundaries / The Document-Space Model
  grep paper.md Section 2 body for "[@bradley2021]" and "[@bradley2025]"
  assert Section 2 body length exceeds a citation-only one-liner
    (i.e. it states what the enriched-category construction covers
    and where the workflow reading begins, per Constraint 3)
```

- Edge case: Section 2's "already formalized vs. what this paper adds" table
  must not silently omit Bradley — the symposium's hard-gate finding was
  exactly this omission risk.
- Edge case: hedge language ("as if", "region") and Section 3's caveats
  (contextual hidden states not raw token embeddings; union of manifolds not
  one smooth surface) must actually appear in this prose, not just be
  asserted in the ledger. Introduction's framing-level hedges land in Step 5.

**Implementation Outline**

Rewrite the two section bodies under the Step-0 headings; carry footnote-
style caveats as prose paragraphs, not bullet TODOs. Cite with pandoc
`[@key]` form throughout (matches `check_citations.py`'s pandoc-cite regex).

## Step 4: Section 8

**Enables:** `check_sections.py` non-empty check for "Evaluation and Claim
Ledger"; the six-field ledger schema is structurally in place and populated
(judge grading of its content is Step 7's job).

**Evaluation and Claim Ledger** — replace the old 4-column table with the
Step-0 six-field header, populate every mandatory row from design.md
ll.249-273 (thesis, prompting, external-feedback, CoT, retrieval/HyDE,
subagents/sampling/tree-search, contextual-vs-token-embedding caveat,
union-manifold caveat, basin-language caveat, Bradley/DisCoCat boundary,
2026 speculative-preprint caveat) with `Does not support` and `Risk if wrong`
filled on every one. Include the Lit Group review protocol and
automated-readiness judge contract (prose summary; the scored transfer-test
rewrite itself is Step 7).

**Tests**

```
test "every load-bearing ledger row has Does-not-support and Risk-if-wrong populated":
  parse the Section 8 table
  for each row: assert "Does not support" cell is non-empty and specific
    (not "N/A" as a dodge)
  assert "Risk if wrong" cell is non-empty
```

- Edge case: the basin-language row and the program-space-metric row must be
  tagged `author-analogy` or `deferred` per design.md l.241, not
  `established` — this is exactly the citation-drift risk the symposium
  flagged.

**Implementation Outline**

Build the ledger table row-by-row from the design.md mandatory-rows list,
cross-checking each `Support` cell's citation key against `refs.bib`.

## Step 5: Sections 1, 9, 10

**Enables:** `check_sections.py` non-empty check for "Introduction",
"Conclusion", "References" — the last three sections needed for a full green
run across all 10 required headings, since Steps 1–4 already cover 2, 3, 4,
5, 6, 7, and 8.

1. **Introduction** — state the thesis immediately (design.md's working
   title's `Position:` framing), name it synthesis/position work, list the
   contribution, say what is not claimed. Use Constraint 3's hedges: "as if",
   "region" rather than "manifold/basin", explicit denial of
   metric/basin/formalism claims.
2. **Conclusion: the checklist** — the reusable checklist: start point, target
   region, signal added, failure mode addressed, evidence that the move
   works.
3. **References** — confirm pandoc `--citeproc` renders cleanly (this is also
   `check_pandoc.py`'s job; this step just makes sure the section exists and
   the bibliography/CSL wiring is intact).

**Tests**

```
test "introduction states the thesis and hedges; conclusion gives the checklist; references render":
  run check_sections.py -- assert no failure for Introduction / Conclusion / References
  assert Introduction contains the Position: framing hedges ("as if", "region")
    and an explicit denial of metric/basin/formalism claims
  assert Conclusion's checklist has the five fields: start point, target region,
    signal added, failure mode addressed, evidence
  run check_pandoc.py -- assert exit 0
```

- Edge case: this is the point at which `check_sections.py` should report full
  green across all 10 sections — if an earlier step's heading regressed (e.g.
  renamed or emptied), this test is what surfaces it.
- Edge case: `check_pandoc.py` needs `pandoc` installed and `ieee.csl`
  present; if `ieee.csl` is still missing, this step must add it (or the
  check fails for a reason unrelated to prose content).

**Implementation Outline**

Rewrite the Introduction under the Step-0 heading, carrying footnote-style
caveats as prose paragraphs, not bullet TODOs, and citing with pandoc
`[@key]` form. Write the Conclusion's checklist as a numbered list mirroring
the five-field rubric. Confirm References renders via `check_pandoc.py`.

## Step 6: Abstract

**Enables:** the front-matter `abstract:` field in `paper.md`'s YAML header
no longer reads `TODO (step N-1)`. This is outside `check_sections.py`'s
heading scan (front matter, not a `##` section), so it doesn't gate the
script, but it's the reader's first impression and only worth pinning once
every section's content is fixed — hence writing it dead last.

Summarize the thesis, the contribution (the agentic-workflow lens), what's
not claimed (no new theorem/formalism), and the paper's shape
(position/synthesis) — the shortest faithful restatement of the (now-written)
Introduction plus the "what this lens predicts" gist.

**Tests**

```
test "abstract summarizes the fixed content, not the outline":
  read paper.md front matter
  assert `abstract:` no longer contains "TODO"
  assert it states the thesis, the contribution, and what is not claimed
  assert it is consistent with the Introduction written in Step 5 -- no drift
```

- Edge case: because this step runs last, catch any late-breaking rewording
  from Steps 1–5 the abstract should reflect (e.g. if holistic review later
  repins the sharpest thesis form, the abstract is the first thing to
  revisit).

**Implementation Outline**

Write the abstract as a 3–5 sentence restatement of the Introduction, not a
new composition — standard write-the-abstract-last practice.

## Step 7: Scored transfer-test protocol + judge extension

**Enables:** the `manifold.yaml` judge assertion has something real to grade;
closes Continuation Constraint 1 (the symposium's one veto) and Constraint 6.

1. Rewrite `design.md`'s Lit Group review protocol (User Journey section) into
   the scored transfer-test protocol: one held-out workflow absent from
   Section 5 (e.g. a Self-Consistency or reflexion variant), the fixed
   five-field rubric (start point, target region, signal added, predicted
   failure mode, evidence), a blind step where readers record their
   prediction *before* seeing the author's analysis, and the pass criterion
   (majority independently lands on the predicted failure mode above a
   prompt-engineering-only baseline). Preserve the hand-picked-not-base-rate
   caveat verbatim.
2. Extend `manifold.yaml`'s `judge` prompt to also check that every
   load-bearing ledger row has non-empty, specific `Does not support` and
   `Risk if wrong` fields. **Allowed deferral:** if judge-prompt coverage
   can't be extended in this pass, record the exact gap in
   `evals/README.md` instead (design.md's "Allowed Step-1 deferral").

**Tests**

```
test "design.md's review protocol is a scored transfer test, not a vibe check":
  read design.md's User Journey section
  assert it names: a specific held-out workflow, the five-field rubric,
    a blind-prediction step, and a quantified pass criterion
    (majority above a stated baseline)

test "manifold.yaml judge checks ledger completeness, or the gap is recorded":
  read manifold.yaml's judge prompt
  assert it mentions "Does not support" and "Risk if wrong"
  OR evals/README.md explicitly records this as a known coverage gap
```

- Edge case: do not invent a frequency/base-rate claim while writing the pass
  criterion — the constraint explicitly forbids a new dataset or benchmark
  claim; the test is of the lens's transfer, not of failure-mode prevalence.

**Implementation Outline**

Edit `design.md` in place (User Journey and Metrics section); edit
`manifold.yaml`'s judge `prompt` string; if deferring, append a dated entry to
`evals/README.md`'s existing prose rather than a new section.

## Verification (not a plan step — run at the end of Step 7)

Run all three scripts and eyeball the judge criteria by hand:

```sh
python posts/llm_manifold/evals/scripts/check_sections.py
python posts/llm_manifold/evals/scripts/check_citations.py
python posts/llm_manifold/evals/scripts/check_pandoc.py
```

All three must exit 0. If `check_pandoc.py` fails only because `pandoc` isn't
installed locally, that's a pre-existing environment gap (evals/README.md
already calls this out) — surface it rather than treating it as this step's
regression.
