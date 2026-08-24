> **Superseded 2026-08-24.** See [SUPERSEDED.md](SUPERSEDED.md). Do not resume.

# Research: Section 5 as a Design-Patterns Evaluation

## Topic and Intent

`posts/llm_manifold/sections/05_predicts_alternatives.md` currently holds two `##`
sections: `## 5. Applying the Lens to Agentic Harnesses` and
`## 6. Alternative Views and Limitations`. Section 5 is structured as a
retrospective validation of the lens — per operator family, an *Anticipation*, a
*Reported result*, and a *What remains untested*. That structure argues to a
reviewer that the lens is defensible. It does nothing for the stated reader.

The stated reader is an **agent harness engineer** holding a technique that did
not exist when Table 1 was written, saying "I'll improve my harness with this."
Section 5 must let that reader locate the technique against Section 4's
operators and read off what the technique can and cannot supply. The requested
genre is a **design patterns evaluation**, not a literature defense.

## Search/Expand

Existing internal context is sufficient; no new literature. Section 4 already
fixes the three-field operator characterization (**move**, **signal**,
**referent check**) and enumerates seven operators in Table 1. Section 7's
conclusion already states three diagnostic questions that map exactly onto those
three fields. So the vocabulary for a pattern-evaluation section is already in
the paper; Section 5 is the section that fails to use it.

Design-patterns genre supplies the missing shape: Intent, Forces (when to reach
for it), Mechanism, Consequences, Known uses, and the misapplication smell.
Compressed into a paper section this becomes one summary table plus worked
classifications of concrete techniques.

## Libraries & Skills

`developer:ailly`. Local tooling only: `evals/scripts/compose_paper.py` to
regenerate `paper.md`, and `evals/scripts/check_*.py` as the mechanical gate.

## Falsification/Refine

This is a prose restructure, not a research project. Smallest useful version:
Section 5 becomes a classification procedure plus a pattern table keyed to
Table 1's operators, plus worked classifications of techniques a harness
engineer would plausibly be excited about — including at least one the
procedure rejects as *not an operator*. Citations currently carried by Section 5
must survive as "known uses" so the evidence base is not lost.

## Scope

In scope: `sections/05_predicts_alternatives.md`; the Section 5 sentence in
`sections/02_intro.md`; the Section-5-referencing sentence in `## 6`; the
composition follow-through in `sections/07_conclusion.md`; regenerated
`paper.md`; `check_sections.py`'s `REQUIRED` outline contract; one new
`evals/scripts/test_operator_evaluation.py`.

Out of scope: new citations, new experiments, Sections 2-4 substance, `post.md`,
and the seven legacy `test_*.py` plan-step files that encode the superseded
ten-section outline.

## Resolved Decisions

- Keep Section 6 (Alternative Views and Limitations) in the same file; edit only
  the sentence that describes Section 5.
- Preserve every citation key Section 5 currently carries.
- Keep the paper's epistemic discipline: a classification predicts *where a
  technique's evidence comes from*, never the magnitude of its gain.
- Conclusion's three questions stay three; composition is the follow-through.

## Sources

`posts/llm_manifold/sections/*.md`, `posts/llm_manifold/evals/`,
`.ailly/developer/2026-07-08-A-llm-manifold-ruthless-edit/`.

## Pre-existing Findings (not caused by this session)

At `1eda7e4`, `check_sections.py` already fails: its `REQUIRED` list is the old
ten-section outline ("Prior Art and Novelty Boundaries", "Worked Analyses",
"What This Lens Predicts", "Evaluation and Claim Ledger"), and commit `1eda7e4`
renamed those headings and deleted `06_evaluation_claim_ledger.md`. Seven of the
ten `test_*.py` plan-step files fail for the same reason. `check_citations.py`
and `check_pandoc.py` are green.
