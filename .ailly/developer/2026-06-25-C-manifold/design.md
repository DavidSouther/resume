# Design: Agentic LLM Workflows as Trajectory-Steering on a Document Manifold

**Project phase: Review**

## Sizing: this is a Project, not a Feature

Decided with the author (2026-06-26): the full-prose-draft done-bar pushes this
past one feature into a **project loop** (`developer/references/project-cycle.md`).
The same five phases run at larger scale; each plan step is its own
design->cleanup cycle; the acceptance review is a **Literature Group Read**, not
one continuously-red feature test; and these documents are long-lived (marked
`completed:` rather than deleted at cleanup).

Sequence:

1. **Outline + claim-ledger contract + eval section list** -- replace the current
   geometry-first paper skeleton with the contribution-first outline below,
   update the claim-ledger schema, and make the section checker enforce the new
   contract. This is the shared contract every later step depends on. *(No
   dependencies; start now.)*
2. **2..N-2. Per-section prose** -- one feature per section, writing full prose
   and wiring each section's load-bearing claims into the ledger. *(Each
   `Depends on: step 1`; most sections are `Parallel with:` each other once the
   outline is fixed.)*
3. **N-1. Holistic review** -- coherence, narrative flow, and a single sharp
   agentic claim. Confirm the paper does more than rename prompt engineering by
   checking the predictive and failure-mode sections against the worked analyses.
   *(Depends on: all section steps.)*
4. **N. Bibliography and build pass** -- IEEE formatting in `refs.bib`, dedup,
   verify every citation resolves, run the pandoc/citation checks cleanly, and
   refresh any stale eval documentation. *(Depends on: N-1.)*

## Purpose

Turn the blog-tone draft (now [post.md](../../../posts/llm_manifold/post.md))
into a **synthesis / position paper** that gives engineers and CS readers a
useful diagnostic lens:

> An LLM agent workflow can be read as a sequence of operators that steer
> generation through syntactic/document space toward a target region of documents
> that are acceptable artifacts for a given task.

The genuine contribution is the **workflow-level reading**: prompt changes,
retrieval, retries, execution feedback, thinking tokens, subagents, and tree
search become comparable steering moves with different evidence, costs, and
failure modes. The paper is **not** a new theorem, a new categorical formalism,
or a claim that "LLMs are manifolds" is novel.

The deliverable should be circulatable at work (Nominal and colleagues) and in
the author's CUNY/Brooklyn College masters program, with an eye to arXiv and a
position/synthesis-friendly venue.

## Prior Art

The research refine pass and the layout meta-review both point in the same
direction: lead with the contribution and bound novelty early.

High-risk overlap:

- The manifold / endofunctor / fuzzy-categorical / phase-space vocabulary is
  already published, often under the exact word. Bradley-Terilla-Vlassopoulos's
  `[0,1]`-enriched category of texts and the 2025 next-token-LM-probability
  follow-up are the most dangerous prior art; DisCoCat, information geometry,
  mode connectivity, formal-language transformer theory, program synthesis, and
  representation-manifold work also occupy adjacent ground.
- "Generation as a trajectory" has rigorous anchors (autoregressive decoding as
  a Markov chain; sampling geometry; EBMs; diffusion LMs; transformer
  depth-dynamics), but a **correct/incorrect basin theorem for ordinary
  single-pass generation is missing**.
- "Thinking widens the search" is strongest when stated as **serial computation
  depth** from CoT/pause-token expressivity results, not as literal geometric
  curvature.
- Self-correction must split **external execution/tool feedback** from intrinsic
  self-correction. The author's error-message case is the defensible external
  feedback case.
- The new 2026 manifold/geometry follow-up research only changes citation
  hygiene: Mabrok 2026 and Bernas et al. 2026 may be cited cautiously as fresh
  speculative related work; the withdrawn "Geometry of Thought" paper must not
  be cited as support.

**Consequence for the design:** the paper should not start geometry-first.
Reviewers should see the position, its use, its novelty boundary, and its
evaluation contract before the full manifold picture. The novel-formalism frame,
the endofunctor fixed-point formalism, and the loss-landscape/document-manifold
bridge are **out of scope for v1**.

## User Journey and Metrics -- Literature Group Review

For a paper, the "user" is the **Lit Group**: a small group of engineers,
research peers, or CS-masters readers who can evaluate the paper as literature,
not only as prose. Acceptance is one or more structured Lit Group sessions in
the spirit of a Weekly AI Literature Review: the group reads the finished paper,
situates it against prior work, audits the claims, discusses whether the lens is
useful, and decides whether it is ready to circulate.

Review packet:

- The rendered paper or `paper.md`.
- The steering-operator table.
- The claim ledger with `Support`, `Does not support`, and `Risk if wrong`.
- The bibliography and pandoc/citation-check output.
- Optional: the blog-post animation stills if they are part of the explanation.

Each Lit Group session should produce notes that answer:

