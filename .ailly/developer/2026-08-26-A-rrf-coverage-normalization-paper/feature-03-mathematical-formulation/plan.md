# Implementation Plan: Mathematical Formulation Revision

**Feature test:** `posts/rrf_coverage_normalization/scripts/mathematical-formulation.feature.test.ts`
**User story:** A retrieval researcher can decode every symbol, compare how rank and parameter changes affect each fusion rule, and distinguish the additive-shift and base-log coverage branches from their formulas, prose, citations, and sensitivity figure.
**Libraries & Skills:** None. Use the existing Markdown, Pandoc, Typst, Node, and Vitest pipeline. Apply Arrange-Act-Assert when revising the feature test.
**Steps:**
- [x] Step 0: Fix the revised document, figure, and verification surface
- [x] Step 1: Rebuild the notation introduction and named score definitions
- [x] Step 2: Teach the sensitivity of every scoring rule
- [x] Step 3: Separate the shifted-log and base-log branches and preserve boundary analysis
- [x] Step 4: Build the sensitivity figure, integrate it, and verify the paper artifact

## Step 0: Fix the revised document, figure, and verification surface

No new public runtime API or compiler abstraction is needed. Preserve
`PaperPdfPaths`, `listPaperSections`, and
`compileRrfCoverageNormalizationPaper`. The revision changes these existing or
paper-local surfaces:

```text
posts/rrf_coverage_normalization/sections/03_mathematical_formulation.md
posts/rrf_coverage_normalization/scripts/mathematical-formulation.feature.test.ts
posts/rrf_coverage_normalization/figures/parameter-sensitivity.svg
posts/rrf_coverage_normalization/scripts/generate-parameter-sensitivity-figure.ts
```

The figure path and generator name may be adjusted during Build if the existing
compiler has a stricter paper-asset convention, but the artifact must remain
paper-local, deterministic, vector-based, and reproducible without a network
dependency. No domain-object, newtype, or type-state pattern applies: the public
surface is mathematical prose and a compiled figure, not a software domain
model.

Revise the feature-test contract before changing the section. Replace assertions
that require `Evidence tier`, `this paper`, or generic `log` wording. Add
assertions for symbol domains, all named score definitions, direct citations,
the two distinct logarithmic branches, substantive sensitivity claims, the
figure reference and file, generated Typst, and nonempty PDF. Avoid brittle
whole-paragraph matching; keep exact assertions for formulas and mathematical
invariants.

**Enables:** A red feature test that precisely describes every requested
revision without weakening the existing formula, RBC endpoint, citation,
boundary, large-shift, compiler, or PDF assertions.

**Tests**

Happy path: arrange the authored section and bibliography, read and partition
the section by its stable headings, and assert the revised contract in the
proper block before compiling the real paper.

- `\log` or prose saying “log denotes natural logarithm” remains anywhere in
  the mathematical section or its generated Typst.
- A removed tier label or “this paper” phrase survives in prose or generated
  output.
- A formula is present globally but absent from its owning method block.
- Prose mentions the figure but the asset is absent, empty, or omitted from the
  generated paper.
- A test accidentally accepts the malformed identity
  `ln(n+b) = B ln(n)`.

**Implementation Outline**

Update the existing feature test in Arrange-Act-Assert order. Keep one source
read, block-specific assertions, bibliography-key checks, one real compiler
invocation, generated-Typst checks, and output-PDF checks. Assert semantic
claims through compact stable fragments rather than reproducing all teaching
prose verbatim.

## Step 1: Rebuild the notation introduction and named score definitions

**Enables:** The revised feature test's notation, domain, score-definition,
natural-logarithm, phrasing, and citation assertions.

Replace the terse introduction with a compact symbol table or equivalent prose
that explains every object and parameter before use. It must say exactly which
quantities are integer-, natural-, and real-valued:

- Let the finite retriever index set be
  `I={1,...,m}` with `m in N_+` and hence `I subset Z`; define `d` as a document,
  not a numeric variable.
- Define `I_d subseteq I`, and define
  `n(d)=|I_d| in {0,...,m} subset Z_{>=0}`. On the returned-document domain,
  state `n(d) in {1,...,m} subset N_+`; reserve `n(d)=0` for the boundary
  extension.
