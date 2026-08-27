# Implementation Plan: Mathematical Formulation

**Feature test:** `posts/rrf_coverage_normalization/scripts/mathematical-formulation.feature.test.ts`
**User story:** Given the validated Prior Art evidence, compiling the RRF paper produces one shared-notation mathematical section with five sourced definitions and a correct account of the shifted-log bias.
**Libraries & Skills:** None. This feature uses the existing Markdown, Pandoc, and Typst pipeline. Apply Arrange-Act-Assert when changing or adding tests.
**Steps:**
- [x] Step 0: Fix the document and integration surface
- [x] Step 1: Author the shared notation and five definition blocks
- [ ] Step 2: Author the boundary and coverage analysis
- [ ] Step 3: Integrate the section and prove the compiled artifact

## Step 0: Fix the document and integration surface

No new runtime types, public functions, or compiler abstractions are needed. Preserve the existing `PaperPdfPaths`, `listPaperSections`, and `compileRrfCoverageNormalizationPaper` signatures. The feature adds this document surface:

```text
posts/rrf_coverage_normalization/sections/03_mathematical_formulation.md

## Mathematical Formulation
### Plain RRF
### Coverage division
### Fixed retriever weights
### Rank-Biased Centroid
### Shifted-log candidate
### Boundary and coverage analysis
```

The integration surface is the existing ordered section array in `compile-rrf-coverage-normalization.test.ts`, which must eventually include:

```text
resolve(paths.sectionsDir, "03_mathematical_formulation.md")
```

The pattern-selection beat found no applicable domain-object, newtype, or type-state pressure because the deliverable is prose and formulas, not a new software model. Arrange-Act-Assert applies to the existing compiler regression test and feature test.

**Tests**

Happy path: inspect the existing red feature test and confirm that its paths, exact headings, notation strings, formula strings, citations, and conclusions match the cleared design before implementation starts.

- Missing section file remains the expected initial red state.
- Do not weaken exact strings or collapse definition-block boundaries.
- Do not add a compiler API solely for this section.

**Implementation Outline**

Keep the existing compiler public surface unchanged. Add one Markdown section in Steps 1 and 2, then add it to the existing ordered compiler input in Step 3.

## Step 1: Author the shared notation and five definition blocks

**Enables:** The notation assertions, ordered-heading assertions, formula assertions, per-block evidence-tier assertions, and per-block citation assertions in the feature test.

Create `03_mathematical_formulation.md`. Define `I`, `I_d`, `n(d)`, `r_i(d)`, `k`, `w_i`, `phi`, `b`, and natural `log` before use. Add the five exact level-three definition headings in the designed order. Keep each formula, evidence label, and required citation inside its own heading-delimited block. Use short ASD-STE100 sentences and distinguish this paper's two definitions from sourced methods.

**Tests**

Happy path: read the authored Markdown, locate each heading exactly once and in order, then assert that each block contains its formula, evidence tier, and bibliography-backed citation key.

- A symbol used before its definition.
- A duplicate or reordered heading that breaks block ownership.
- A citation present elsewhere in the file but absent from the definition block.
- A coverage-division or shifted-log definition incorrectly presented as established prior art.
- A logN ISR precedent incorrectly described as using the RRF kernel.

**Implementation Outline**

Write a short section introduction and shared notation paragraph. For each definition block, state the exact formula, its domain constraints, its source or paper-defined status, and its evidence tier. Reuse the existing keys `@cormack2009`, `@azureVectorWeighting`, `@bailey2017`, and `@mourao2014`; do not add bibliography records.

## Step 2: Author the boundary and coverage analysis

**Enables:** Every `requiredConclusions` assertion in the feature test while leaving compilation integration as the remaining red condition.

Complete `### Boundary and coverage analysis` with the exact designed conclusions. Separate the returned-document domain from the finite zero-coverage extension. Cover `0 < b < 1`, `b = 1`, and `b > 1`; the limit as `b` approaches zero; the `b = 1` singleton; and the large-`b` finite-range behavior. Then distinguish the logarithmic multiplier's diminishing increments from the candidate's unbounded total coverage reward. State that fixed weights are independent of realized `n(d)` and are not coverage normalization.

**Tests**

Happy path: isolate the analysis block and assert that all boundary, limiting, fixed-weight, equal-rank growth, and normalization conclusions occur there.

- Treating `n(d)=0` as part of the normative returned-document domain.
- Silently strengthening `b > 0` to `b >= 1`.
- Saying `log(n+b)` bounds or removes the total coverage reward.
- Confusing diminishing increments of the multiplier with decreasing total score.
- Introducing numerical examples, rank-order judgments, or the Feature 4 comparison table.

**Implementation Outline**

Use compact analytic prose in this order: domain and zero extension; singleton and bias regimes; finite-range large-`b` behavior; fixed-weight distinction; equal-rank growth comparison; explicit non-normalization conclusion. Preserve the exact conclusion sentences required by the feature test while adding only enough explanation to connect them.

## Step 3: Integrate the section and prove the compiled artifact

**Enables:** The existing compiler unit test's ordered-section contract plus the feature test's successful compiler status, nonempty PDF, and generated-Typst assertions.

Update only the expected ordered `sections` array in `compile-rrf-coverage-normalization.test.ts` so `03_mathematical_formulation.md` follows `02_prior_art.md`. The production compiler already discovers numbered sections and requires no change. Run the focused compiler unit test and feature test, then run the repository's proportionate check command. Inspect the generated Typst for the required content and confirm the PDF is nonempty.

**Tests**

Happy path: arrange the paper-local paths and authored section, act by running the real compiler once, then assert ordered inputs, exit status zero, required generated Typst content, and a nonempty PDF.

- The new section appears before Prior Art or more than once.
- Markdown passes but a citation key is unresolved during compilation.
- The compiler exits successfully without producing a nonempty PDF.
- Generated Typst drops a formula, tier label, citation, or analysis conclusion.
- A focused test passes while the exact compiler section-list test still expects only two sections.

**Implementation Outline**

Extend the existing regression expectation by one ordered path. Do not modify shared compiler machinery. Run the focused tests through the repository's existing Node/Vitest scripts, compile through `compile-rrf-coverage-normalization.ts`, and retain generated build artifacts only according to the repository's current convention.
