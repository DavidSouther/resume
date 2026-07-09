# Research: llm_manifold Ruthless Edit

## Topic and Intent

Quickloop pass on `posts/llm_manifold/`: the paper and blog must serve one thesis exactly: "Agentic LLM workflows can be understood as operators steering a document through syntactic space toward a target region of acceptable artifacts."

## Search/Expand

Use the existing C-manifold research and the current paper draft. Do not reopen the literature review; it is explicitly retained. The strongest known constraints are contribution-first framing, Lit Group as a group review process, no "Closing Bell" language, and `posts/llm_manifold/` as the live path.

## Libraries & Skills

Before doing any work in this feature, load these skills via the active harness's skill-loading mechanism: `developer:ailly`. No additional framework skill is needed; the relevant local tooling is the existing `posts/llm_manifold/evals/` Python checks and the `compose_paper.py` generator.

## Falsification/Refine

This is a prose/editing quickloop, not a new research project. The smallest useful version is: exact thesis in abstract and introduction, paper framing made standalone, stale path/review language removed, blog rewritten as a response to the paper's operator story, and existing evals still green.

## Scope

In scope: section source files, generated `paper.md`, `post.md`, eval wording, and this session's Ailly artifacts. Out of scope: new citations, new experiments, new diagrams, changing the literature review substance, and changing the old 2026-06-25 project artifact history.

## Resolved Decisions

- Keep the prior-art/literature review intact except for downstream coherence.
- Replace the blog's old geometry walk with a builder-facing operator explanation.
- Remove current `Closing Bell` wording from the live paper/eval surface.
- Use existing eval scripts as the quickloop feature test.

## Sources

Local project sources: `posts/llm_manifold/sections/*.md`, `posts/llm_manifold/post.md`, `posts/llm_manifold/evals/`, and `.ailly/developer/2026-06-25-C-manifold/`.