- Define `r_i(d) in N_+` as a one-based rank.
- Define `k in R_{>0}`, `w_i in R_{>=0}`,
  `phi in [0,1) subset R`, additive shift `b_s in R_{>=0}`, base parameter
  `b_l in R_{>1}`, and `B=1/ln(b_l) in R_{>0}`. Use distinct subscripts so one
  glyph is not silently assigned two meanings.
- State the codomains of `q_phi(r)` and each score as real-valued, with
  nonnegativity on its stated domain.

Use `\ln` in every formula and in prose; remove the standalone sentence that
explains `log`. Explicitly introduce each named function, not only its displayed
formula: `S_RRF`, `S_avg`, `S_w`, `S_RBC`, the additive shifted-log score
`S_shift`, and the base-log/strength score `S_base`. If the final notation keeps
`S_log` for continuity, assign it to exactly one branch and never use it
ambiguously.

Remove every `Evidence tier` line and all “this paper defines/proposes” or
generic “this paper” phrasing. Attach the relevant source directly to the claim:
RRF to `@cormack2009`, fixed weights to `@azureVectorWeighting`, RBC to
`@bailey2017`, and the inverse-square logN ISR precedent to `@mourao2014` while
clearly saying its rank kernel differs. Describe coverage division and the two
candidate branches directly as comparators/proposals built from the cited RRF
kernel; do not imply that an external source established them.

**Tests**

Happy path: each symbol appears in the introduction with its meaning and exact
domain, then each score name is introduced in its own block with its complete
formula and local source citations.

- `n(d)=0` is incorrectly included in the returned-document domain.
- `N` is used without saying whether it includes zero.
- `b_s` and `b_l` are conflated, or `B` lacks its definition.
- A score symbol is shown in a formula without prose explaining what it scores.
- `ln` conversion misses prose, a subscript, a limit, a generated-output
  assertion, or a figure label.
- A direct citation becomes detached from the claim or formula it supports.

**Implementation Outline**

Write the intro in the reading order document, retriever set, coverage, rank,
then real parameters. Follow it with stable method blocks containing the named
function, formula, domain, and direct provenance. Keep the corrected
piecewise-continuous RBC endpoint and “no interpretation of `0^0`” statement.

## Step 2: Teach the sensitivity of every scoring rule

**Enables:** The feature test's method-by-method rank, parameter, coverage, and
justification assertions.

Substantially expand each method block so it teaches how its score changes,
what can change an ordering, and why that behavior is useful or risky. Cover at
least these exact relationships:

- **Plain RRF:** better rank increases a contribution; increasing `k` lowers all
  terms and compresses the contrast between early and late ranks; each extra
  supporting retriever adds a positive term, so realized coverage can overcome
  weaker ranks. Explain why `k` is a rank-damping constant rather than a
  coverage normalizer.
- **Coverage division:** retain the RRF response to `r_i` and `k`, but explain
  that adding a retriever raises the mean only when its reciprocal-rank
  contribution exceeds the current mean, lowers it when below, and leaves it
  unchanged when equal. Under equal ranks, the score is invariant to `n`.
  Explain the tradeoff: it removes the automatic reward for agreement but can
  discard useful consensus evidence.
- **Fixed retriever weights:** show linear sensitivity to `w_i`, reciprocal
  sensitivity to rank and `k`, and additive sensitivity to support. A zero
  weight removes a retriever; multiplying all weights by one positive constant
  rescales scores without changing order, while relative weights can change
  order. Explain why fixed priors are not realized-coverage normalization.
- **RBC:** each one-rank descent multiplies the positive-`phi` contribution by
  `phi`; `phi=0` retains only rank one; larger `phi` makes decay slower but
  reduces the rank-one mass. For a fixed rank `r>1`, note the contribution is
  not globally monotone in `phi` and peaks at `phi=(r-1)/r`; do not use the vague
  claim that larger `phi` always raises every score. Additional supporting
  retrievers still add nonnegative mass. Explain the geometric browsing-depth
  interpretation and the corrected endpoint.
