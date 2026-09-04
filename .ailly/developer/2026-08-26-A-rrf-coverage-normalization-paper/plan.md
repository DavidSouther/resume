# Project Plan: RRF Coverage Normalization Paper

**Closing Bell:** `.ailly/developer/2026-08-26-A-rrf-coverage-normalization-paper/closing-bell.md`

**Features:**
- [x] Feature 1: Paper scaffold and build pipeline
- [ ] Feature 2: Prior Art                            Depends on: Feature 1
- [ ] Feature 3: Mathematical Formulation              Depends on: Feature 2
- [ ] Feature 4: Simulation                            Depends on: Feature 3
- [ ] Feature 5: Discussion/Conclusion                 Depends on: Feature 4
- [ ] Feature 6: Introduction                          Depends on: Feature 5
- [ ] Feature 7: Abstract                              Depends on: Feature 6

No feature runs in parallel with another. The deliverable is one linear
document written in an evidence-then-summary chain (see `design.md`
Specification); each feature consumes the previous feature's confirmed
output rather than sharing an interface contract with a sibling. There is
therefore no "settle shared interfaces before parallel work" step to run.

## Feature 1: Paper scaffold and build pipeline

**Scope:** Extract and generalize `posts/llm_manifold`'s Typst build
machinery (font provisioning, `refs.bib`/`ieee.csl` citation pipeline,
`compile-manifold-paper.ts`'s pattern, section-assembly) into a new,
initially-empty paper at `posts/rrf_coverage_normalization/` (per
`design.md`'s Open Artifact Decisions; confirm the exact slug at this
feature's own design step). Produces a script that compiles a stub
`sections/` directory to a PDF.

**Advances Closing Bell:** enables every later task — without a compiling
pipeline, no PDF exists for the study.

**Own cycle:** run its own design → plan → build → cleanup. Its feature
test is "running the new paper's compile script on a stub one-paragraph
section produces a PDF file," mirroring
`posts/llm_manifold/scripts/compile-manifold-paper.feature.test.ts`.

## Feature 2: Prior Art

**Scope:** Systematic literature search (expand: synonym/narrow/broad/
alternate-phrasing per approach) for all five approaches' sources and
tiers; a falsification pass specifically on the `log(n + bias)`
no-prior-publication claim (search by name and close synonym before
concluding absence); fetch and directly quote the Rank-Biased Centroid
primary PDF's formula, stating whether it contains a log term and over
which variable; search adjacent fields (BM25/IDF log terms, ensemble
voter-agreement weighting, recommender confidence damping) and report near
misses explicitly (e.g., a linear `n/bias` term) with the stated reason a
near miss is not a match. Uses `research:papers` and `research:public`
directly for the search; distinguishes "not found in this search" from
"does not exist" per the Method section.

**Advances Closing Bell:** Task 1 (source-tier recall) and part of Task 3
(the disagreement case needs confirmed formulas to reason about).

**Own cycle:** feature test is a check that every one of the five
approaches has a recorded source, tier, and (for RBC) a direct quote in
the Prior Art section's draft content, plus a recorded falsification-pass
verdict on `log(n+bias)`.

## Feature 3: Mathematical Formulation

**Scope:** State all five formulas on one shared, consistent notation
(same symbols for score, rank, retriever count, constant `k`/bias). State
the `log(n+bias)` bias term's purpose precisely (nonzero at n=1, defined at
n=0 for bias>0, unlike bare `log(n)`). Cite Feature 2's sources and tiers
inline per formula; do not restate or re-derive sourcing independently.

**Advances Closing Bell:** Task 1 (formula recall) directly.

**Own cycle:** feature test checks that all five approaches appear with a
formula in the shared notation and a citation resolving to a Feature 2
source (no orphan formulas, no orphan citations).

## Feature 4: Simulation

**Scope:** Build one 5–7-document dataset with a stated set of
per-retriever ranks (per `design.md`'s Open Artifact Decision on dataset
location/format — a small script under `evals/scripts/` with a matching
test, not hand arithmetic in prose). Compute score and rank order per
approach from Feature 3's formulas. Identify and flag at least one
document pair where two approaches disagree on order; record the author's
judged-correct order and reasoning. Generate the closing comparison table
(name, formula, source tier, nonzero-at-n=1, bounded bonus, prior
published use found) from the same computed data structure, not by hand.
Optionally, if time and space permit, run a second benchmark-scale
(hundreds-to-thousands-item) dataset.

**Advances Closing Bell:** Task 2 (comparison table) directly; Task 3
(disagreement case) directly.

**Own cycle:** feature test runs the simulation script and asserts the
computed output includes all five approaches' scores for every document,
at least one flagged disagreement, and a rendered table matching the
computed structure.

## Feature 5: Discussion/Conclusion

**Scope:** Restate the coverage-bonus question. State the empirical
differences Feature 4 found between approaches. State next steps
(evaluation against larger, human-reviewed datasets). Discuss which
dataset or query types each approach likely suits best, reasoning from
Feature 3's formula properties and Feature 4's worked results.

**Advances Closing Bell:** Task 3's reasoning content (the disagreement
explanation the participant must reproduce lives here); indirectly
supports Task 1 by reinforcing formula properties in context.

**Own cycle:** feature test checks the section cites specific Feature 4
results (not generic claims) and states an explicit next-steps sentence.

## Feature 6: Introduction

**Scope:** Motivate the coverage-bonus problem for a reader who has not
yet seen the rest of the paper, and preview the five approaches and the
paper's structure. Written after Discussion/Conclusion so the preview
matches what the paper actually concludes, not what was originally
guessed.

**Advances Closing Bell:** primes the reader correctly for Tasks 1–3 by
setting accurate expectations; not itself directly tested by the study.

**Own cycle:** feature test checks the Introduction's stated structure
preview matches the paper's actual section list and approach count (5).

## Feature 7: Abstract

**Scope:** One paragraph summarizing the problem, the five approaches, and
the paper's findings, written last, after every other section is final,
per the ASD-STE100 rule against unhedged claims about unfinished findings.

**Advances Closing Bell:** final polish; supports Task 1 as the reader's
first-read summary anchor.

**Own cycle:** feature test checks the Abstract references only claims
that trace to a finished section (no forward reference to unwritten
content) and stays within a stated word-count bound (e.g. ≤250 words,
typical for this venue type — confirm at that feature's own design step).

## Notes on Method Compliance

Every feature-step that touches a numeric claim (Features 3 and 4) must
show its calculation, not estimate or round silently, per the prompt's
Method section. Every feature-step that touches a "no prior publication
found" claim (Feature 2) must show the falsification pass it ran before
asserting absence.
