> **Superseded 2026-08-24.** See [SUPERSEDED.md](SUPERSEDED.md). Do not resume.

# Design: Section 5 as a Design-Patterns Evaluation

## Purpose

Turn Section 5 from a retrospective defense of the lens into the section a
harness engineer actually uses: a procedure for classifying a novel technique
against Section 4's operators, and a pattern catalog stating what each operator
can and cannot supply.

## Prior Art

Section 4 already supplies the three-field characterization (move, signal,
referent check) and Table 1's seven operators. The design-patterns genre
supplies Forces / Consequences / Known uses / misapplication smell. Section 5
composes the two.

## User Journey and Metrics

A harness engineer arrives with a technique. They read the four questions, get
an operator (or a composition, or a "not an operator" verdict), then read that
operator's row for the consequence they are accepting and the smell that says
they have misapplied it. The worked classifications show the procedure run on
techniques they recognize.

Primary metric — the mechanical gate, all green:

```sh
python3 posts/llm_manifold/evals/scripts/check_sections.py
python3 posts/llm_manifold/evals/scripts/check_citations.py
python3 posts/llm_manifold/evals/scripts/check_pandoc.py
python3 posts/llm_manifold/evals/scripts/test_operator_evaluation.py
```

`test_operator_evaluation.py` is this session's feature test.

## Specification

- Section 5 is renamed to state its job: evaluating a new technique against the
  operators.
- It opens with a four-question classification procedure. Questions one through
  three are Section 4's three fields (move, signal, referent check). Question
  four is composition: a composition inherits the *weakest* referent in its
  chain, not the strongest.
- A pattern-summary table (Table 2) has one row per Table 1 operator, with
  design-pattern columns: **Reach for it when**, **What it cannot supply**,
  **Misapplication smell**. The row keys must match Table 1 exactly, so the two
  tables cannot drift.
- At least four worked classifications, each answering all four questions and
  naming the consequence accepted. Each carries its known uses as citations.
- At least one worked case the procedure classifies as **not an operator**, to
  show the procedure can return no.
- A closing paragraph stating what a classification does not settle: not the
  magnitude of a gain, and not a ranking between two techniques that resolve to
  the same operator.
- Every citation key Section 5 carries today survives.
- Section 6's Section-5 sentence, Section 1's Section-5 sentence, and Section
  7's diagnostic are updated for coherence.
- `check_sections.py`'s `REQUIRED` is updated to the shipped eight-section
  outline, replacing the superseded ten-section list.

## Alternatives

*Full Gang-of-Four entries per operator* (Intent / Motivation / Structure /
Consequences / Known uses / Related patterns, seven times) — rejected: it would
triple the section's length and bury the procedure, which is the part that
generalizes to techniques not yet invented.

*Keep the Anticipation / Reported result / What remains untested triad and add a
procedure on top* — rejected: the triad's reader is a reviewer, not a harness
engineer, and keeping both makes the section argue with itself about who it is
for. The evidence the triad carried is preserved as each pattern's known uses.

*Resurrect the seven failing legacy plan-step tests* — rejected as out of scope.
They encode a ten-section outline the author deliberately superseded in
`1eda7e4`; rewriting them is its own task.

## Summary

Feature test: `posts/llm_manifold/evals/scripts/test_operator_evaluation.py`,
plus the three existing `check_*.py` scripts green. Quickloop auto-clears this
design gate.
