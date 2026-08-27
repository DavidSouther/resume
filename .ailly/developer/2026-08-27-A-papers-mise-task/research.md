# Research: `mise papers` task

## Topic and Intent

Add a `mise papers` task that builds both current paper PDFs.

## Search/Expand

The repository uses thin Mise task wrappers over `package.json` scripts so that `mise <task>` and `mise run <task>` remain available while npm owns the command bodies and lifecycle hooks.

## Libraries & Skills

Before doing any work in this feature, load these skills via the active harness's skill-loading mechanism: none. This task only edits local Mise and npm task declarations; no library-specific agent skill applies.

Relevant local conventions are the existing `mise.toml` task wrappers and Node 24 TypeScript entrypoints. The two current paper compilers are `posts/llm_manifold/scripts/compile-manifold-paper.ts` and `posts/rrf_coverage_normalization/scripts/compile-rrf-coverage-normalization.ts`; both delegate to `scripts/compile-paper.ts`.

## Falsification/Refine

This is a single, narrow feature. No off-the-shelf change is needed. The smallest implementation is a new npm script that invokes both existing wrappers, plus a matching `[tasks.papers]` Mise wrapper. It does not require changes to the shared compiler or paper-local assets.

## Scope

In scope: one `mise papers` entry point that runs both compiler wrappers.

Out of scope: changing either compiler, publishing PDFs, changing existing `paper:pdf` behavior, and modifying templates or fonts.

## Resolved Decisions

Use a new plural `papers` task rather than repurposing `paper:pdf`, preserving the latter's existing Manifold-only behavior. The task will run the Manifold compiler followed by the RRF compiler. No open questions remain.

## Sources

[1] `mise.toml`, local task-wrapper conventions, inspected 2026-08-27.

[2] `package.json`, local npm-script conventions, inspected 2026-08-27.

[3] `posts/llm_manifold/scripts/compile-manifold-paper.ts` and `posts/rrf_coverage_normalization/scripts/compile-rrf-coverage-normalization.ts`, local paper compiler entrypoints, inspected 2026-08-27.
