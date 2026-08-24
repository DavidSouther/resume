# TASKS

Next-step queue for `developer:ailly` sessions in this repo.

## Follow-ups

- **manifold paper: legacy plan-step tests encode a superseded outline** — Seven
  `posts/llm_manifold/evals/scripts/test_*.py` files (`test_abstract`,
  `test_compose_paper`, `test_evaluation_and_ledger`,
  `test_intro_conclusion_references`, `test_predicts_and_alternatives`,
  `test_prior_art_and_document_space`, `test_worked_analyses`) assert the old
  ten-section outline: a `06_evaluation_claim_ledger.md` that commit `1eda7e4`
  deleted, section titles that `1eda7e4` renamed, and section *numbers* that
  shifted. They have been red since that commit. Decide per file whether to
  retarget it at the shipped eight-section outline or delete it as a spent
  plan-step gate; `check_sections.py`, `check_citations.py`, `check_pandoc.py`,
  `test_check_*.py`, `test_transfer_test_protocol.py`, and
  `test_operator_evaluation.py` (retargeted at the shipped §5, not the unused
  August 6 Table 2 catalog) are the live green gate.

- **manifold paper: the PDF title block still reports two ICML author errors** —
  The built PDF's title footnote reads `AUTHORERR: Missing \icmlaffiliation.` and
  `AUTHORERR: Missing \icmlcorrespondingauthor.`, because
  `posts/llm_manifold/scripts/templates/llm-manifold-icml.tex` emits
  `\icmlauthor{...}{}` with an empty affiliation key and never emits the two
  companion macros the ICML style requires. Fixing it needs an affiliation label
  and a corresponding-author email, which are the author's to supply, so it was
  left alone rather than invented. Related: the abstract in
  `sections/01_abstract.md` is still the placeholder ("Write the rest _after_ the
  paper is complete"), and it renders verbatim in the PDF.

- **manifold paper + post (LLMs as a model of syntactic space)** — A **project**
  (project loop; see [.ailly/developer/2026-06-25-C-manifold/design.md](2026-06-25-C-manifold/design.md),
  phase: Implement). Next step: **project step N-1, holistic review** — read
  [posts/llm_manifold/paper.md](../../posts/llm_manifold/paper.md) end to end for
  narrative coherence (not per-section correctness, already checked), confirm §5
  (now a three-mechanism evaluation: computation / evidence / alternatives, with
  composition inheriting the weakest evidence boundary) and §6 clear the "more
  than relabeling prompt engineering" bar together rather than just
  section-by-section, and pin the single sharpest statement of the thesis. The
  [2026-08-06-A-section5-design-patterns](2026-08-06-A-section5-design-patterns)
  session (four questions + Table 2) is
  [superseded](2026-08-06-A-section5-design-patterns/SUPERSEDED.md). The abstract
  is still a placeholder ("Write the rest _after_ the paper is complete"), and
  `post.md` still describes the old §5. See
  [.ailly/developer/2026-06-25-C-manifold/plan.md](2026-06-25-C-manifold/plan.md)'s
  now-complete 8-step build log for what each section already established, so the
  holistic review isn't re-litigating settled ground. After that: **project step N,
  bibliography and build pass** — largely pre-satisfied already (all 30 `refs.bib`
  entries resolve, `check_pandoc.py` renders clean IEEE output, `ieee.csl` is
  present) but re-run all three checks after any holistic-review edits, since
  those edits are the only thing that could regress them.

  **Completed this session (2026-07-08):** `plan.md`'s entire 8-step build
  (Steps 0–7) is green — every one of the 10 outline-contract sections is written,
  all 30 `refs.bib` entries resolve (7 confirmed citations added in Step 1, 6 more
  in Step 3, 4 more in Step 4), `check_pandoc.py` renders a real IEEE bibliography
  end to end (pandoc + `ieee.csl` newly installed/added), the claim ledger uses the
  full six-field schema with every row's `Does not support`/`Risk if wrong`
  populated, and the scored transfer-test protocol names a concrete held-out
  workflow (Reflexion) with a sealed facilitator answer key. Along the way, fixed
  three real pre-existing bugs in the eval scripts themselves: `check_citations.py`
  silently missed every non-last key in a multi-citation `[@key1; @key2]` bracket,
  and all three scripts (`check_sections.py`/`check_citations.py`/`check_pandoc.py`)
  resolved their zero-argument defaults one directory too shallow (`evals/` instead
  of `llm_manifold/`), so the standalone no-argument invocation documented in
  `evals/README.md` never actually worked until this session. Deliverables now live
  at [posts/llm_manifold/post.md](../../posts/llm_manifold/post.md) and
  [posts/llm_manifold/paper.md](../../posts/llm_manifold/paper.md) (not the stale
  `llm_manifold/` top-level paths this entry used to point at).

  **Load-bearing finding (unchanged):** the manifold/categorical/phase-space
  vocabulary is already published (esp. Bradley–Terilla–Vlassopoulos's enriched
  category of texts with LM probabilities, arXiv:2106.07890 / 2501.06662), so v1
  bounds novelty and defers the endofunctor formalism + loss-landscape↔manifold
  bridge (now explicitly named and cited as deferred in the Introduction).
  **Exit criterion (unchanged):** a Closing Bell — a human read-cold study
  (the scored transfer test, protocol now written) plus the automated eval
  ([posts/llm_manifold/evals/](../../posts/llm_manifold/evals/)), all green.
  **Blocked-on (unchanged):** the standalone/ad-hoc eval feature (tracked in the
  `ailly_two` repo) to run `manifold.yaml`'s judge assertion over a static `.md`
  without a hand-built conversation bridge; and the `ailly` CLI is not shipped in
  this repo. Until that lands, the judge criteria are written and specific but
  must be graded by manual/LLM review rather than the eval harness. The sibling
  HyDE lit review stays a separate deliverable in `ailly_two`; cite it lightly.
  Session: [.ailly/developer/2026-06-25-C-manifold](2026-06-25-C-manifold).
