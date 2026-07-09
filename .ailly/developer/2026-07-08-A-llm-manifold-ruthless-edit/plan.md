# Implementation Plan: llm_manifold Ruthless Edit

**Feature test:** existing `posts/llm_manifold/evals/scripts/check_*.py` scripts plus stale-wording grep.
**User story:** As the author, I can use the blog as an accessible response to the paper because both center the same thesis and stale scaffolding no longer distracts from it.

**Steps:**
- [x] Step 0: Define edit contract
- [x] Step 1: Rewrite thesis/framing in paper sections
- [x] Step 2: Rewrite blog post around the operator story
- [x] Step 3: Regenerate paper and run checks
- [x] Step 4: Clean up session notes

## Step 0: Define edit contract

The exact thesis is immutable. The literature review stays. Everything in the paper is evaluated by whether it demonstrates the thesis. Everything in the blog is evaluated by whether it makes the paper's thesis accessible.

## Step 1: Rewrite thesis/framing in paper sections

Edit source sections under `posts/llm_manifold/sections/`, not generated `paper.md`, then regenerate.

## Step 2: Rewrite blog post around the operator story

Replace the old geometry-first scaffold with a blog explanation that moves from document regions to target regions, operators, failure modes, and what the paper proves out.

## Step 3: Regenerate paper and run checks

Run `compose_paper.py`, then the three eval scripts. Also grep for stale current-surface wording.

## Step 4: Clean up session notes

Leave this quickloop session with cleared artifacts and no draft markers.
