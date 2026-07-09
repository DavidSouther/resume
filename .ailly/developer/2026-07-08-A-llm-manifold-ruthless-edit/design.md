# Design: llm_manifold Ruthless Edit

## Purpose

Make the paper and blog converge on the thesis instead of letting the paper's scaffolding become the object. The paper must stand alone; the blog is written in response to it.

## Prior Art

The existing literature review remains the source of novelty boundaries. This pass relies on the previous C-manifold session's conclusion: the contribution is a workflow-level diagnostic lens, not new manifold/category theory.

## User Journey and Metrics

A paper reader should encounter the thesis immediately, then see the rigorous support: literature boundary, operator table, worked analyses, predictions, claim ledger, and Lit Group transfer review. A blog reader should see an accessible response to that paper.

Primary metric: the existing paper checks remain green after regeneration:

`python3 posts/llm_manifold/evals/scripts/check_sections.py`
`python3 posts/llm_manifold/evals/scripts/check_citations.py`
`python3 posts/llm_manifold/evals/scripts/check_pandoc.py`

Secondary metric: `rg "blog|blog post|companion|posts/llm_manifold/paper.md|llm_manifold/paper.md" posts/llm_manifold/paper.md posts/llm_manifold/sections` returns no paper-language hits.

## Specification

- Put the exact thesis in the abstract and introduction.
- Keep "synthesis", "position", and "not a new formalism" visible.
- Preserve the existing literature review and novelty-boundary structure.
- Tighten Sections 4-6 so they explicitly demonstrate the thesis.
- Replace the readiness-gate wording that still used "Closing Bell".
- Rewrite the blog post as a response to the paper around document space, target regions, steering operators, and failure modes.

## Alternatives

A deeper rewrite could collapse the paper into a short essay, but that would lose the literature and claim-ledger work the user explicitly wanted to keep. A blog-only edit would leave the paper drifting. The chosen approach edits both surfaces while preserving the existing eval contract.

## Summary

Feature test: the three existing Python checks plus stale-wording grep. Quickloop auto-clears this design gate.
