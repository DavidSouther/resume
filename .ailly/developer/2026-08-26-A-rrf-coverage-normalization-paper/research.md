# Research: RRF Coverage Normalization Paper

## Topic and Intent

> Write a comparative paper on reciprocal rank fusion (RRF) coverage normalization.
>
> ## Subject
>
> Reciprocal rank fusion (RRF) combines ranked lists from multiple retrievers.
> The plain RRF formula is a sum over retrievers that found a document:
>
>   score(d) = sum over retrievers r that found d of 1 / (k + rank_r(d))
>
> A document found by more retrievers earns more summed terms. This is a
> coverage bonus. The bonus has no limit. The bonus does not check rank
> quality. This paper compares methods that adjust or remove this bonus.
>
> [full prompt at `.ailly/prompts/rrf-coverage-normalization-paper`, sections: Approaches to compare, Required content, Method, Sketch of Outline, Output style]

The user's own framing: produce a rigorous, ASD-STE100 comparative academic
paper on five RRF coverage-adjustment approaches (plain RRF, average-form
division, flat per-retriever weighting, Rank-Biased Centroid, and a
candidate `log(n + bias)` term), built with the same Typst paper-building
machinery already used for `posts/llm_manifold`, and placed adjacent to it.

## Search/Expand

General-lens findings from an initial literature and documentation pass:

- **Plain RRF origin.** Cormack, Clarke, and Büttcher, "Reciprocal rank
  fusion outperforms condorcet and individual rank learning methods," SIGIR
  2009 [1]. Confirmed primary source, indexed on DBLP and in the ACM/SIGIR
  proceedings. The paper is the origin the required-content section asks
  for.
- **Rank-Biased Centroid (RBC).** Attributed by multiple secondary sources
  to Bailey, Moffat, Scholer, and Thomas, "Retrieval Consistency in the
  Presence of Query Variations," SIGIR 2017 [2]. RBC is described
  secondarily as using a persistence parameter `p` (borrowed from
  Rank-Biased Precision / Rank-Biased Overlap) to weight rank position.
  **Open thread, not yet resolved:** no primary-source formula has been
  fetched and quoted yet. The prompt requires fetching the primary PDF
  directly and quoting the exact formula, including whether it contains a
  logarithmic term and over what variable. This is deferred to the Prior
  Art / Mathematical Formulation feature-step, not resolved here.
- **Azure AI Search hybrid ranking.** Official Microsoft Learn documentation
  confirms Azure AI Search uses RRF to merge parallel BM25 and vector
  queries, and separately exposes a per-query "vector weighting" knob to
  increase the importance of a vector query in the request [3]. This is a
  flat per-retriever weight, independent of how many retrievers found a
  given document — matching approach 3 in the prompt. Documentation tier:
  official vendor documentation (not a primary academic paper).
- **`log(n + bias)` candidate term.** No confirmed prior publication was
  found in this initial pass using direct-name and paraphrase queries
  ("log(n" / "log(1+n" combined with RRF and coverage/retriever-count
  terms). Search results returned only generic RRF explainer blogs with no
  logarithmic coverage term. This is a **first-pass, not-found** result,
  not yet a falsification pass across adjacent fields (BM25/IDF,
  ensemble-voter-agreement weighting, recommender confidence damping) as
  the prompt's Method section requires. That systematic pass, plus the
  distinction between "not found in this search" and "does not exist," is
  deferred to the Prior Art feature-step.
- **No normalization by `n` is the RRF default.** Multiple sources
  (Elastic docs, implementer blog posts) confirm the textbook RRF formula
  does not divide by retriever count; division by `n` (approach 2, the
  "average form") is a documented variant discussed in secondary
  implementer sources, not the 2009 primary paper.

## Libraries & Skills

This task touches the Typst paper-building machinery already built for
`posts/llm_manifold` (`posts/llm_manifold/scripts/compile-manifold-paper.ts`
and its feature tests, `posts/llm_manifold/templates/manifold-preprint.typ`,
`posts/llm_manifold/fonts/`, `posts/llm_manifold/ieee.csl`,
`posts/llm_manifold/refs.bib` convention, `posts/llm_manifold/sections/`
layout). No published third-party agentic skill governs this machinery; it
is bespoke to this repository.

**Before doing any work in this feature, load these skills via the active
harness's skill-loading mechanism:** none external. Instead, before writing
any compile script for the new paper, **read** (not reinvent)
`posts/llm_manifold/scripts/compile-manifold-paper.ts`,
`compile-manifold-paper.feature.test.ts`, and the sibling
`manifold-*.feature.test.ts` files, and the `templates/manifold-preprint.typ`
+ `templates/manifold-table-widths.lua` pair, then extract/generalize the
shared parts (font provisioning, bibliography copy, Typst invocation,
section assembly) into a form the new paper's build script can call,
rather than re-deriving Typst/pandoc/font plumbing from scratch. This
directive carries forward into `design.md` and `plan.md`.

No research-skill gap was found for academic literature search or citation
management beyond the standard `research:papers` skill, which the Prior
Art feature-step should invoke directly for the systematic search and
falsification pass (arXiv, Semantic Scholar, DBLP, official vendor docs).

