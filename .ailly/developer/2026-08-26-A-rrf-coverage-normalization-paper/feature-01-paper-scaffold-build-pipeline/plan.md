# Implementation Plan: Shared Paper Compiler and RRF Build Pipeline

**Feature test:** `scripts/compile-paper.feature.test.ts`
**User story:** A paper author can invoke either stable paper-specific compiler, have it delegate to the one shared compiler with paper-local assets, and obtain the RRF default PDF.
**Libraries & Skills:** Load `typst-author` in each build step that creates or changes `.typ` assets. Verify local Typst 0.15.0 syntax before editing a template.

**Pattern decision:** `bootstrap-and-service` applies. `scripts/compile-paper.ts` is the reusable build service and each paper-local CLI is a thin composition root. Domain objects, newtypes, and type states do not add value to this filesystem-and-process boundary.

**Steps:**

- [x] Step 0: Define the shared compiler contract
- [x] Step 1: Move common pipeline behavior into the shared module
- [x] Step 2: Reduce both named compilers to paper-local wrappers
- [x] Step 3: Prove delegation and compile the RRF PDF

## Step 0: Define the shared compiler contract

New types and function signatures (stubs only, no bodies) in `scripts/compile-paper.ts`:

```ts
export type PaperCompilerConfig = {
	paperDir: string;
	outputPdf: string;
	typstSourceName: string;
};

export type PaperPdfPaths = {
	paperDir: string;
	sectionsDir: string;
	bibliography: string;
	buildBibliography: string;
	buildDir: string;
	typstSource: string;
	outputPdf: string;
};

export type SharedCompilerInvocation = {
	paperDir: string;
	outputPdf: string;
};

export function compilePaper(config: PaperCompilerConfig): void;
export function createPaperPdfPaths(config: PaperCompilerConfig): PaperPdfPaths;
export function observeSharedCompilerInvocationForTest(
	callback: (invocation: SharedCompilerInvocation) => void,
): () => void;
```

**Enables:** The acceptance test can identify one exported shared entry point and distinguish each wrapper's configured paper directory.

**Tests:** Add focused unit tests for path derivation from an arbitrary `paperDir` and for the observer lifecycle.

- Paper-local paths never derive from the process working directory.
- A custom output remains within the configuration contract.
- The observer is inert unless the test explicitly installs it and can be removed after a test.

**Implementation Outline:** Define a configuration that contains only the paper root and output/source-name choices. Keep templates, bibliography, font paths, and prose derived from that root so the shared module contains no paper-owned constant.

## Step 1: Move common pipeline behavior into the shared module

**Enables:** Both papers can use one implementation for section discovery, asset preparation, font validation, Pandoc, and Typst.

Build `compilePaper` so it discovers direct `sections/*.md` files in lexical filename order, fails when there are none, creates the configured paper's build directory, stages that paper's bibliography, validates that paper's manifest and local font files, runs Pandoc with that paper's templates and CSL, and runs Typst using `--ignore-system-fonts` and that paper's fonts. Preserve the existing Manifold generated-typst adjustment only through an explicit paper-local hook or configuration mechanism; do not put manuscript-specific transforms into the shared default path.

**Tests:** Add focused tests for direct-only lexical section discovery, required paper-local asset resolution, and provisioned-font validation.

- Empty sections fail before Pandoc runs.
- Nested Markdown and non-Markdown directory entries are ignored.
- Missing bibliography, template, CSL, filter, manifest, or required font fails rather than falling back to another paper.
- Digest-mismatched, escaping, duplicate, or undiscoverable required fonts fail.

**Implementation Outline:** Derive all paths from `PaperCompilerConfig.paperDir`; validate the font manifest and Typst discovery against its `fonts/` directory; execute Pandoc in the build directory; then compile the generated Typst source with only the paper-local font path.

## Step 2: Reduce both named compilers to paper-local wrappers

**Enables:** The Manifold and RRF CLIs retain their stable names while each reaches the same `compilePaper` entry point.

Replace duplicated pipeline logic in `posts/llm_manifold/scripts/compile-manifold-paper.ts` and `posts/rrf_coverage_normalization/scripts/compile-rrf-coverage-normalization.ts` with thin CLI wrappers. Each wrapper derives its own `paperDir`, supplies its own default output and generated Typst filename, parses only its documented CLI options where applicable, and calls `compilePaper` exactly once. Keep each paper's assets beneath its own directory; do not move fonts or templates into `scripts/`.

**Tests:** Update focused wrapper tests to assert their default configurations and to retain Manifold's documented CLI options.

- Launching from a different current working directory still selects the wrapper's own paper assets.
- The RRF output remains `posts/rrf_coverage_normalization/build/rrf-coverage-normalization.pdf`.
- Neither wrapper independently discovers sections, validates fonts, stages bibliography, or launches Pandoc/Typst.

**Implementation Outline:** Make wrappers responsible only for argument parsing and composition. Import the shared compiler directly and pass a config derived from the wrapper directory; leave all build steps in `scripts/compile-paper.ts`.

## Step 3: Prove delegation and compile the RRF PDF

**Enables:** The feature-test assertions that both stable CLIs traverse the shared entry point and that the RRF default output is non-empty.

Replace the RRF-only feature test with `scripts/compile-paper.feature.test.ts`. The test removes only the RRF generated default PDF, launches both named wrappers under Node, activates the shared module's explicit test-only observer, records one shared invocation per wrapper, asserts the two distinct paper roots, and asserts both process exits succeed. It then asserts that the RRF default PDF exists and has non-zero size.

**Tests:** Run the feature test as the final happy-path acceptance test, after the focused shared-module and wrapper tests.

- The observer does not alter ordinary CLI stdout, stderr, or compilation behavior.
- An invocation from either wrapper reaches the same shared exported entry point.
- A failed wrapper process cannot produce a false passing RRF output assertion.

**Implementation Outline:** Use a process-visible, test-only observer mechanism that the shared module checks only when the acceptance test enables it. The test controls only the RRF output cleanup and verifies its size after both wrapper processes succeed.
