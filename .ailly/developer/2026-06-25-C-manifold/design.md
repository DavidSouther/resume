# Design: LLMs as a Model of Syntactic Space — the Manifold Paper (and Post)

*Draft 2026-06-26*

**Project phase: Review** (the project-altitude equivalent of the `*Draft*` marker —
this doc, the feature-step plan, and the Closing Bell are still being refined.)

> **Relocation note (2026-06-26).** This work began in the `ailly_two` repo under
> `docs/developer/2026-06-25-C-manifold/` and was moved here, to the `resume`
> repo, because the deliverables are a personal **blog post** and **paper**, not
> Ailly-product work. The research artifacts (`research.md`, `research/`) moved
> verbatim; cross-repo links inside `research.md` (e.g. the sibling
> `2026-06-25-B-hyde-litreview` session and the old `docs/prompts/manifold.md`)
> now point back into `ailly_two` and will not resolve from here. The blog-tone
> seed draft is now [posts/llm_manifold/post.md](../../../posts/llm_manifold/post.md);
> the paper and its eval live in [llm_manifold/](../../../llm_manifold/).

## Sizing: this is a Project, not a Feature

Decided with the author (2026-06-26): the full-prose-draft done-bar pushes this
past one feature into a **project loop** (`developer/references/project-cycle.md`).
The same five phases run at larger scale; each plan step is its own
design→cleanup cycle; the exit criterion is a **Closing Bell**, not one
continuously-red feature test; and these documents are long-lived (marked
`completed:` rather than deleted at cleanup).

The author's enumerated feature-steps:

1. **Outline + claim-ledger contract** — fix the canonical section list and the
   claim-ledger schema (every load-bearing claim tagged
   *established / contested / author's-analogy*, each with a citation). This is
   the shared contract every later step depends on. *(No dependencies; start now.)*
2. **…N-2. Per-section prose** — one feature per section, writing full prose and
   wiring each section's claims into the ledger. *(Each `Depends on: step 1`; the
   sections are largely `Parallel with:` each other once the outline is fixed.)*
3. **N-1. Holistic review** — coherence, narrative flow, and the single sharp
   agentic claim. *(Depends on: all section steps.)*
4. **N. Bibliography pass** — IEEE formatting in `refs.bib`, dedup, verify every
   citation resolves; pandoc build clean. *(Depends on: N-1.)*

## Purpose

Turn the blog-tone draft (now [post.md](../../../posts/llm_manifold/post.md)) into
a **synthesis / position paper** explaining LLMs as a machine-learned model over
the *syntactic / document space* of language — functions → programs → documents →
"wander" — and reading that picture as a **recipe for agentic AI workflows**. The
genuine contribution is the **agentic-workflow lens**, *not* a new formalism. The
paper should be circulatable at work (Nominal + colleagues) and in the author's
CUNY/Brooklyn College masters program, with an eye to arXiv and journal submission.

## Prior Art

From the research refine pass (see `research.md`): the manifold / endofunctor /
*fuzzy-categorical* / phase-space vocabulary is **already published, often under
the exact word** — most dangerously Bradley–Terilla–Vlassopoulos's `[0,1]`-enriched
category of texts *with next-token LM probabilities* (arXiv:2106.07890,
2501.06662). DisCoCat (Coecke 2010), Park (representation-manifold generation),
Amari (statistical manifold), Garipov/Draxler (loss-surface contours). The
author's own 2024 seed, *Fuzzy Homomorphic Endofunctors*, is the informal
predecessor (resume post `fuzzy_homomorphic_endofunctor.md`).

**Consequence for the design:** the novel-formalism framing does not survive, so
the contribution must be the *unification* + the *agentic reading*, carefully
bounded. The novel endofunctor/fixed-point formalism and the
loss-landscape↔document-manifold bridge are **out of scope for v1** (deferred).

## User Journey and Metrics — the Closing Bell

For a paper the "user" is a **target reader**: a competent engineer or
CS-masters peer who is fluent with LLMs but has *not* seen this framing. The
Closing Bell (exit criterion, written once now, run once near the end):

> A target reader reads the finished paper cold and can (a) restate the
> functions→programs→documents→wander picture in their own words *with* its
> stated caveats, (b) use the agentic-workflow lens to classify a concrete
> agent pattern (retry, error-feedback, thinking, subagent, HyDE) as "steering
> a trajectory toward a target region," and (c) trust the claim ledger — every
> load-bearing claim is tagged and cited, with no overclaim of novelty.

