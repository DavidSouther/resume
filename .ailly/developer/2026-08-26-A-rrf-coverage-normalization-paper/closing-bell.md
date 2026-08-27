# Closing Bell: RRF Coverage Normalization Paper

Written once, at project start, before any feature-step is built. Run once,
near project completion, against the finished PDF.

## Participant Profile

A reader with graduate-level or equivalent working knowledge of
information retrieval: understands ranked lists and precision/recall, but
does not necessarily know RRF before reading the paper's Introduction. The
participant must **not** have read this paper, its design docs, or its
source code before the study, and must not be coached during the study.

## Setup and Materials

- The participant receives only the compiled paper PDF (and its
  bibliography, as part of the PDF). No design docs, no source code, no
  author walkthrough, no slides.
- No time limit is announced in advance, but time on task is recorded.
- The participant may re-read the PDF as many times as they like within
  the session; no external search is permitted.

## Task Scenarios

1. **Recall the approaches.** "You have just read a paper comparing five
   ways to adjust reciprocal rank fusion's coverage bonus. Without looking
   back at the paper, name the five approaches and, for each, state its
   formula and where it comes from (a primary paper, official
   documentation, or something less certain)."
2. **Use the comparison table.** "You are building a hybrid search system
   where most documents are found by only one retriever, and you want
   single-retriever documents to still score above zero. Using the
   paper's comparison table, pick an approach that fits, and say why."
3. **Explain the disagreement case.** "The paper includes one example
   where two approaches rank the same two documents in a different order.
   Explain, in your own words, which order the author judges more
   correct, and why."

## Acceptance Criteria

| Task | Completion means | Time ceiling | Error ceiling | Ease/satisfaction floor |
|---|---|---|---|---|
| 1. Recall the approaches | All five approaches named with formula and source tier substantially correct (paraphrase accepted; wrong formula or wrong tier is an error) | 10 min re-read allowance | 0 approaches wrong on formula or tier | ≥4/5 on a 5-point ease scale |
| 2. Use the comparison table | Names an approach whose table row shows nonzero-at-n=1 = yes, and states that reason | 3 min | 0 (must cite the correct table row) | ≥4/5 |
| 3. Explain the disagreement case | States the same order the paper's Discussion names as correct, with a reason matching the paper's stated reasoning (not necessarily verbatim) | 5 min | 0 | ≥4/5 |

## Critical versus Secondary Tasks

- **Critical:** Tasks 1 and 3. A reader who cannot recall the five
  approaches and their tiers, or cannot explain the paper's own worked
  disagreement, means the paper failed at its core comparative purpose.
- **Secondary:** Task 2. Useful evidence the comparison table is usable
  as a decision tool, but a participant who reasons well from the wrong
  table cell (e.g., misreads a column) is weaker evidence of paper failure
  than failing Tasks 1 or 3, since Task 2 also tests table-reading
  mechanics unrelated to the paper's content quality.

All three critical-and-secondary tasks must be attempted; the project
passes when both critical tasks meet their acceptance criteria for a
majority of participants (recommended: at least 2 of 3 participants if
multiple are run; a single participant's pass is provisional evidence
only).
