# Design: Astrolabe Clockwork Rear Face

## Purpose

Make the astrolabe read as a clockwork object rather than only an analytical orbital diagram. The front face remains the existing astrolabe dial. A rear caseback is added to the stage, showing the base wristwatch going train and separate suggested motion trains for the requested Copernican, Keplerian, and Galilean modes. The rear face is explanatory and mechanical: every orbital disk has its own named gear/arbor, and every mode table says which going-train arbor it branches from.

Before doing any work in this feature, load these skills via the Skill tool: `using-jiffies-dom`.

## Prior Art

The current astrolabe already has a clean split between pure frame state and Jiffies-rendered stage components. `ControlsDrawer` owns the dial and overlays, while the pure astrolabe domain data lives under `src/lib/astrolabe`. The existing modes are `PTOLEMAIC`, `GALILEAN`, and `KEPLERIAN`; the user prompt asks for Copernican, Keplerian, and "Gallilean". For this feature, the rear face renders the prompt's requested motion-train names directly, using the corrected spelling "Galilean", without changing the app's existing mode controls.

The research baseline supplies the five-spring going train: barrel, center, third, fourth, escape, and balance reference. That train is treated as a derived 18,000 bph baseline, not as a named commercial caliber.

## User Journey and Metrics

A reader opens `/astrolabe/` and still sees the astrolabe dial as the principal front face. Behind and beside it, the rear caseback shows a compact gear diagram and tables: the going train first, then three motion trains. The going train names the center wheel as the minute reference, fourth wheel as the seconds arbor, escape wheel at 600 RPH, and balance at 18,000 BPH. Each mode table names its branch arbor and lists one orbital row per disk, with unique arbors.

Acceptance is one executable feature test: `src/components/astrolabe/clockwork.feature.test.ts`. It builds the stage, confirms the dial is still present, confirms the rear caseback exists, checks every going-train row renders, checks all requested mode tables render, and proves each orbital disk has a unique arbor within its table.

## Specification

Add `src/lib/astrolabe/clockwork.ts` as the pure data/model module. It exports `GOING_TRAIN` and `MODE_TRAINS`, plus helpers for formatting rates. The going train is exactly the user-provided baseline. Motion-train rows are value objects: `disk`, `arbor`, `branchArbor`, signed `relativeRate`, direction, and a short ratio/mechanism label.

Copernican and Keplerian use sidereal orbital rates derived from `BODIES`. Keplerian notes an equation cam/differential where exact elliptical speed is only suggested, not solved. Galilean uses the existing `displayedRate(body, GALILEAN)` synodic surface; outer planets can reverse, so signed rates are preserved and rendered.

Add a Jiffies FCC rear-face component under `src/components/astrolabe/`. It renders semantic tables and an SVG gear diagram from the pure data. Add it to `ControlsDrawer` so SSG and client adoption both build it through the same stage path. Style it in `ASTROLABE_CSS` as a quiet caseback layer, with responsive constraints so it does not cover the dial on small screens.

## Alternatives

Changing the existing app modes to add Copernican was rejected: the prompt only asks for suggested motion trains, and changing controls would enlarge the task. Encoding all gear data directly in the component was rejected because the ratios and rows are domain data and need focused tests.

## Summary

This is a small feature: one pure clockwork model, one rear-face Jiffies projection, one feature test, plus CSS. The tables are intentionally suggestions; the astrolabe's existing closed-form orbital simulation remains the source of front-face positions.

**Feature test:** `src/components/astrolabe/clockwork.feature.test.ts`