The Closing Bell has **two halves**, matching the author's "human + LLM judges":

- **Qualitative (human):** the read-cold study above. The agent does not pass it
  on the author's behalf.
- **Automated (Ailly eval):** the executable half — see Specification. It gates
  structure, IEEE citation resolution, the pandoc build, and a judge pass over
  the claim ledger. Red until the paper exists; green when the contract holds.

## Specification

### Format (decided 2026-06-26)
**Markdown + pandoc target.** Author `paper.md` in Markdown with IEEE-style inline
`[n]` references backed by `refs.bib` + an IEEE CSL; the deliverable includes a
pandoc build (`paper.md` + `refs.bib` --citeproc --csl=ieee → `.tex`/PDF) so
submission-ready output is generated, not hand-ported.

### Required sections (the outline contract — to be finalized in step 1)
Functions / programs / documents; the wander (generation as trajectory); the
agentic-workflow lens (the contribution); subagents; HyDE / HyPE / Jeopardy;
topology of the space; the **claim ledger**; required caveats
(contextual-states-not-token-embeddings; union-of-manifolds; external-vs-intrinsic
feedback; the missing correct/incorrect-basin theorem); references.

### The eval (automated half of the Closing Bell)
Lives in [llm_manifold/evals/](../../../llm_manifold/evals/). Because Ailly's eval
loop is conversation-centric (it reads a `Conversation`, not a static `.md`), the
harness needs a bridge until the **standalone/ad-hoc eval** feature lands (tracked
in `ailly_two`'s TASKS.md — deliberately kept in that repo). Eval shape:

- `script` checkers (Python) over `paper.md`: all required sections present and
  non-empty; every inline `[n]` resolves to a `refs.bib` entry with venue+year and
  arXiv/DOI; pandoc build exits 0.
- `judge` over the claim ledger: every load-bearing claim is tagged
  established/contested/author's-analogy, the required caveats are present, and no
  novelty is overclaimed (the Bradley et al. prior art is acknowledged).

### Diagrams
All five from the draft (functions oval; document ovals + funnel; blown-up syntax
space; wander lines; error/thinking nudges), produced as **snapshot stills from a
larger animation** for the blog post.

## Alternatives

**Harness location (the fork that was open when the work relocated).** Three
options were on the table when scoped inside `ailly_two`:

- *Option 1 — e2e project + external paper.* A new `e2e/manifold-paper/` Ailly
  project referencing the paper via `kind: external`, run in CI beside the other
  three e2e suites. Optimized for repo convention; gave up a single home.
- *Option 2 — colocated eval under the paper.* Everything in one folder, driven by
  `ailly -p . eval`. Optimized for one home; gave up the e2e CI convention.
- *Option 3 — structural-only, no judge.* All `program` assertions, no LLM judge.
  Optimized for offline simplicity; gave up the automated claim-ledger judging the
  author wanted.

**Decided instead:** the author relocated the whole effort to the `resume` repo —
post under `posts/llm_manifold/`, paper + evals + supporting materials under
`llm_manifold/`. That supersedes the `ailly_two`-internal location debate (it is
effectively a colocated variant of Option 2, in a different repo). The eval still
needs the conversation bridge; the standalone-eval feature that removes it stays a
tracked `ailly_two` task.

## Summary / Deferred

- **Out of scope for v1:** any new theorem; the endofunctor fixed-point formalism;
  the loss-landscape↔document-manifold empirical bridge. (Deferred extension.)
- **Separate deliverable:** the HyDE lit review (`2026-06-25-B-hyde-litreview`,
  still in `ailly_two`); cite it lightly.
- **The one sharp agentic claim** is not yet pinned — the author's working thesis
  is "agentic patterns are all instances of steering a trajectory on the document
  manifold toward a target region," used as a *mental model* for evaluating
  agentic claims. Sharpen during the writing (likely in the holistic-review step).
- **Dependency on Ailly tooling:** the `resume` repo is a Next.js site and does
  not ship the `ailly` CLI; wiring the eval to a runnable `ailly` is a build-phase
  concern recorded with the paper-project task.