1. What is the paper's thesis and contribution?
2. What prior art most threatens novelty, and is it handled honestly?
3. Which claims are established, contested, author analogy, or deferred?
4. Does the steering lens classify concrete agent patterns such as retry,
   compiler-error repair, CoT/pause tokens, HyDE, ReAct, subagent review, or
   tree search?
5. What help/failure conditions does the lens predict?
6. What would group members do differently after reading the paper: prompt,
   design, debug, review, or evaluate an agent workflow?
7. What blocking issues remain before circulation or submission?

Pass condition:

> At least one Lit Group session, preferably two sessions with meaningfully
> different participant mixes, reaches group consensus that the paper is ready
> for circulation with no blocking novelty, soundness, or clarity objections. A
> passing session shows that group members can restate the thesis as a
> workflow-level lens, use the steering vocabulary on a new agent pattern, and
> trust the claim ledger because each load-bearing claim says what its citations
> do and do not support.

If a session raises a blocking issue, it becomes a new project step rather than
a failed vibe check: update the outline, prose, ledger, or bibliography until
the next Lit Group session can pass.

The automated readiness gate is a prerequisite for asking the group to review
the paper. It gates structure, citation resolution, the pandoc build, and a
judge pass over the claim ledger so the group can focus on argument quality and
literature fit rather than mechanical failures.

## Specification

### Format and file locations

Author the paper in Markdown with IEEE-style pandoc citations backed by
`refs.bib` and an IEEE CSL. The current files are:

- [posts/llm_manifold/paper.md](../../../posts/llm_manifold/paper.md)
- [posts/llm_manifold/refs.bib](../../../posts/llm_manifold/refs.bib)
- [posts/llm_manifold/evals/](../../../posts/llm_manifold/evals/)

The current `paper.md` skeleton is still geometry-first. Step 1 must rewrite it
to the outline contract below before prose work begins.

### Working title

Use a contribution-forward title shape during drafting:

> Position: Agentic LLM Workflows as Trajectory-Steering Operators on a Document
> Manifold

The exact title can soften later, but `Position:` is the right layout signal if
the target is a position/synthesis venue rather than a main-track benchmark
paper.

### Required sections: contribution-first outline contract

1. **Introduction: the lens and the claim.** State the thesis immediately:
   agent workflows are sequences of steering operators on document/syntactic
   space. Name the paper as synthesis/position work, list the contribution, and
   say what is not being claimed.
2. **Prior art and novelty boundaries.** Include a table separating "already
   formalized" from "what this paper adds." Cover Bradley/Terilla/Vlassopoulos,
   DisCoCat, information geometry, manifold/union-of-manifolds, transformer
   formal-language work, program synthesis, CoT expressivity, and
   self-correction results.
3. **The document-space model.** Introduce only the geometry needed for the
   workflow lens: functions and programs; documents and contextual
   representations; generation as trajectory. Hard caveats live here:
   contextual hidden states, not raw token embeddings; union of manifolds, not a
   single smooth document manifold; correct/incorrect basin language is an
   author analogy unless grounded.
4. **Steering operators for agentic workflows.** This is the load-bearing
   contribution section. It should contain a reusable operator table covering
   prompting, retrieval/HyDE/Jeopardy, external tool/execution feedback,
   thinking/CoT/pause tokens, subagents/multi-sample branching, ReAct-style
   tool interaction, and LATS/tree-search agents.
5. **Worked analyses.** Show the lens doing work beyond rephrasing. For each
   example, include: pattern, steering move, literature support, predicted
   failure mode, and boundary condition/counterexample. Required examples:
   compiler-error repair or Self-Debug; CoT/pause tokens; HyDE/retrieval
   expansion; subagent review or multi-sample search; ReAct/tool-interactive
   agents; LATS/tree-search agents.
6. **What this lens predicts.** State conditions under which steering should
   help, fail, or become too expensive: target observability, feedback
   reliability, search breadth, artifact inspectability, serial dependency,
   cost, and collapse onto shared prompt/context bias.
7. **Alternative views and limitations.** Compare program synthesis,
   MDP/control, information geometry, category theory, and "just prompt
   engineering." Put submission-fit limitations here too: main-track benchmark
   venues are weaker fits unless the paper adds empirical/theoretical results.
8. **Evaluation and claim ledger.** Make the ledger a main-paper quality-control
   mechanism, with appendix expansion if needed. Include the Lit Group review
   protocol and the automated-readiness judge contract.
9. **Conclusion: the checklist.** End with a reusable checklist for reading an
   agent paper or workflow through the lens: start point, target region, signal
   added, failure mode addressed, and evidence that the steering move works.
10. **References.** Rendered by pandoc `--citeproc` from `refs.bib` with the
    IEEE CSL.

### Claim ledger schema

The old ledger tag set is still right, but the schema must be richer. Every
load-bearing claim should use:

| Field | Meaning |
|---|---|
| Claim | The statement the paper relies on. |
| Status | `established`, `contested`, `author-analogy`, or `deferred`. |
| Support | Citation(s) and what exactly they support. |
| Does not support | Boundary where the citation stops. |
| Paper section | Where the claim appears. |
| Risk if wrong | What part of the argument weakens. |

