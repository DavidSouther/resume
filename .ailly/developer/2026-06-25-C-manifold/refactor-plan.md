# Refactor plan — after Step 2 (Sections 6-7)

- [x] **Three-Strikes Refactor** `posts/llm_manifold/evals/scripts/test_check_sections.py`,
  `test_worked_analyses.py`, `test_predicts_and_alternatives.py` (each near
  their top) — all three independently define `HERE`, `PAPER`, `REFS`,
  `CHECK_SECTIONS`/`CHECK_CITATIONS` script paths, and `test_worked_analyses.py`
  / `test_predicts_and_alternatives.py` each hand-roll a "text between this
  `##` heading and the next" regex. Extract a shared
  `evals/scripts/paper_test_helpers.py` with the path constants and a
  `section(text, n)` helper; import it from all three test files.
