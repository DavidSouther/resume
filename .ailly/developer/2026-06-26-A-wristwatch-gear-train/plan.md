# Implementation Plan: Astrolabe Clockwork Rear Face

**Feature test:** `src/components/astrolabe/clockwork.feature.test.ts`
**User story:** A reader sees the existing astrolabe dial as the front face and a rear caseback with the base wristwatch going train plus Copernican, Keplerian, and Galilean motion-train tables.

Before doing any work in this feature, load these skills via the Skill tool: `using-jiffies-dom`.

**Steps:**
- [x] Step 0: API surface area
- [x] Step 1: Pure clockwork model
- [x] Step 2: Rear-face Jiffies component
- [x] Step 3: Stage wiring and CSS polish
- [x] Step 4: Verification and cleanup

## Step 0: API Surface Area

Patterns selected: domain objects/value objects for gear rows and motion trains; arrange-act-assert for the feature test; triangulation if a hardcoded table hides a formula bug.

```typescript
export interface GoingTrainRow {
  id: string;
  wheel: string;
  pinionTeeth: number;
  teeth: number;
  rph?: number;
  rateLabel: string;
  arbor: string;
}

export interface MotionTrain {
  id: "copernican" | "keplerian" | "galilean";
  label: string;
  branchArbor: string;
  rows: MotionTrainRow[];
}

export interface MotionTrainRow {
  kind: "reference" | "orbital";
  disk: string;
  arbor: string;
  relativeRate: number;
  direction: "forward" | "reverse" | "locked";
  ratioLabel: string;
  mechanism: string;
}
```

## Step 1: Pure Clockwork Model

Build `src/lib/astrolabe/clockwork.ts`. Define the baseline going train and derive mode rows from `BODIES`, `EARTH_YEAR`, and `displayedRate`. The feature test should advance from module-resolution failure to missing DOM assertions.

Tests: `clockwork.feature.test.ts` plus optional focused unit checks if formatting or derivation gets subtle.

## Step 2: Rear-Face Jiffies Component

Build a `ClockworkRearFace` FCC that renders an SVG gear map and tables from `GOING_TRAIN` and `MODE_TRAINS`. Keep callbacks and objects out of FCC props; use imported static data or DOM-valid props only.

Tests: feature test should now find the caseback and data rows once the component is mounted.

## Step 3: Stage Wiring and CSS Polish

Add the rear face to `ControlsDrawer` and `DrawerInternals`, return it from the stage, and style it in `ASTROLABE_CSS`. Keep the dial visible and avoid interfering with the controls gear button.

Tests: run the feature test and no-raw-DOM guard.

## Step 4: Verification and Cleanup

Run `mise exec -- npx vitest run src/components/astrolabe/clockwork.feature.test.ts`, then broader astrolabe tests and project checks as time allows. Update this checklist and leave no draft gates.