- **Additive shifted log:** at fixed `n`, ranks and `k` act through `S_RRF`; at
  fixed RRF score, increasing coverage or `b_s` increases the multiplier, while
  marginal coverage increments diminish. Explain that changing `b_s` changes
  cross-coverage comparisons, but for documents with the same `n` the positive
  multiplier preserves their RRF order (apart from the `b_s=0,n=1` zero tie).
- **Base-log/strength branch:** for `n>1`, rank and `k` act through `S_RRF`, and
  increasing `n` raises `ln n`; every singleton scores zero. `B>0` only rescales
  all documents when global, so it cannot change a ranking. Equivalently,
  increasing the base `b_l` decreases `B=1/ln b_l`; this changes score magnitude,
  not order. Explain why this branch is a qualitatively different singleton and
  coverage policy from the additive shift.

Tie every interpretation to the displayed mathematics. Do not merely list
derivative signs: include the ranking consequence and design justification in
plain language.

**Tests**

Happy path: each method block includes claims for all parameters that affect it,
rank movement, coverage movement, ordering consequences, and the rationale for
the design.

- Saying that larger `phi` monotonically increases all RBC contributions.
- Saying that global scaling by `B` or by all `w_i` changes order.
- Saying coverage division always penalizes another supporting retriever.
- Discussing `n` only as a multiplier and omitting its interaction with the RRF
  sum.
- Calling fixed weights or shifted log a normalization without qualification.

**Implementation Outline**

For each block, move from term-level behavior, to parameter changes, to
document-ordering consequences, to design rationale. Use a small analytic
identity or ratio only where it makes a non-obvious claim precise; keep
numerical simulation and empirical conclusions out of this section.

## Step 3: Separate the shifted-log and base-log branches and preserve boundary analysis

**Enables:** The feature test's two-branch identity, non-equivalence, boundary,
limit, and coverage-growth assertions.

Present the requested alternatives as two mathematically distinct branches:

1. **Additive-shift branch:**
   `S_shift(d;b_s)=S_RRF(d) ln(n(d)+b_s)` for `b_s>=0` and returned documents
   `n(d)>=1`. At `b_s=0`, the formula is defined on returned documents, but a
   singleton multiplier is zero and the `n=0` logarithm is undefined. For the
   finite zero-coverage extension and its sign analysis, retain the existing
   stricter condition `b_s>0`.
2. **Base-log branch:**
   `S_base(d;b_l)=S_RRF(d) log_{b_l}(n(d))` for `b_l>1`, then apply change of
   base:
   `S_base(d;b_l)=B S_RRF(d) ln(n(d))` with
   `B=1/ln(b_l)>0`.

State explicitly that `B S_RRF ln n` is **not** obtained by extracting a
constant from `ln(n+b_s)`: generally
`ln(n+b_s) != B ln n`. It is a reparameterization of `log_{b_l} n`, not an
algebraic rewrite of the additive-shift formula. This distinction is required
to avoid giving the two meanings of `b` one symbol.

Preserve and translate the current additive-branch boundary analysis to `ln`:
the `0<b_s<1`, `b_s=1`, and `b_s>1` zero-coverage signs; the zero empty-sum
extension for `b_s>0`; `b_s -> 0`; the `b_s=1` singleton; the uniform finite
coverage large-`b_s` limit after division by `ln b_s`; convergence of strict
RRF comparisons; and finite-`b_s` differentiation of RRF ties. Preserve the
fixed-finite-`I` qualification.

Compare equal-rank growth explicitly. Plain RRF grows as `n`; coverage division
is constant; additive shifted log grows as `n ln(n+b_s)`; and the base-log
branch grows as `B n ln n`. Both logarithmic branches have diminishing
multiplier increments but unbounded total growth over a growing-retriever
family. For a fixed finite `I`, every score remains bounded. Keep fixed weights
separate from coverage normalization.

**Tests**

Happy path: isolate the boundary-analysis block and assert both branch formulas,
`B=1/ln(b_l)>0`, the explicit non-equivalence statement, every retained
additive boundary/limit conclusion, and the four equal-rank growth laws.

- Treating `0 * ln(0)` as a valid zero-coverage extension at `b_s=0`.
- Requiring `b_s>0` for the returned-document formula and thereby losing the
  requested `b_s=0` branch.
