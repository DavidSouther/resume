# Project Design: RRF Coverage Normalization Paper

**Status:** Review

**Closing Bell:** see "User Journey and Metrics" below; full study recorded
at `.ailly/developer/2026-08-26-A-rrf-coverage-normalization-paper/closing-bell.md`.

## Purpose

Reciprocal Rank Fusion (RRF) is widely used to merge ranked lists from
multiple retrievers (for example, keyword and vector search in a hybrid
RAG system). Plain RRF gives an unbounded coverage bonus to documents found
by more retrievers, without checking whether those retrievers agree on
rank quality. Several published and vendor-documented variants adjust or
remove that bonus. We have not found a source comparing them on shared notation,
with worked numbers, and with a documented literature search for the newer
candidate forms.

This project aims to deliver that paper,
comparing five RRF coverage-adjustment approaches (plain RRF, average-form
division, flat per-retriever weighting, Rank-Biased Centroid, and a
candidate `log(n + bias)` form) on the same notation, the same worked small
dataset, and a closing comparison table, backed by a systematic literature
search and a falsification pass on the novel-claim question.

Prior Art gives the confirmed
primary formulas and tier ratings that Mathematical Formulation needs.
Mathematical Formulation gives the finished formulas that Simulation needs
to compute worked numbers. Simulation gives the empirical results that
Discussion/Conclusion needs to state real differences. The paper's
Introduction and Abstract cannot summarize sections that do not exist yet.

## Prior Art

- **`posts/llm_manifold/`** is this repository's existing academic-paper
  build and formatting base: Typst-based compilation
  (`scripts/compile-manifold-paper.ts`), a `sections/` directory compiled
  into one document, a `refs.bib` + `ieee.csl` citation pipeline, a
  provisioned-fonts manifest, and matching preprint/arXiv Typst templates.
  This project extracts and shares that machinery.
- **RRF's origin paper** (Cormack, Clarke, Büttcher, SIGIR 2009) is the
  baseline every approach in this paper is measured against.
- **Rank-Biased Centroid** (Bailey, Moffat, Scholer, Thomas, SIGIR 2017) is
  the one approach in scope with an unresolved primary-source formula
  fetch, flagged explicitly by the prompt as an open thread.
- **Azure AI Search's hybrid-ranking documentation** is the flat
  per-retriever-weighting example the prompt names directly.

## User Journey and Metrics

**End-to-end journey:** a reader who already understands ranked retrieval,
but not RRF itself, opens the compiled PDF, reads front-to-back (the
Introduction gives the needed RRF background), and comes away able to
state each approach's formula,
its source and tier, whether it keeps a single-retriever document at a
nonzero score, whether its coverage bonus is bounded, and which of two
approaches disagree on the worked dataset's example pair (and why the
paper's author judges one order more correct).

**Metrics the finished paper must hit:**
- Every one of the five approaches has a stated formula, a cited source,
  and an explicit tier (primary paper / official documentation / secondary
  survey / blog / unconfirmed aggregator).
- The RBC formula is quoted directly from the fetched primary PDF, not
  paraphrased from a secondary description.
- The `log(n + bias)` prior-art question is answered with "not found in
  this search" or a confirmed citation — never left ambiguous between the
  two.
- One worked numerical example, computed and shown (not estimated), exists
  per approach, on the same 5–7-document dataset.
- At least one dataset case shows two approaches disagreeing on rank order
  for the same document pair, with the author's judged-correct order and
  the reasoning stated.
- A closing comparison table covers all five approaches on all six stated
  axes (name, formula, source tier, nonzero-at-n=1, bounded bonus, prior
  published use found).
- The paper compiles to a PDF via the reused Typst pipeline, and is written
  in ASD-STE100 (short sentences, one idea per sentence, active voice, no
  idioms, hedged/indefinite phrasing for the paper's own findings, definite
  phrasing only for facts already established by a cited primary source).

### Closing Bell

Recorded in full at `closing-bell.md` in this session folder. Summary: a
participant with graduate-level IR background but no prior exposure to
this paper is given only the compiled PDF and asked to (a) state the five
approaches' formulas and source tiers from memory after one read-through,
(b) locate the comparison table and use it to pick an approach for a
stated scenario, and (c) explain, in their own words, why the paper's one
disagreeing-approaches example resolves the way it does. Passing requires
correct, unaided answers on all three critical tasks.

## Specification

Feature-steps, in the prompt's stated writing order (Prior Art first, then
Mathematical Formulation, Simulation, Conclusion, Discussion, Introduction,
Abstract last). This is a deliberate departure from the front-to-back
*reading* order (Abstract, Introduction, Prior Art, Math, Simulation,
Discussion/Conclusion): the paper is *written* back-to-front from its
evidence toward its summary, then assembled front-to-back for the reader.

1. **Paper scaffold and build pipeline** — extract/generalize
   `posts/llm_manifold`'s Typst build script, font provisioning, and
   citation pipeline into a new paper directory (name pending — see Open
   Artifact Decisions) with an empty `sections/` layout and a passing
   "compiles to an empty/stub PDF" check. No content yet.