## Falsification/Refine

**Size: project.** This is confirmed project-shaped, not a single feature.
The deliverable is one paper, but it only has value once all of its parts
land together: a Prior Art survey with a resolved literature search and
falsification pass, a Mathematical Formulation section with five worked
formulas on shared notation, a Simulation section with at least one
worked small dataset (and optionally a benchmark-scale dataset), a
Discussion/Conclusion, an Introduction, an Abstract, a comparison table,
and a bibliography — each is close to worthless alone (an Abstract with no
finished Simulation to summarize is not shippable; a Mathematical
Formulation with no Prior Art grounding for RBC's formula cannot state
whether approach 5 is prior art or novel). This matches the project-shape
test in `project-cycle.md`: "several features that must ship together."

- **Off-the-shelf:** no off-the-shelf tool writes and verifies a cited
  academic comparison paper; the Typst/pandoc pipeline from
  `posts/llm_manifold` is the off-the-shelf-equivalent reused here.
- **Collaboration:** none identified; this is a single-author technical
  paper per the existing `llm_manifold` precedent.
- **Smallest version that still meets intent:** cannot drop any of the
  five approaches (the prompt names all five explicitly as in-scope), the
  worked numerical example (required per approach), the comparison table,
  or the RBC primary-source formula fetch (explicitly reopened by the
  prompt as an "open thread" to resolve). The benchmark-scale (hundreds to
  thousands of items) simulation is explicitly conditional ("if found, or
  if space & time permit") and can be deferred or dropped without breaking
  intent — this is the one feature-step boundary flexible enough to trim
  if the project grows past a handful of steps.

## Scope

**In scope for design:**
- One project design doc scoping feature-steps in the prompt's stated
  writing order: Prior Art, Mathematical Formulation, Simulation, Discussion
  /Conclusion, Introduction, Abstract, plus a Comparison Table and
  Bibliography that likely ride along with Prior Art / Mathematical
  Formulation rather than standing alone.
- A Closing Bell usability study: can a competent reader (familiar with IR
  ranking, not with this paper's specific claims) read the finished paper
  and correctly state, for each of the five approaches, its formula,
  source tier, and where it sits in the comparison table, and correctly
  identify which of the two approaches disagree on the stated dataset case
  and why.
- Reuse and generalization of `posts/llm_manifold`'s Typst build
  machinery for a new paper at `posts/rrf_coverage_normalization/` (exact
  path is an open artifact decision for design).

**Out of scope for design (deferred to feature-steps or later):**
- The actual literature search results, RBC primary quote, and
  falsification pass content — these are Prior Art feature-step work, not
  research-phase work.
- The actual worked numerical calculations — these are Simulation
  feature-step work.
- Any benchmark-scale (hundreds-to-thousands-item) dataset simulation is
  conditional and may be scoped out if time/space do not permit.

## Resolved Decisions

- **Resolved:** this is project-shaped (several feature-steps that only
  deliver value together), not a single feature or a bug fix.
- **Resolved:** the paper reuses `posts/llm_manifold`'s Typst/pandoc/font
  pipeline rather than building a new one from scratch.
- **Open for the human:** exact directory name and slug for the new paper
  under `posts/` (e.g. `posts/rrf_coverage_normalization/`).
- **Open for the human:** whether the benchmark-scale dataset simulation is
  committed to for this project or explicitly deferred to a follow-on task.
- **Open for the human:** target venue/format (arXiv preprint only, blog
  post, or both) — affects which of `llm_manifold`'s multiple Typst
  templates (preprint vs. arxiv-format) to reuse.

## Sources

[1] G. V. Cormack, C. L. A. Clarke, and S. Büttcher, "Reciprocal rank
fusion outperforms condorcet and individual rank learning methods," in
*Proc. 32nd Int. ACM SIGIR Conf. Research and Development in Information
Retrieval*, 2009. [Online]. Available:
https://dl.acm.org/doi/10.1145/1571941.1572114 (indexed at
https://dblp.org/rec/conf/sigir/CormackCB09.html).

[2] P. Bailey, A. Moffat, F. Scholer, and P. Thomas, "Retrieval Consistency
in the Presence of Query Variations," in *Proc. 40th Int. ACM SIGIR Conf.
Research and Development in Information Retrieval*, 2017. [Online].
Available: https://people.eng.unimelb.edu.au/ammoffat/abstracts/bmst17sigir.pdf
— secondary-source attribution only in this pass; primary PDF not yet
fetched or quoted. Publication tier: primary paper (citation identified,
full-text quote pending).

[3] Microsoft, "Relevance scoring in hybrid search using Reciprocal Rank
Fusion (RRF)," Azure AI Search documentation. [Online]. Available:
https://learn.microsoft.com/en-us/azure/search/hybrid-search-ranking.
Publication tier: official documentation.

[4] Elastic, "Reciprocal rank fusion," Elasticsearch Reference. [Online].
Available:
https://www.elastic.co/docs/reference/elasticsearch/rest-apis/reciprocal-rank-fusion.
Publication tier: official documentation (cited here only for the
no-division-by-n baseline observation, not as an RBC or log-term source).