- Claiming `ln(n+b_s)` factors into a constant times `ln n`.
- Defining `B=ln b_l` instead of the change-of-base value `1/ln b_l`.
- Losing the fixed-finite-range qualification from the large-shift limit.
- Confusing diminishing increments in a multiplier with bounded total score.

**Implementation Outline**

Introduce the branch split before boundary analysis, use non-overloaded
subscripts throughout, and give each equation its own domain. Analyze the
additive branch first so the existing proof remains recognizable, then compare
the base-log branch by singleton behavior, global scale, and equal-rank growth.

## Step 4: Build the sensitivity figure, integrate it, and verify the paper artifact

**Enables:** The feature test's figure-source, section-reference,
generated-Typst, compiled-PDF, and full revised-content assertions.

Create one legible multi-panel vector figure that shows how every parameter
affects every applicable scoring rule. Use normalized illustrative values and
label them as such; the graph teaches analytic behavior rather than reporting
an experiment. Include:

- a rank panel varying `r` for RRF-family terms and several `k` values, weighted
  RRF for several `w_i`, and RBC for several `phi` values;
- a coverage panel varying `n` at equal ranks for `S_RRF`, `S_avg`, additive
  shifted log at several `b_s`, and base-log/strength at several `B` (or
  equivalent bases `b_l`);
- an adjacent sensitivity matrix or legend marking which of
  `r`, `n`, `k`, `w_i`, `phi`, `b_s`, and `b_l/B` affects each of
  `S_RRF`, `S_avg`, `S_w`, `S_RBC`, `S_shift`, and `S_base`, including “global
  scale only” where a parameter changes magnitude but not ordering.

The caption must state held-constant values, normalization used for visual
comparison, and that curves illustrate the analytic discussion. Reference the
figure from the section near the method-sensitivity discussion. Generate the
SVG deterministically from a paper-local TypeScript script (or an already
established equivalent discovered during Build), commit the source and output,
and ensure the compiler resolves it without external files.

Run the focused mathematical-formulation feature test, the paper compiler unit
test, and the repository's proportionate check command. Compile the real paper,
inspect generated Typst for all equations/citations/figure inclusion, confirm
the PDF is nonempty, render the pages, and visually inspect the mathematical
section and figure for clipping, unreadable labels, incorrect legends, or
column-width problems.

**Tests**

Happy path: generate the figure, compile the paper, and assert the source SVG is
nonempty and referenced once; generated Typst includes the image/caption and all
revised formulas; the PDF exists and is visually correct.

- A curve silently uses different held-constant values than its caption.
- The matrix implies that `phi` affects RRF or that `B` changes base-log order.
- The equal-rank plot shows `S_avg` growing with `n`.
- The SVG is readable standalone but clipped or illegible in the paper column.
- Citations, formulas, or boundary discussion disappear during Pandoc/Typst
  conversion even though the Markdown source test passes.

**Implementation Outline**

Use small pure functions in the generator for the six displayed score families,
sample fixed documented ranges, normalize only for cross-curve visibility, and
write semantic labels into the SVG. Integrate through ordinary Markdown image
syntax unless the existing compiler requires a paper-local alternative. Keep
the section prose authoritative and the figure explanatory.

## Post-review revision: collapse the logarithmic branches

**User story:** A reader encounters one general logarithmic RRF family, can
separate global score calibration from coverage-shape tuning, and understands
why the normalized `b=1` specialization is a useful default.

**Steps:**
- [x] Step 5: Replace the two-branch verification contract
- [x] Step 6: Develop one logarithmic family through `B`, `b`, and `b=1`
- [x] Step 7: Align the sensitivity figure and verify the compiled section

### Step 5: Replace the two-branch verification contract

**Enables:** The feature test requires one general family and rejects obsolete
claims that additive-shift and base-log are separate proposals.

Revise the existing feature-test expectations around
`S_log(d;b,B)=B S_RRF(d) ln(n(d)+b)`, with `B>0`, `b>=0`, and returned-document
coverage `n(d)>=1`. Require the short calibration treatment of `B`, the longer
shape-and-boundary treatment of `b`, and the normalized `b=1` specialization.
Keep assertions that the ISR family precedes this proposal and that the
existing valid boundary, finite-range limit, and equal-rank growth conclusions
remain present.

