# Feature Cleanup: `mise papers` task

**Status:** completed 2026-08-27

## Review

Reviewed `9aa3cf045bfe2642fee96f2a0baaa1260c1bca92` against the feature design
and plan. `paper:pdf` remains the Manifold-only task. `[tasks.papers]` is a
thin Mise wrapper that delegates only to `npm run papers`, and that npm script
invokes the stable Manifold wrapper before the RRF wrapper. No compiler,
template, font, or generated-PDF source changed. No feature-scope defect was
found.

## Validation

- `mise exec -- npx vitest run scripts/papers-mise-task.feature.test.ts`
  passed: 1 file, 1 test.
- `mise run papers` passed and ran the Manifold compiler before the RRF
  compiler.
- `mise run check` passed: TypeScript and Biome.
- `git diff --check` passed.

Mise emitted non-fatal warnings that the sandbox cannot write its user cache;
the requested task and all validation commands completed successfully.

## Deferred Work

None. This cleanup does not push, open a PR, or merge.
