# Thinking: exact-conclusion-line-wrapping

**Error:** `expect(analysis).toContain("The singleton multiplier is positive for every b > 0.")`

**Context:** Step 2: Author the boundary and coverage analysis. This step must preserve every exact sentence in `requiredConclusions` while adding compact explanatory prose.

## Situation Summary

The analysis block contains the required mathematical conclusions, and the first exact-string assertion passes. The second assertion fails because the Markdown hard-wraps the sentence after `is`, so the source contains `is\npositive` instead of the required contiguous substring `is positive`.

## Root Cause Analysis

The feature test intentionally applies `toContain` to raw Markdown before compilation. A physical newline inside any required conclusion changes that raw string, even though Markdown rendering treats the newline as ordinary whitespace and the prose appears correct to a reader. This is not a mathematical error and should not be fixed by weakening the test: Step 2 explicitly requires preserving the exact conclusion sentences. The same wrapping pattern appears in additional required conclusions, so repairing only the currently reported sentence would expose later failures.

## Forward-Backward Map

- Desired green for Step 2: every `requiredConclusions` value is a contiguous substring of the isolated Markdown analysis block.
- Required source invariant: no physical newline occurs inside any required conclusion sentence.
- Current red: prose was wrapped to a conventional line width without respecting exact-sentence boundaries.
- Corrective action: reflow the analysis block at sentence boundaries, keeping each required conclusion on one physical line while allowing explanatory sentences and paragraph breaks around them.

## Next Steps (in order)

1. **Reflow every required conclusion as one uninterrupted physical Markdown line** — expected outcome: the raw-source `toContain` loop accepts the second conclusion and does not stop on later conclusions that currently cross line boundaries.
2. **Keep prose organization and mathematical content unchanged, placing line breaks only between complete sentences or paragraphs** — expected outcome: Step 2 still covers the returned-document domain, finite zero-coverage extension, bias regimes, fixed-weight distinction, and unbounded total reward without introducing Feature 4 material.
3. **Run the focused feature test after the reflow** — expected outcome: all raw-Markdown conclusion assertions pass; any remaining red is the planned Step 3 compilation-integration condition rather than another sentence-wrapping mismatch.