**Tests**

Happy path: block-specific assertions find the general definition first, then
the `B`, `b`, and `b=1` developments in order.

- Reject separate `S_shift` and `S_base` definitions or a base-log branch.
- Reject an assertion that a global positive `B` changes document order.
- Reject singleton normalization stated without `B=1/ln(1+b)`, or its
  `b=1` value `B=1/ln 2`.
- Preserve the `b=0`, zero-coverage-extension, and fixed-finite-`I` edge cases.

**Implementation Outline**

Update only stable mathematical invariants and section ordering in the focused
feature test; avoid matching whole explanatory paragraphs. Carry the same
terminology into generated-Typst assertions.

### Step 6: Develop one logarithmic family through `B`, `b`, and `b=1`

**Enables:** The section teaches the collapsed proposal without losing ISR
context or mathematically valid boundary analysis.

After the complete ISR, logISR, and logN ISR treatment, lead with
`S_log(d;b,B)=B S_RRF(d) ln(n(d)+b)`. Develop its parameters separately:

- Give `B>0` a short but substantive paragraph: it is a common global scale,
  so it preserves within-family order, but it matters when the score feeds a
  threshold, is combined with differently scaled signals, or must satisfy a
  downstream calibration contract.
- Give `b>=0` the longer treatment. Explain how it changes singleton weight,
  relative rewards between coverage levels, marginal logarithmic increments,
  cross-coverage ordering, and the large-`b` approach to scaled RRF over a fixed
  finite coverage range. Retain the returned-domain and zero-coverage boundary
  distinctions, including the degeneracy at `b=0`.
- Introduce singleton normalization as
  `B=1/ln(1+b)` for `b>0`, which makes the multiplier one at `n(d)=1` and lets
  `b` control only the additional coverage reward. Then specialize to `b=1`
  and select `B=1/ln 2`, yielding
  `S_1(d)=S_RRF(d) ln(n(d)+1)/ln 2` as the simple default with a finite
  zero-coverage logarithm and unchanged singleton RRF scores.

Retain the distinction between a concave multiplier and unbounded total
equal-rank growth: the normalized family still grows proportionally to
`n ln(n+b)` as the retriever family grows, while all scores are bounded for a
fixed finite `I`. Remove the old non-equivalence argument and every leftover
claim that the shift and logarithm base define two proposal branches.

**Tests**

Happy path: the section defines the general family before interpreting either
parameter and derives the normalized `b=1` form algebraically.

- `B<=0` invalidates the stated ordering and calibration interpretation.
- `b=0` makes singleton normalization undefined even though the returned-score
  family itself remains defined.
- Changing `b` is incorrectly described as global rescaling.
- The `b=1` specialization omits `/ln 2` and therefore fails to preserve the
  singleton RRF score.
- ISR or logN ISR is moved after the proposal.

**Implementation Outline**

Reuse the current notation, citations, ISR ordering, and boundary derivations.
Replace the two proposal subsections with one reading sequence: general form,
scale calibration, shift tuning, singleton-normalized subfamily, `b=1`
default, then boundary and growth analysis.

### Step 7: Align the sensitivity figure and verify the compiled section

**Enables:** The graph, sensitivity matrix, Markdown, generated Typst, and PDF
all present the same single-family parameter story.

Replace separate shifted-log and base-log curves/rows with one `S_log` family.
Show `B` as global scale only and `b` as the coverage-shape parameter; include
the singleton-normalized `b=1, B=1/ln 2` default in the coverage panel. Update
labels, caption, legend, and matrix so no obsolete branch names or implications
remain, while preserving the earlier algorithms and ISR-family context.

**Tests**

Happy path: regenerate the deterministic SVG, run the focused feature and
compiler tests, compile the paper, and visually inspect the revised pages.

- The matrix marks `B` as changing within-family ordering.
- Curves compare `b` values while silently changing normalization.
- Any `S_shift`, `S_base`, base-log, or two-branch label survives.
- The `b=1` curve or its caption uses `B=1` instead of `1/ln 2`.
- Figure labels clip or become illegible in the paper column.

**Implementation Outline**

