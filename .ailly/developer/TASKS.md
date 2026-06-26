# TASKS

Next-step queue for `developer:ailly` sessions in this repo.

## Follow-ups

- **manifold paper + post (LLMs as a model of syntactic space)** — A **project**
  (project loop; see [.ailly/developer/2026-06-25-C-manifold/design.md](2026-06-25-C-manifold/design.md),
  phase: Review). Turn the blog-tone draft into a synthesis/position paper whose
  contribution is the **agentic-workflow lens**, not a new formalism. Deliverables:
  the blog post [posts/llm_manifold/post.md](../../posts/llm_manifold/post.md) and
  the paper [llm_manifold/paper.md](../../llm_manifold/paper.md) (Markdown + pandoc
  target; IEEE cites in [llm_manifold/refs.bib](../../llm_manifold/refs.bib) + an
  `ieee.csl`). Research (5 sweeps + 13 PDFs) and the design moved here from the
  `ailly_two` repo; **load-bearing finding:** the manifold/categorical/phase-space
  vocabulary is already published (esp. Bradley–Terilla–Vlassopoulos's enriched
  category of texts with LM probabilities, arXiv:2106.07890 / 2501.06662), so v1
  must bound novelty and the endofunctor formalism + loss-landscape↔manifold bridge
  are deferred. **Exit criterion:** a Closing Bell — a human read-cold study plus
  the automated eval ([llm_manifold/evals/](../../llm_manifold/evals/)): section,
  IEEE-citation, and pandoc checks (run red today) + an LLM judge over the claim
  ledger. **Feature-steps:** (1) finalize the outline + claim-ledger contract;
  (2..N-2) per-section prose (parallel after step 1); (N-1) holistic review +
  pin the one sharp agentic claim; (N) bibliography pass. **Blocked-on:** the
  standalone/ad-hoc eval feature (tracked in the `ailly_two` repo) to run the eval
  over a static `.md` without a hand-built conversation bridge; and the `ailly` CLI
  is not shipped in this repo (build-phase wiring). The sibling HyDE lit review
  stays a separate deliverable in `ailly_two`; cite it lightly. Session:
  [.ailly/developer/2026-06-25-C-manifold](2026-06-25-C-manifold).
