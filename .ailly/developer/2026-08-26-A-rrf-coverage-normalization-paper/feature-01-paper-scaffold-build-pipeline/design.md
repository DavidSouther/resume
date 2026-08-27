# Feature Design: Paper Scaffold and Build Pipeline

## Purpose

Provide a self-contained paper directory at
`posts/rrf_coverage_normalization/` that turns its one-paragraph stub section
into a PDF. Later features can add evidence and manuscript content without
changing the build contract.

## Prior Art

`posts/llm_manifold/` already compiles ordered Markdown sections through
Pandoc and a local Typst preprint template. It validates locally provisioned
fonts and keeps generated output beneath the paper directory. This feature
extracts that common pipeline into one shared compiler module, while keeping
each paper's prose, templates, bibliography, and provisioned fonts local.

## User Journey and Metrics

Given a checkout with the provisioned Node, Pandoc, and Typst tools, a paper
author runs either paper's named compiler. Each wrapper gives the same shared
compiler its own paper-local inputs; the RRF wrapper reads the stub section and
writes a PDF below `posts/rrf_coverage_normalization/build/`. The feature is
accepted when one executable acceptance test runs both wrappers, proves that
each traverses the shared module, and finds the RRF non-empty PDF. A missing
section, bibliography, template, or required font must make compilation fail
rather than silently use another paper's assets.

## Specification

The initial RRF paper directory contains `sections/01_abstract.md` as its one
numeric, one-paragraph Markdown stub; `refs.bib`; `ieee.csl`; local copies of
`templates/manifold-preprint.typ` and
`templates/manifold-table-widths.lua`; `fonts/manifest.json`; and the font
files named by that manifest. The repository has exactly one shared compiler
module at `scripts/compile-paper.ts`. It owns section discovery, path
derivation, build-directory creation, bibliography staging, provisioned-font
validation, Pandoc execution, and Typst execution. It accepts a paper
configuration supplied by a wrapper; it contains no paper prose, template,
bibliography, font, or output-name constant.

`posts/llm_manifold/scripts/compile-manifold-paper.ts` and
`posts/rrf_coverage_normalization/scripts/compile-rrf-coverage-normalization.ts`
remain the stable named CLI entry points. Each is a thin wrapper that supplies
only its paper directory and paper-local output/name configuration to the
shared module and delegates compilation to it. Both wrappers must use the
same shared exported compilation entry point; neither may reimplement a build
step. The shared module resolves every source and generated path from the
configured paper directory. Its section-discovery contract is: read only
direct `sections/*.md` entries, sort their filenames in lexical order, pass
those paths to Pandoc in that order, ignore every other entry, and fail when
no Markdown section exists. It uses that paper's local Typst assets and fonts,
and invokes Typst with `--ignore-system-fonts`. Each font manifest must contain
valid, digest-verified files for `Libertinus Serif` and `JetBrains Mono`; the
shared compiler must verify that Typst discovers both families from that
paper's local font directory while system fonts are ignored. The RRF default
output remains
`posts/rrf_coverage_normalization/build/rrf-coverage-normalization.pdf`.

**Feature story:** Given the implemented RRF scaffold and both named paper
wrappers, when each compiler is run from the repository, then both delegate to
the one shared compiler and the RRF run exits successfully with a non-empty
PDF at its default output path.

**Executable feature test:**
`scripts/compile-paper.feature.test.ts`. It removes only the RRF generated
default PDF, launches both named wrapper CLIs with Node, and uses the shared
module's explicit test-only invocation observer to assert that each wrapper
reached the same shared compilation entry point with its own paper directory.
It asserts that both processes succeed and that the RRF output exists and is
non-empty. The observer must be activated only by the test process and must
not change ordinary CLI output or compilation behavior. This test is
intentionally red until extraction and both delegating wrappers exist.

## Alternatives

1. **Extract one shared multi-paper compiler (recommended).** This makes the
   existing and new paper wrappers exercise one build contract without sharing
   paper content or presentation assets.
2. **Copy the local manifold pipeline.** This looks smaller initially but
   leaves two independently evolving compiler implementations and does not
   meet the shared-pipeline requirement.
3. **Compile a hand-written Typst stub directly.** This is smaller today but
   does not establish the Markdown-to-PDF workflow later manuscript work
   needs.

## Summary

This feature creates only the shared compiling pipeline, two thin named
wrappers, and the RRF compiling scaffold. Paper findings, formulas, citations
beyond a minimal valid bibliography, and visual polish remain owned by later
features. The implementation phases must continue to use the `typst-author`
skill for Typst/template work.