Update the existing pure score functions and data series rather than adding a
second figure. Regenerate the SVG, then perform focused tests, repository
checks, generated-source inspection, PDF rendering, and visual verification.

## Post-review revision: align Section 1 with the logarithmic RRF family

**User story:** A reader encounters the same logarithmic RRF family, notation,
and mathematical typography in Prior Art that the Mathematical Formulation
later defines, without turning the literature review into a second derivation.

**Steps:**
- [x] Step 8: Extend the Section 1 verification contract
- [x] Step 9: Align Prior Art terminology, formulation, and mathematical markup
- [x] Step 10: Verify generated Typst and PDF typography

### Step 8: Extend the Section 1 verification contract

**Enables:** Markdown-level regression coverage for the exact family name,
unified formula, singleton-normalized default, citations, and math markup.

Extend the focused paper test to read
`posts/rrf_coverage_normalization/sections/02_prior_art.md` and require the
exact term “logarithmic RRF family” with
`S_{\mathrm{log}}(d;b,B)=B S_{\mathrm{RRF}}(d)\ln(n(d)+b)`. Where Section 1
mentions the practical default, require
`S_1(d)=S_{\mathrm{RRF}}(d)\ln(n(d)+1)/\ln 2`. Assert that mathematical
expressions use Pandoc inline or display math rather than code spans, and that
the hidden commentary contains no stale candidate, two-branch, base-log, or
“this paper” wording. Preserve the existing direct citations to RRF, RBC, ISR,
logISR, and logN ISR sources.

**Tests**

Happy path: the Section 1 source test locates the Prior Art method blocks,
checks the family terminology and formulas in their intended block, confirms
the citation keys remain attached to the supported claims, and rejects
code-formatted mathematics.

- A formula exists elsewhere in the paper but not in Section 1.
- `log` survives where the natural logarithm should be `\ln`.
- The old `RRF(d) log(n(d)+b)` candidate or separate branch language survives
  inside the hidden commentary.
- A broad code-span rejection accidentally rejects ordinary prose identifiers
  rather than only mathematical expressions.
- Revising the commentary removes or misattributes `@cormack2009`,
  `@bailey2017`, `@mourao2014`, `@robertson2009`, or `@fox1994`.

**Implementation Outline**

Add a Prior Art source path and block-specific assertions to the existing
feature test. Match stable equations, exact terminology, and citation keys;
avoid reproducing whole paragraphs or testing incidental line wrapping.

### Step 9: Align Prior Art terminology, formulation, and mathematical markup

**Enables:** Section 1 introduces the same mathematical object and renders its
notation through the paper's embedded math fonts.

Replace code-formatted equations and symbols throughout
`02_prior_art.md` with Pandoc `$...$` or `$$...$$` mathematics, using `\ln`
for natural logarithms. In the closest-analogue commentary, name the
“logarithmic RRF family” exactly and state its general formulation before any
specialization. Mention the singleton-normalized `b=1` form only as far as it
helps distinguish the proposal from logN ISR; leave calibration, tuning,
boundary proofs, and growth analysis to Mathematical Formulation.

Update or remove the hidden candidate/two-branch language so it no longer
describes `RRF(d) log(n(d)+b)` as a tentative standalone candidate or implies
separate additive-shift and base-log proposals. Keep Section 1 scoped to
provenance and comparison: standard RRF supplies the rank kernel, Mourao et
al. supply the shifted-log ISR analogue, and BM25 and CombMNZ remain boundary
comparators under their existing citations. Do not add a novelty claim.

**Tests**

Happy path: the revised prose moves from each cited prior method to the nearest
analogue and then names the unified family without duplicating Section 2's full
derivation.

- Inline math punctuation or delimiters break Pandoc parsing.
- `R_d`, `n(d)`, ranks, parameters, or score definitions remain code spans.
- The prose calls `B` a shape parameter or `b` a global scale.
- The `b=1` form omits `/\ln 2` and therefore fails singleton normalization.
- The Prior Art discussion expands into boundary or asymptotic analysis already
  owned by Mathematical Formulation.

**Implementation Outline**

Revise the section in reading order, converting notation mechanically first and
then tightening the final comparison paragraph around the exact family name
and formulas. Retain all supported literature claims and citations unchanged
unless grammar requires moving a citation with its claim.

