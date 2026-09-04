# Design: `mise papers` task

## Purpose

Provide one command for a contributor who needs both current paper PDFs. `mise papers` builds the Manifold paper and the RRF coverage-normalization paper in a fixed order.

## Prior Art

`mise.toml` exposes thin wrappers around `package.json` scripts. `paper:pdf` remains the existing Manifold-only entry point. Each paper has a stable compiler wrapper that delegates to the shared paper compiler.

## User Journey and Metrics

Given a prepared checkout, a contributor runs `mise papers`. It invokes the npm task and each paper compiler wrapper once: Manifold first, then RRF. Success is both compiler commands returning successfully; a failure from Manifold stops the task before RRF runs, matching normal command sequencing.

## Specification

Add a plural npm `papers` script containing both existing wrapper invocations. Add the matching `mise.toml` `papers` task whose body is only `npm run papers`. Keep `paper:pdf` unchanged and do not alter either compiler, templates, fonts, or generated PDFs.

Feature test: [scripts/papers-mise-task.feature.test.ts](../../../scripts/papers-mise-task.feature.test.ts). It parses both declarations and asserts that `mise papers` delegates through the npm script to the two canonical compiler wrappers in the required order.

## Alternatives

Calling compiler wrappers directly from Mise would work but would duplicate the command body and bypass the repository's npm-script convention. Replacing `paper:pdf` would break its Manifold-only contract. A distinct plural task is the smallest compatible interface.

## Summary

The new `mise papers` command is an additive convenience task. No deferred decisions remain.