Mandatory ledger rows include:

- The thesis: agentic workflows as trajectory-steering operators
  (`author-analogy`, supported by worked analyses, not by a theorem).
- Prompting/soft prompts as conditioning or latent-task location
  (`established` for conditioning; geometry is analogy).
- External feedback/tool execution improves correction (`established/contested`
  split; separate intrinsic self-correction).
- CoT/pause tokens add serial computation depth (`established`; "wider curves"
  is analogy).
- Retrieval/HyDE as manufacturing an intermediate document/context neighborhood
  (`established` for method behavior; geometry is analogy).
- Subagents, sampling, and tree search as branch exploration plus selection
  pressure (`established` where citing pass@k/LATS/ReAct; analogy where claiming
  document-space regions).
- Contextual hidden states may have low-dimensional structure; raw token
  embeddings are not the claimed manifold (`established caveat`).
- Union/local/stratified manifold caveat (`established/scoping`).
- Correct/incorrect basin language for single-pass generation
  (`author-analogy` or `deferred`).
- Bradley/Terilla/Vlassopoulos and DisCoCat bound categorical novelty
  (`established`).
- Recent 2026 manifold/anisotropy preprints are speculative related work, not
  core support (`contested`, with `Support` and `Does not support` spelling out
  the speculative status).

### The eval (automated readiness gate)

Lives in [posts/llm_manifold/evals/](../../../posts/llm_manifold/evals/). Because
Ailly's eval loop is conversation-centric (it reads a `Conversation`, not a
static `.md`), the harness needs a bridge until the standalone/ad-hoc eval
feature lands (tracked in `ailly_two`'s TASKS.md, deliberately kept in that
repo). Until then, the standalone Python checkers are the live gate, and
`manifold.yaml` records the intended Ailly shape.

Feature-test substitute path for this project loop:
[posts/llm_manifold/evals/manifold.yaml](../../../posts/llm_manifold/evals/manifold.yaml)

Eval shape:

- `script` checkers over `paper.md`: all required sections from the new outline
  are present and non-empty; every pandoc citation key resolves to `refs.bib`;
  claim-ledger citation keys are known; pandoc exits 0.
- `judge` over the claim ledger: every load-bearing claim uses the required
  schema, required caveats are present, and novelty is not overclaimed.
- Documentation must use the actual colocated paths under `posts/llm_manifold/`.

### Figures and reusable artifacts

Keep the five original conceptual diagrams as **snapshot stills from a larger
animation** for the blog post: functions oval; document ovals + funnel; blown-up
syntax space; wander lines; error/thinking nudges.

Add two paper-native reusable artifacts:

- A **steering-operator table** in Section 4.
- The **claim ledger** in Section 8, with appendix expansion if needed.

## Alternatives

**Recommended: contribution-first position/synthesis paper.** Lead with the
agentic-workflow lens, then introduce geometry only as much as the lens needs.
This matches the 2026-06-29 meta-review's venue-fit advice: reviewers see the
claim, significance, soundness contract, and limitations early.

**Rejected for v1: geometry-first paper.** The existing skeleton starts with
functions/programs/documents/wander/topology and reaches the agentic contribution
later. That layout invites reviewers to reject the paper as an overclaim about
manifolds before they see the useful workflow lens.

**Rejected for v1: new theory or benchmark paper.** A theorem, empirical
manifold study, or benchmark could improve main-track fit, but it is a different
project. It would require engaging Bradley et al., information geometry, and
representation-space measurement head-on.

**Rejected for v1: structural-only claim ledger.** A table of citations alone is
not enough. The ledger must record what each citation does **not** support and
the risk if the claim is wrong; otherwise it cannot protect the paper from
citation drift.

**Superseded location debate.** Earlier `ailly_two` alternatives about an
internal e2e project vs. colocated eval were superseded by relocating the effort
to this repo. The effective decision is a colocated paper/eval under
`posts/llm_manifold/`, with Ailly CLI wiring deferred.

## Summary / Deferred

- **Immediate next design/build step:** update `posts/llm_manifold/paper.md`,
  `posts/llm_manifold/evals/scripts/check_sections.py`, and eval documentation
  to the new contribution-first outline contract.
- **The one sharp claim:** "agentic patterns are steering operators on a
  document/syntactic trajectory" remains the working thesis. The predictive
  section and worked analyses must make it falsifiable enough to avoid reading
  as metaphor-only.
- **Out of scope for v1:** any new theorem; the endofunctor fixed-point
  formalism; the loss-landscape/document-manifold empirical bridge; a new
  benchmark.
- **Separate deliverable:** the HyDE lit review (`2026-06-25-B-hyde-litreview`,
  still in `ailly_two`); cite it lightly and use the current paper's HyDE
  coverage only as a worked steering example.
- **Dependency on Ailly tooling:** the `resume` repo does not ship the `ailly`
  CLI; wiring the eval to a runnable Ailly bridge is a build-phase concern
  recorded with the paper-project task. The standalone Python checkers remain
  the current executable gate.
