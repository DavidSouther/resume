# Feature Research: Paper Scaffold and Build Pipeline

## Topic and Intent

Create `posts/rrf_coverage_normalization/`. It must compile a one-paragraph
stub section to a PDF. It must reuse the established local Typst pipeline.
No paper findings or substantive paper sections belong in this feature.

## Search/Expand

The local `llm_manifold` pipeline already supplies the required pattern:

- `compile-manifold-paper.ts` resolves paths from the paper directory.
- It assembles numeric Markdown sections in lexical order.
- It copies `refs.bib` into ignored build output before running Pandoc.
- It invokes Pandoc with the local Typst template and table-width filter.
- It invokes Typst with provisioned fonts and `--ignore-system-fonts`.
- Its feature test exercises command construction; the new test must instead
  run the new compiler against the real stub and assert that a PDF exists.

The repository provisions Node 24, Pandoc 3.10, and Typst 0.15.0 through
`mise.toml`. Node runs TypeScript directly, per `AGENTS.md`.

## Libraries & Skills

Before doing any work in this feature, load these skills via the active
harness's skill-loading mechanism: `typst-author` for Typst/template work.
No third-party library ships a project-specific agent skill.

Read and preserve the conventions in
`posts/llm_manifold/scripts/compile-manifold-paper.ts`,
`compile-manifold-paper.feature.test.ts`,
`templates/manifold-preprint.typ`, and
`templates/manifold-table-widths.lua`. The new paper may reuse copied
source assets initially; the build implementation must not depend on the
manifold paper directory at runtime.

## Falsification/Refine

This is one feature, not a project or bug fix. An empty `sections/` directory
cannot exercise the compiler because the existing section enumerator rejects
it. The smallest valid scaffold therefore contains one neutral stub section,
a minimal bibliography file, the template/filter assets, the provisioned-font
manifest and font files, a compile script, and one executable feature test.

Do not generalize the existing pipeline into a cross-paper shared framework
in this feature. That would expand the change surface without a second caller.

## Scope

In scope: the new paper directory, its self-contained compile assets, an
npm/mise task if needed for an ergonomic paper command, and a feature test
that runs the compiler and checks its PDF output.

Out of scope: literature research, RRF formulas, simulations, comparison
tables, paper claims, visual fine-tuning beyond a valid stub PDF, and changes
to the existing `llm_manifold` paper.

## Resolved Decisions

- Use `posts/rrf_coverage_normalization/`; the project design proposes this
  full snake_case slug and its plan already scopes Feature 1 to it.
- Keep build output under that paper directory's ignored `build/` path.
- Treat the stub PDF's existence as the feature acceptance criterion. Later
  features own substantive content and rendered-layout review.
- Use the current preprint pipeline as the initial format. A separate venue
  decision remains deferred by the project design.

## Sources

[1] `posts/llm_manifold/scripts/compile-manifold-paper.ts`, local build
pipeline source, inspected 2026-08-26.

[2] `posts/llm_manifold/scripts/compile-manifold-paper.feature.test.ts`,
local pipeline test, inspected 2026-08-26.

[3] `posts/llm_manifold/fonts/manifest.json` and `mise.toml`, local tool and
font provisioning configuration, inspected 2026-08-26.

[4] `.ailly/developer/2026-08-26-A-rrf-coverage-normalization-paper/design.md`
and `plan.md`, accepted project design and Feature 1 scope, inspected
2026-08-26.
