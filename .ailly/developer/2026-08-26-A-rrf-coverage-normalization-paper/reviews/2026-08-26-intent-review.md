# Intent Review: RRF Coverage Normalization Paper

Dated 2026-08-26. Read backward from the original prompt
(`.ailly/prompts/rrf-coverage-normalization-paper`) through `research.md`,
`design.md`, and `plan.md`. Categorized by where each question's
divergence risk would enter.

## Research gap

1. **RBC quote is deferred, not resolved.** As researched, `research.md`
   records only a secondary attribution of the Rank-Biased Centroid
   formula and explicitly defers the primary-PDF fetch and direct quote to
   Feature 2. The original request calls this out as "the open thread,"
   phrased as something to resolve, not schedule. Do the design and plan
   correctly treat this as Feature 2's first deliverable rather than
   letting it slip further? *(Design/plan both name it explicitly in
   Feature 2's scope — low risk, but worth the human's confirmation that
   deferring the fetch past research-phase, rather than doing it now, is
   acceptable.)*

2. **`log(n+bias)` absence is a single search pass, not yet a
   falsification pass.** The original request requires "a systematic
   literature search... expand each query into synonym, narrow, broad, and
   alternate-phrasing variants" and "a falsification pass on any claim that
   a technique has no prior publication." `research.md`'s finding is one
   pass of ad hoc queries. Does the plan's Feature 2 scope commit
   unambiguously to the full expand/falsify method before the "not found"
   claim is stated as paper content, or could a builder read `research.md`
   as already-sufficient evidence and skip the deeper pass?

## Design assumption

3. **Fully sequential plan with no parallel steps.** The original request
   does not state whether feature-steps must be sequential. `design.md`
   assumes a strict linear dependency chain based on the "writing order"
   the prompt gives. Is the prompt's stated writing order meant as a
   sequencing instruction for building, or only as guidance for the
   *reading* structure and the order an author would naturally draft
   sections in (which sometimes tolerates more overlap than a strict
   dependency chain — e.g., Introduction motivation and Prior Art
   literature work could plausibly start concurrently on separate
   threads)? The design's zero-parallelism claim is a stronger reading
   than the prompt states outright.

4. **New top-level `posts/` directory vs. a subdirectory of
   `llm_manifold`.** The prompt says "Write adjacent to llm_manifold,"
   which `design.md` reads as a sibling directory
   (`posts/rrf_coverage_normalization/`). An alternative reading is a
   subdirectory *within* `llm_manifold` (e.g.
   `posts/llm_manifold/rrf_coverage_normalization/`) if "adjacent" was
   meant relative to the existing paper's internal structure rather than
   the `posts/` tree. Flagged in `design.md`'s Open Artifact Decisions,
   but not decided — needs the human's confirmation before Feature 1
   starts.

## Plan scope

5. **Benchmark-scale dataset is conditional in the prompt, but the plan's
   Feature 4 could quietly drop it under time pressure.** The prompt
   states "If found, or if space & time permit permit, also a simulation
   on a benchmark dataset." `plan.md`'s Feature 4 keeps this as an
   explicit "optionally" clause, correctly matching the prompt's hedge.
   Risk: because it is the only genuinely optional piece of required
   content, a builder under schedule pressure may drop it first without
   recording that decision — `design.md`'s Summary section names this as
   a deferred decision, but the plan does not name an explicit checkpoint
   for *when* that go/no-go call gets made (e.g., at Feature 4's own
   design step vs. only discovered at Feature 4's build step).

## Implementation surprise

*(Not applicable yet — no build has run in this session.)*

## Open Questions for the Human

The following require the user's judgment, not further automated research:

- **Document repository target.** `project-cycle.md`'s Long-Lived
  Documentation section requires detecting "the organization's configured
  document repository" for replicating accepted project docs. No such
  target is configured in this repository or evident from `DEVELOPMENT.md`.
  Where should the accepted `design.md`/`closing-bell.md` be replicated
  once approved (Notion, Google Drive, a repo-internal doc, or nowhere —
  keep local-only)?
- **Release-flag applicability.** The project shape calls for a
  project-level release flag gating user-visible exposure until the
  Closing Bell passes. This project's "release" is publishing a paper
  file (and possibly a blog post), not toggling application behavior
  behind a runtime flag. Does a literal release flag apply at all here, or
  does "release" for this project just mean "the file stays out of
  `docs/` (the published site output) until Cleanup," with no runtime flag
  needed?
- **Exact venue and format.** `research.md` and `design.md` both flag this
  as open: is the deliverable an arXiv-style preprint PDF only, a
  companion blog post (mirroring `llm_manifold/post.md`), or both? This
  affects which of `llm_manifold`'s Typst templates Feature 1 should
  generalize from.
- **New paper directory slug and location.** Sibling to `llm_manifold`
  under `posts/`, or nested inside it? (See Design assumption #4 above.)
- **Sequencing rigor.** Is the strict no-parallelism plan (Design
  assumption #3) the intended level of process rigor for a single-author
  paper, or is that more ceremony than this project needs — would the
  user prefer treating this closer to a long-form writing task with looser
  step boundaries?
