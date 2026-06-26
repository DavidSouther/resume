---
title: "LLMs as a Model of Syntactic Space: The Document Manifold and a Lens for Agentic Workflows"
author: David Souther
date: 2026
abstract: >
  TODO (step N-1). A synthesis/position paper framing LLMs as a machine-learned
  model over the syntactic/document space of language — functions → programs →
  documents → "wander" — and reading that picture as a recipe for agentic AI
  workflows. The contribution is the agentic-workflow lens, not a new formalism.
bibliography: refs.bib
csl: ieee.csl
---

<!--
DRAFT SKELETON — outline contract from
.ailly/developer/2026-06-25-C-manifold/design.md (project phase: Review).
Each section is a feature-step (design step 2..N-2). Build phase fills the prose.
Citations are IEEE-style inline [n]; keys resolve against refs.bib.
-->

## 1. Introduction

TODO. The picture in one paragraph; what is and is not being claimed (synthesis +
agentic lens, not a new formalism); roadmap.

## 2. Functions, Programs, and Documents

TODO. The set of all functions (computable subset; near-miss neighborhoods); the
many-to-one program→function denotation map [program-synthesis / full-abstraction
refs]; "a bug is the correct implementation of a neighboring function" (mutants).
**Caveat to carry:** the continuous *program*-space metric is the author's analogy,
not a metric theorem.

## 3. Generation as a Wander on the Document Manifold

TODO. Training to stay on the manifold of valid documents; generation as a
trajectory from the prompt. **Caveats to carry:** the manifold picture holds for
*contextual hidden states*, not static token embeddings (which violate it); real
data is a *union* of varying-dimension manifolds, not one smooth surface.

## 4. The Agentic-Workflow Lens (Contribution)

TODO — the load-bearing section. Prompt = reposition the start point;
error-from-a-failed-run = the *external-feedback* nudge (name the
intrinsic-vs-external self-correction dispute); thinking tokens = a serial-compute
budget (per CoT-expressivity results — the strongest formal leg).

## 5. Worked Instances

TODO. Subagents; HyDE / HyPE / Jeopardy as "manufacture a stand-in point, then move
on it." (HyDE bibliography is a *separate* deliverable; cite lightly.)

## 6. Topology of the Space

TODO. The LLM "learns" the topology; tokens follow the terrain.

## 7. Claim Ledger

Every load-bearing claim, tagged and cited. Tags: **established** / **contested** /
**author's-analogy**. (This table is the automated half of the Closing Bell's judge
target; see `evals/`.)

| # | Claim | Tag | Citation(s) |
|---|-------|-----|-------------|
| 1 | Deep representations occupy far fewer effective dimensions than width; human text sits at a stable ID ≈ 7–9 | established | [valeriani2023], [tulchinskii2023] |
| 2 | Raw token embeddings violate the manifold hypothesis / are anisotropic; the picture holds for contextual hidden states | established (caveat) | [brown2023] |
| 3 | Many programs implement one function (many-to-one denotation); "simplest" exists but is uncomputable | established | TODO (Milner; Kolmogorov) |
| 4 | A bug is the correct implementation of a neighboring function (non-equivalent mutant) | established | TODO (Schulte 2014) |
| 5 | Syntactic neighborhood ≈ function-space neighborhood on a continuous metric | author's-analogy | — |
| 6 | Autoregressive decoding is a Markov chain with a stationary distribution | established | [zekri2024] |
| 7 | A "basin of attraction toward a correct vs incorrect region" for a single forward pass | author's-analogy (gap) | — |
| 8 | CoT/thinking adds serial computational depth (TC⁰ without it; circuit-size-T with T steps); filler tokens enlarge expressivity | established | [li2024], [merrill2023], [pfau2024] |
| 9 | External execution feedback improves self-correction; intrinsic self-correction without it does not | contested/established split | [chen2023], [huang2023], [kamoi2024] |
| 10 | The manifold/categorical/phase-space vocabulary is already published (novelty bounded) | established | [bradley2021], [bradley2025], [coecke2010] |

## 8. Caveats and Scope

TODO. Consolidate: contextual-states-not-token-embeddings; union-of-manifolds;
external-vs-intrinsic feedback; the missing correct/incorrect-basin theorem; the
deferred endofunctor formalism and loss-landscape↔manifold bridge.

## References

Rendered by pandoc `--citeproc` from `refs.bib` with `ieee.csl`. See `refs.bib`.