2. **Prior Art** — systematic literature search (expand/narrow/broad/
   alternate-phrasing per approach), falsification pass on the
   `log(n + bias)` novel-claim question, RBC primary-PDF fetch and direct
   quote, adjacent-field search (BM25/IDF log terms, ensemble voter
   agreement, recommender confidence damping) with near-misses stated
   explicitly (e.g., a linear `n/bias` term found in a prior pass, and why
   it is not a match).
3. **Mathematical Formulation** — state all five formulas on one shared
   notation, with source and tier per formula, and the `log(n+bias)` bias
   term's stated purpose (nonzero at n=1, defined at n=0 for bias>0).
4. **Simulation** — one 5–7-document worked dataset with per-retriever
   ranks, computed (not estimated) scores and rank orders for all five
   approaches, one flagged disagreement case with the author's judged-
   correct order and reasoning, and the closing comparison table.
   Optionally, if time and space permit, a second benchmark-scale
   (hundreds-to-thousands-item) dataset run.
5. **Discussion/Conclusion** — restate the question, state the empirical
   differences found in Simulation, state next steps (larger,
   human-reviewed datasets), and discuss which dataset/query types suit
   each approach best.
6. **Introduction** — motivate the coverage-bonus problem and preview the
   five approaches and the paper's structure, written last so it can
   accurately preview finished content.
7. **Abstract** — one paragraph summarizing problem, approaches, and
   findings, written after every other section is final.

### Sequential and Parallel Steps

- [ ] Step 1: Paper scaffold and build pipeline — no dependencies, can
  start now.
- [ ] Step 2: Prior Art — Depends on: Step 1 (needs the `sections/`
  layout and citation pipeline to land content into and cite from).
- [ ] Step 3: Mathematical Formulation — Depends on: Step 2 (needs
  confirmed formulas, sources, and tiers from Prior Art, especially the
  resolved RBC quote and the `log(n+bias)` prior-art finding, before
  stating them formally).
- [ ] Step 4: Simulation — Depends on: Step 3 (needs finished, checked
  formulas to compute worked numbers from).
- [ ] Step 5: Discussion/Conclusion — Depends on: Step 4 (needs
  Simulation's actual empirical results to discuss).
- [ ] Step 6: Introduction — Depends on: Step 5 (previews the finished
  paper's content and conclusions accurately).
- [ ] Step 7: Abstract — Depends on: Step 6 (last-written summary of the
  complete paper).

No steps are parallel: the prompt's own stated writing order is a strict
evidence-then-summary chain, each step consuming the previous step's
output (formulas need sources, numbers need formulas, discussion needs
numbers, framing needs discussion, summary needs framing). This is narrower
than the general project-shape template's default (which expects some
parallelism); it is correct here because the deliverable is a single
linear document, not independent subsystems.

## Alternatives

- **Single feature loop instead of a project.** Rejected: the six
  feature-steps each fail alone against the Closing Bell's stated reader
  tasks (see Purpose); this is the project-shape test's explicit case.
- **Write front-to-back (Abstract first).** Rejected by the prompt's own
  stated writing order; writing the Abstract first would force premature,
  unhedged claims about findings that do not exist yet, conflicting with
  the ASD-STE100 output-style rule to hedge new findings.
- **Off-the-shelf citation/paper tool (e.g., Overleaf/LaTeX) instead of
  reusing `llm_manifold`'s Typst pipeline.** Rejected: the prompt
  explicitly directs reuse and extraction of the existing machinery; a new
  toolchain would duplicate already-solved font/bibliography/CSL problems.
- **Skip the benchmark-scale dataset entirely rather than making it
  conditional.** Rejected: the prompt phrases it as conditional ("if
  found, or if space & time permit"), not out of scope; Step 4 keeps it as
  an explicit stretch scope rather than silently dropping it.

## Summary

Deferred decisions, parked to `TASKS.md` at project cleanup:
- Whether the benchmark-scale dataset simulation is attempted in this
  project or deferred to a follow-on task (Step 4 decides this at build
  time based on what Prior Art and Mathematical Formulation leave time
  for).
- Target venue/format beyond an arXiv-style preprint (e.g., whether a
  companion blog post summary is wanted, mirroring `llm_manifold/post.md`).

### Open Artifact Decisions

**New paper directory path:** no existing convention names it. Options:
`posts/rrf_coverage_normalization/` (mirrors `posts/llm_manifold/`'s
snake_case convention) or a shorter `posts/rrf_normalization/`.
Proposed: `posts/rrf_coverage_normalization/`, matching the prompt's own
terminology ("coverage normalization") and the `llm_manifold` naming
precedent (full descriptive slug, not abbreviated).

**Shared-dataset file location and format:** the prompt requires one
5–7-document dataset with per-retriever ranks, reused across all five
approaches' worked examples. No convention prescribes its format.
Proposed: a single checked-in fixture (e.g.
`posts/rrf_coverage_normalization/evals/dataset.json` or a small table
inline in the Simulation section's Typst/markdown source) computed by a
short script under `evals/scripts/`, following the `llm_manifold/evals/`
precedent of Python scripts with matching tests, so the "compute, do not
estimate" method requirement is enforced by a runnable check rather than
by hand-arithmetic in prose.

**Comparison-table source of truth:** whether the closing comparison table
is hand-written Typst/markdown or generated from the same per-approach
data structure the Simulation script computes. Proposed: generate it from
the Simulation script's output, so the table cannot drift from the worked
numbers.