### Step 10: Verify generated Typst and PDF typography

**Enables:** The compiled Section 1 uses the same embedded mathematical fonts
and notation treatment as Mathematical Formulation.

Compile the real paper and inspect the Section 1 slice of generated
`build/rrf-coverage-normalization.typ`. Require native Typst math nodes for the
converted expressions, the unified family formula, the normalized `b=1`
specialization where present, and preserved citations; reject monospaced
raw/code rendering for mathematical expressions. Retain the compiler contract
that supplies the paper-local font directory with `--ignore-system-fonts`.
Render and visually inspect the Section 1 PDF pages beside the Mathematical
Formulation pages for matching math glyphs, weights, subscripts, spacing, and
line breaks.

**Tests**

Happy path: run the focused feature test and compiler test, compile the paper,
inspect generated Typst, confirm the PDF is nonempty, and visually inspect all
Section 1 pages containing mathematics.

- Pandoc emits literal backticks or raw monospaced equations.
- `S_log`, `S_RRF`, subscripts, or `\ln` render differently between sections.
- A display equation overflows the column or creates an orphaned citation.
- Embedded-font flags disappear even though the PDF happens to build with a
  system font.
- The source is correct but the generated Typst or PDF still contains stale
  wording from an unrecompiled artifact.

**Implementation Outline**

Reuse the current compiler and paper-local fonts. Add generated-Typst
assertions only where they prove conversion or font-path behavior, then perform
the existing compile, render, and visual-verification loop without changing the
template unless the source conversion exposes a genuine template defect.

**Steps:**
- [x] Step 11: Require inline mathematics throughout Section 1
- [x] Step 12: Rewrite every Section 1 formula as readable inline prose
- [x] Step 13: Repair the logarithmic-increment rendering
- [x] Step 14: Verify generated inline math and rendered page flow

### Step 11: Require inline mathematics throughout Section 1

**Enables:** The feature test fails while any display-math delimiter remains in
numbered Section 1 or Pandoc emits its formulas as display mathematics.

Extend the existing Prior Art assertions in
`mathematical-formulation.feature.test.ts`. Check the complete
`02_prior_art.md` source, including the hidden within-paper commentary, rather
than only visible method blocks. Reject every `$$` display delimiter while
retaining exact compact-form assertions for RRF, ISR, logISR, logN ISR, the
general logarithmic RRF family, and the singleton-normalized specialization.
After the real compiler runs, isolate the generated Prior Art slice and verify
that those expressions are native inline Typst math, not raw/code spans or
standalone display-math nodes. Keep the existing embedded-font assertions.

**Tests**

Happy path: arrange the full Markdown section and generated Prior Art slice,
then assert zero display delimiters, all six formula semantics, and native
inline math output.

- A `$$` pair survives inside the HTML comment and escapes a visible-only scan.
- Line wrapping changes whitespace without changing a formula.
- A formula becomes inline Markdown but Pandoc emits raw or monospaced text.
- The assertion rejects display math outside numbered Section 1.

**Implementation Outline**

Add narrow source and generated-output assertions to the existing Arrange-Act-
Assert test. Normalize only insignificant whitespace and Pandoc punctuation
escapes; continue matching operators, subscripts, parameters, denominators,
and citation-bearing prose exactly enough to catch semantic drift.

### Step 12: Rewrite every Section 1 formula as readable inline prose

**Enables:** The source-level delimiter and formula assertions pass for visible
Prior Art and hidden commentary.

Convert all eight current display blocks in `02_prior_art.md` to `$...$` inline
Pandoc math: plain RRF; ISR; logISR; logN ISR; the general logarithmic RRF
family and its `S_1` specialization; and both repeated family formulas in
hidden commentary. Preserve the
exact score names, summation domains, kernels, parameters, normalization by
`\ln 2`, citations, and explanatory claims. Integrate each equation into a
grammatical sentence with its punctuation outside or adjacent to the math as
Pandoc requires.

If a complete expression is too wide for a paper column, split or reorder the
surrounding prose so the same inline formula sits at a natural sentence
boundary. Do not shorten the mathematics, change its semantics, remove its
local citation, or restore display delimiters. Leave Mathematical Formulation
and the paper template unchanged.

