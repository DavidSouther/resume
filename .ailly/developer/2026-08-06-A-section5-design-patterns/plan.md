> **Superseded 2026-08-24.** See [SUPERSEDED.md](SUPERSEDED.md). Do not resume.

# Implementation Plan: Section 5 as a Design-Patterns Evaluation

**Feature test:** `posts/llm_manifold/evals/scripts/test_operator_evaluation.py`
plus `check_sections.py`, `check_citations.py`, `check_pandoc.py` green.
**User story:** As a harness engineer holding a novel technique, I can decide
what that technique can and cannot supply, because Section 5 classifies it
against the operators and names the consequence I am accepting.

**Steps:**

- [x] Step 0: Write the feature test (red)
- [x] Step 1: Rewrite Section 5 as procedure + pattern table + worked classifications
- [x] Step 2: Update cross-references in Sections 1, 6, and 7
- [x] Step 3: Update `check_sections.py`'s `REQUIRED` to the shipped outline
- [x] Step 4: Regenerate `paper.md` and run the whole gate

## Step 0: Write the feature test

`test_operator_evaluation.py` asserts the Section 5 contract: the four question
axes are named; Table 2's row keys are derived from Section 4's Table 1 so the
two cannot drift; the design-pattern columns are present; four or more worked
classifications each answer all four questions; one case resolves to "not an
operator"; the does-not-settle caveat survives; every previously cited key is
still cited.

## Step 1: Rewrite Section 5

Edit `sections/05_predicts_alternatives.md`'s `## 5` only. Leave `## 6` alone
except its Section-5 sentence.

## Step 2: Update cross-references

`02_intro.md`'s Section 5 sentence, `## 6`'s "retrospective readings" sentence,
`07_conclusion.md`'s diagnostic gains the composition follow-through.

## Step 3: Update the outline contract

`check_sections.py`'s `REQUIRED` becomes the eight headings the paper ships.
`test_check_sections.py` must stay green (no substring collisions among titles).

## Step 4: Regenerate and verify

`compose_paper.py`, then the four checks. Report the seven pre-existing legacy
test failures rather than fixing them.
