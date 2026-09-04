# Implementation Plan: `mise papers` task

**Feature test:** `scripts/papers-mise-task.feature.test.ts`
**User story:** A contributor can build both current papers with `mise papers`, while retaining the Manifold-only `paper:pdf` command.

**Patterns:** No domain-object, newtype, or type-state pattern applies. This is an additive task-alias configuration change with no new application API.

**Steps:**

- [x] Step 0: Confirm the task surface
- [x] Step 1: Add the npm paper bundle script
- [x] Step 2: Add the Mise delegation task
- [x] Step 3: Validate both interfaces

## Step 0: Confirm the task surface

**Enables:** The feature test's exact declarations without altering the existing `paper:pdf` interface.

Add no types or functions. The public surface is configuration-only:

```text
npm run papers
mise papers -> npm run papers
```

**Tests**

The feature test is the happy-path contract. Confirm `paper:pdf` remains unchanged as a compatibility check.

**Implementation Outline**

Locate the existing Manifold compiler command in `package.json` and its Mise wrapper in `mise.toml`; retain both verbatim.

## Step 1: Add the npm paper bundle script

**Enables:** The feature test assertion that `packageJson.scripts.papers` invokes the canonical wrappers in Manifold-then-RRF order.

Add `papers` beside `paper:pdf` in `package.json`. Its command runs the existing Manifold wrapper and, only on success, the existing RRF wrapper.

**Tests**

Run `scripts/papers-mise-task.feature.test.ts`; its npm-script expectation passes once this declaration is exact.

- Wrapper path typo
- Reversed compiler order
- A first compiler failure incorrectly continuing to RRF

**Implementation Outline**

Use the two existing `node <paper>/scripts/<compiler>.ts` commands joined by `&&`; do not change either wrapper.

## Step 2: Add the Mise delegation task

**Enables:** The feature test assertion that `mise.tasks.papers.run` is exactly `npm run papers`.

Add `[tasks.papers]` to `mise.toml` with the same thin-wrapper convention as the existing tasks.

**Tests**

Run the feature test; its Mise-task expectation passes once the task delegates through npm.

- Direct compiler commands accidentally duplicated in Mise
- Singular `paper:pdf` task changed

**Implementation Outline**

Declare only `run = "npm run papers"`, keeping command ownership in `package.json`.

## Step 3: Validate both interfaces

**Enables:** The complete feature-test contract and the contributor-facing `mise papers` command.

Run the feature test, then invoke `mise papers` in the prepared checkout to confirm both wrappers execute successfully. Run the repository's appropriate static checks and inspect the diff for accidental generated-PDF or unrelated changes.

**Tests**

The feature test passes, and `mise papers` exits successfully after building Manifold then RRF.

- Missing tool provisioning
- A wrapper failure stops the sequence

**Implementation Outline**

Validate configuration first; then use the actual command as an integration check without changing compiler, template, font, or PDF source files.
