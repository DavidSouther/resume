# Closing Bell — Astrolabe FCC refactor

*Draft 2026-06-23*

The project's exit criterion. Written once, now, before the features are designed; run
once, near completion. It fixes "done" as **parity**: the Astrolabe must look and
behave exactly as it does on `main`, with every DOM interaction now flowing through
Jiffies. It is a qualitative usability study, not a continuously-running test (the
source-scan guard and behavioral frame test play that role).

## Participant profile

A competent web user who has **used the Astrolabe page before on `main`** (so they
hold a mental model of how the dial looks and responds) but who has **no knowledge of
the refactor** — not told that anything changed, not shown the code, not told what
"FCC" or "no raw DOM" means. A second, optional participant: a front-end engineer
familiar with the page who can speak to perceived smoothness, but who likewise is not
briefed on the internals.

## Setup and materials

- Provided: the deployed page (the refactored build) at `/astrolabe/`, on a normal
  desktop browser and a phone, fresh profile (empty `localStorage`) for the first
  pass, then a second pass after a reload to check persistence.
- Provided for the evaluator only: a side-by-side `main` build to compare against.
- Withheld: any walkthrough, the design docs, the source, the word "refactor", and the
  author over the shoulder.

## Task scenarios (user's language)

1. **Watch it run.** "Open the page and just watch the solar system move for a bit."
2. **Wind time.** "Make time move — grab one of the planets and spin it around, then
   put it back."
3. **Change the worldview.** "Switch between the Earth-centered and Sun-centered
   views."
4. **Tune the look.** "Open the settings, turn some layers on and off, change the case
   material and color, and shrink the watch to a wrist size."
5. **Inspect a sign.** "Hover or tap a zodiac sign and a planet to see what's there."
6. **Come back later.** "Reload the page — your settings should be how you left them."

## Acceptance criteria per task

Each task's correct completion is **indistinguishable from `main`** to the participant
and to the evaluator's side-by-side comparison.

| # | Task | Critical? | Pass threshold |
|---|------|-----------|----------------|
| 1 | Watch it run | Critical | Animation is smooth (no visible stutter/flicker vs `main`); all bodies, orbits, guilloche, twilight cone, sparkles, hands render as on `main`. |
| 2 | Wind time | Critical | Drag winds time with no jump on release; hands hide during drag and restore; clock tracks. Identical feel to `main`. |
| 3 | Change worldview | Critical | Ptolemaic/Galilean/Keplerian switch is continuous (no snap); retrograde, sun disc/center glow, spokes toggle correctly as on `main`. |
| 4 | Tune the look | Critical | Every toggle/slider/segment/material/color/size control produces the same effect as `main`; drawer opens/closes from the pancake. |
| 5 | Inspect a sign | Secondary | Tooltip and sign card show the same content and position as `main`. |
| 6 | Come back later | Critical | All drawer settings persist across reload exactly as on `main`; Reset clears them. |

Thresholds: every **Critical** task completes with **zero observed behavioral
differences** from `main`; time-on-task within normal range (no new confusion
introduced); participant's unprompted reaction does not flag anything as "off",
"broken", or "different". Secondary task informs but does not block.

A pass is **human evidence** from this study, recorded here at run time, in addition
to: the source-scan guard green across all in-scope modules, the behavioral frame test
green, and every pre-existing `*.feature.test.ts`/`*.test.ts` still green.

## Result

*To be recorded when the study is run, near project completion.*