**Tests**

Happy path: every visible and commented formula is inline, reads naturally in
its paragraph, and still satisfies the existing compact formula and citation
assertions.

- A multiline display block is mechanically collapsed but produces an
  unreadably long sentence.
- The ISR common factor or logarithmic-family scale factor is dropped.
- `S_1` loses singleton normalization by `\ln 2`.
- A citation is stranded from the method or empirical claim it supports.

**Implementation Outline**

Rewrite one formula-bearing paragraph at a time, beginning with its prose
subject and following immediately with the inline definition. Use sentence
boundaries and short lead-ins to control wrapping while retaining the exact
mathematical expressions in both visible prose and hidden commentary.

### Step 13: Repair the logarithmic-increment rendering

**Enables:** Mathematical Formulation visibly retains the logarithm in the
one-step coverage increment
`B\ln\left(\frac{n+1+b}{n+b}\right)` instead of allowing Pandoc's Typst output
to overlap and visually swallow `\ln`.

Add a focused regression assertion for the authored increment and its generated
Typst representation. Reject the unsupported LaTeX negative-thin-space command
`\!` in this expression and reject the resulting negative `#h(-1em)` spacing in
the generated Mathematical Formulation slice. Require the generated formula to
contain a visible `ln` immediately before the parenthesized fraction, preserving
the numerator, denominator, scale `B`, and claim of diminishing increments.

Then remove only the unsupported spacing command from
`03_mathematical_formulation.md`; do not change the equation, parameter names,
or surrounding analysis.

**Tests**

Happy path: the focused feature test recognizes
`B\ln\left(\frac{n+1+b}{n+b}\right)` in Markdown and native `B ln(...)` in the
generated Typst, with neither `\!` nor a negative horizontal-space node.

- The test passes because `ln` occurs elsewhere in the section while this
  particular increment still loses it.
- Removing spacing also removes parentheses or changes the fraction.
- Generated Typst retains `#h(-1em)` despite the source appearing correct.
- The equation is semantically correct in source but still visually overlaps.

**Implementation Outline**

First add an expression-local source assertion and a generated-output assertion
that fails on the current `\!` translation. Remove the one unsupported spacing
token, rebuild through the existing compiler, and keep the exact compact
formula assertion green.

### Step 14: Verify generated inline math and rendered page flow

**Enables:** The focused feature test passes, compiled Section 1 uses the
embedded math face with acceptable inline wrapping and spacing, and the
repaired Mathematical Formulation increment visibly includes `\ln`.

Run the focused mathematical-formulation feature test and compiler regression,
then rebuild the paper. Inspect the generated Typst Prior Art slice for native
inline representations of every converted formula, preserved citations, and
the existing embedded text, code, and math font setup. Render and visually
inspect every PDF page occupied by numbered Section 1, paying particular
attention to line breaks around the long RRF, ISR-family, and logarithmic-family
expressions and the transitions into citations.
Also inspect the Mathematical Formulation page containing
`B\ln\left(\frac{n+1+b}{n+b}\right)` and confirm that `B`, `\ln`, the
parentheses, and the fraction are distinct and correctly spaced.

If an expression creates overflow, an isolated fragment, or poor spacing,
restructure only its sentence and repeat the focused build and visual check.
Do not convert it back to display math or alter the formula to make it fit.

**Tests**

Happy path: focused checks are green, the PDF is nonempty, and visual inspection
shows inline formulas using the same math glyphs as Mathematical Formulation
without overflow, collisions, or distracting wraps; the repaired increment
renders as `B\ln((n+1+b)/(n+b))`, not as `B((n+1+b)/(n+b))`.

- Generated output is stale despite correct Markdown.
- A long expression crosses the column edge or strands punctuation/citation.
- Inline subscripts, summation limits, fractions, or `\ln` use a text/code face.
- Improving Section 1 wrapping accidentally changes unrelated section layout.

**Implementation Outline**

Use the existing Node compiler, Typst output inspection, PDF renderer, and
page-image review loop. Record focused test results and inspected page numbers;
make source-only prose adjustments for any layout defect, then rebuild and
inspect again.
