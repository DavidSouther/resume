# Research: LLMs as a Model of Syntactic Space — the Manifold Paper

## Topic and Intent

Turn the blog-tone draft at [docs/prompts/manifold.md](../../prompts/manifold.md)
into **a paper** explaining LLMs as a machine-learned model over the *syntactic
space* of language and the manifolds within it, and its **relevance to agentic
AI workflows**. The author's framing, in their own words:

- The set of all **functions** (some computable, all definable), each surrounded
  by a neighborhood of "similar but slightly different" functions (a program with
  a bug is the *correct* implementation of a *neighboring* function).
- The set of all **programs/documents**: infinitely many programs implement each
  computable function (and infinitely many implement each near-miss). A "funnel"
  maps program regions onto function regions.
- **Document/syntax space**: the LLM is trained to stay on the manifold of
  *valid* documents; generation "starts somewhere (the prompt) and wanders,"
  succeeding when the wander passes through the correct region.
- **Nudges**: an error message from a failed run is a new prompt that points the
  path toward the target; "thinking" tokens follow the same path with "wider
  curves."
- **Unwritten sections** the paper should add: Subagents; HyDE / HyPE /
  Jeopardy!; Topology of the space (the LLM "learns" the topology and tokens
  follow the terrain).

Prior art by the same author: *Fuzzy Homomorphic Endofunctors* (2024) — the
informal seed that frames LLMs as navigators of the natural-language manifold,
prompts as repositioning, and a "fuzzy radius" of valid branches.

**Decision (2026-06-25, with the author):** the paper is a **synthesis /
position paper** whose genuine contribution is the **agentic-workflow lens**, not
a new formalism. The sibling HyDE lit-review session
([2026-06-25-B-hyde-litreview](../2026-06-25-B-hyde-litreview/research.md)) stays
a **separate** deliverable, referenced lightly.

## Search/Expand

Five parallel `research:papers` / `research:public` sweeps (general lens), one
per claim area. Full citations and per-source verification flags live in the
per-skill notes under
[research/](./research/).

1. **Manifold structure of language**
   ([papers-1-manifold.md](./research/papers-1-manifold.md)).
   Well-supported as a heuristic, not a law. The manifold hypothesis is a real
   theorem [Fefferman–Mitter–Narayanan 2016]; intrinsic-dimension work shows deep
   representations occupy far fewer effective dimensions than width
   [Ansuini 2019; Pope 2021; Valeriani 2023], and human text sits at a stable
   ID ≈ 7–9 [Tulchinskii 2023]. Structure: linear-representation hypothesis
   [Park 2024], superposition polytopes [Elhage 2022]. **Caveat that must be in
   the paper:** *raw token embeddings violate* the manifold hypothesis
   [Robinson 2025] and embeddings are anisotropic / narrow-cone [Gao 2019;
   Ethayarajh 2019] — the picture holds for *contextual hidden states*, not
   static embeddings, and real data is a *union of varying-dimension manifolds*
   [Brown 2023], not one smooth surface.

2. **Program space and the function/program relation**
   ([papers-2-program-space.md](./research/papers-2-program-space.md)).
   Mostly established theory, not new: "an agent searches a vast program space" =
   program synthesis [Gulwani 2017; DreamCoder 2021]; "many programs implement
   one function" = the many-to-one denotation map and full abstraction
   [Milner 1977]; "infinitely many programs, a simplest one" = Kolmogorov
   complexity (uncomputable, so "simplest" exists but isn't findable); "pass@k =
   coverage of the correct region" = Codex/AlphaCode [Chen 2021; Li 2022]; "a bug
   is the correct implementation of a different function" = the non-equivalent
   mutant, with mutational-robustness data showing >30% of mutations are neutral
   [Schulte 2014]. **Author's own analogy (only partly supported):** that
   *syntactic* neighborhood ≈ *function-space* neighborhood on a continuous
   metric — suggestive (neutral landscapes, code2vec geometry) but not a metric
   theorem. The synthesis literature treats program space as *discrete*, not a
   continuous manifold.

3. **Generation as a trajectory / dynamical system**
   ([papers-3-dynamics.md](./research/papers-3-dynamics.md)).
   The "wander" maps cleanly onto formalism in three places: autoregressive
   decoding *is* a Markov chain with a provable stationary distribution
   [Zekri 2024]; energy-landscape views exist [residual EBMs, Deng 2020; an
   ARM↔EBM bijection, 2025]; continuous trajectories are literal in diffusion LMs
   [Li 2022], and the transformer-as-iterated-map is rigorous on depth
   [Geshkovski 2025; Neural-ODE canon]. **Gap:** the specific "basin of
   attraction toward a *correct* vs *incorrect* region" for a single forward
   generation is *not* formalized — the one paper with attractors/basins for LLM
   outputs studies the iterated paraphrase loop, not one pass. The walk is
   formalized; the landscape of correct/incorrect basins is borrowed vocabulary
   awaiting a theorem.

4. **Conditioning, CoT, in-context learning, self-correction**
   ([papers-4-cot-feedback.md](./research/papers-4-cot-feedback.md)).
   The strongest *formal* support in the whole paper. "Thinking widens the
   search" = CoT adds serial computational depth: constant-depth transformers
   are confined to TC⁰ without intermediate tokens but reach circuit-size-T
   problems with T CoT steps [Li 2024; Merrill–Sabharwal 2023; Feng 2023], and
   even *content-free* pause/filler tokens strictly enlarge expressivity
   [London–Kanade 2025; Pfau 2024]. ICL has implicit-inference accounts
   [Xie 2021; von Oswald 2023]. **The error-message nudge is contested and the
   paper must split it:** self-correction works with *external execution
   feedback* [Self-Debug, Chen 2023; CRITIC, Gou 2023] but *intrinsic*
   self-correction without it fails or degrades [Huang 2023; Kamoi 2024 TACL].
   The author's "append the error message" case is squarely the *external*-
   feedback case — defensible, and the distinction is itself a teaching point.

5. **Existing formal / categorical framings (the novelty check)**
   ([papers-5-formal-framings.md](./research/papers-5-formal-framings.md)).
   **Blunt verdict: almost every term is already formalized, often under the
   exact word.** Language as functor/homomorphism = DisCoCat [Coecke 2010];
   *"fuzzy" categorical language model* = a `[0,1]`-enriched category of texts,
   with a 2025 follow-up enriching it with **actual next-token LM probabilities**
   [Bradley–Terilla–Vlassopoulos 2021, 2025] — the single most dangerous prior
   art; manifold-of-documents / generation-as-wander = [Park 2023]; "phase space
   / statistical manifold" = Amari information geometry; "isomorphic contours of
   the loss surface" = mode connectivity [Garipov/Draxler 2018]; capability
   claims should cite transformer formal-language results [Strobl/Merrill 2024]
   rather than restate them geometrically.

## Falsification/Refine

Specific lens; the area-5 novelty sweep *is* the falsification of the paper's
original ambition, confirmed against arXiv abstracts.

- **Universal restated and refuted:** "This paper introduces a novel
  mathematical formalism for LLMs (manifold / endofunctor / fuzzy-categorical)."
  **Refuted.** Counterexamples are published and verified: Bradley et al.
  (fuzzy/enriched category of texts *with LM probabilities*), DisCoCat
  (functorial language), Park (representation-manifold generation), Amari
  (statistical manifold), Garipov/Draxler (loss-surface contours). The novel-
  formalism framing does not survive.
- **Size:** a **single document (one paper)**, not a multi-feature project. With
  the novelty ambition dropped, scope shrinks further to a synthesis/position
  paper. No large implementation; the "build" is writing + a verifiable claim
  ledger, not code.
- **Off-the-shelf:** the *pieces* are all off the shelf (above), and the RAG
  survey already taxonomizes HyDE — but **no single paper unifies the manifold /
  decoding / CoT-expressivity strands and then reads them as a recipe for
  agentic workflows.** That unification + the agentic lens is the gap the paper
  fills.
- **Smallest version that still meets the intent:** a synthesis paper that (1)
  states the manifold-of-documents picture with its caveats, (2) honestly cites
  each piece's existing formal home, (3) makes the **agentic-workflow reading**
  the contribution — prompt = reposition the start point; error-from-a-failed-run
  = the *external-feedback* nudge (with the self-correction dispute named);
  thinking tokens = a serial-compute budget (per CoT expressivity); subagents and
  HyDE/Jeopardy = worked instances of "manufacture a stand-in point, then move on
  it." The novel endofunctor formalism and the loss-landscape↔document-manifold
  bridge are **out of scope** for v1 (high-risk; would require engaging Bradley
  et al. head-on) and recorded as a deferred extension.

## Scope

**In (for the design phase):**
- A synthesis/position paper unifying the five strands above into the author's
  functions → programs → documents → wander narrative.
- The agentic-workflow lens as the stated contribution.
- An honest **claim ledger**: each load-bearing claim tagged
  *established / contested / author's-analogy*, each with its existing citation.
- The required caveats (contextual-states-not-token-embeddings; union-of-
  manifolds; external-vs-intrinsic feedback; the missing correct/incorrect-basin
  theorem).

**Out:**
- Any *new theorem* / the endofunctor-fixed-point formalism / the
  loss-landscape↔document-manifold empirical bridge (deferred extension).
- Redoing the HyDE bibliography — it is a **separate** deliverable
  ([2026-06-25-B-hyde-litreview](../2026-06-25-B-hyde-litreview/research.md));
  cite it lightly.
- Implementing, training, or benchmarking anything.

## Resolved Decisions

**Answered:**
- **What the paper is:** synthesis + agentic lens, *not* a new formalism
  (author, 2026-06-25).
- **HyDE relationship:** kept separate; light reference only (author, 2026-06-25).
- **Novelty reality:** the manifold/categorical/phase-space vocabulary is
  pre-claimed; the contribution must be the unification and the agentic reading,
  carefully bounded.
- **Strongest formal leg:** CoT-expressivity (serial-depth) results — these give
  the "thinking = wider/deeper search" claim real teeth.
- **Weakest leg / honesty risk:** the continuous *program*-space metric and the
  correct-vs-incorrect *basin* picture lack published grounding — present as analogy,
  not result.

**Open for the human (decide before/at design):**
1. **Venue & rigor target.** arXiv position paper, a workshop submission, or an
   expanded blog→arXiv note? This sets how hard the claim ledger and proofs must
   be defended, and whether Bradley et al. needs a full formal engagement (it
   does if any categorical claim is load-bearing).

   Ideally this will be a paper I can circulate both at work (Nominal.io with colleagues at Google, SpaceX, Amazon, Palantir, etc) and in my masters CS program (CUNY - Brooklyn College), with an eye to Arxiv and journal submission.
2. **What is the *one* sharp agentic claim?** "Agentic patterns (retries,
   error-feedback, thinking, subagents, HyDE) are all instances of *steering a
   trajectory on the document manifold toward a target region*" — is that the
   thesis, or is there a sharper, more falsifiable version (e.g. a predicted
   ordering of which nudges help which failure modes)?
   
   Not sure yet, we'll need to get deeper into the writing. My current approach is that this is my mental model I use to troubleshoot and evaluate agentic claims. When I read a paper, skill, or LLM program, I use this lens to contextualize what the authors are "doing" with their LLM. I have gotten deep, cross cutting insights from this approach.

3. **"Feature test" for a paper.** The developer loop expects one executable
   "done" criterion. For a paper this is not a Rust test — design must define the
   substitute (e.g. a filled section outline + a passing claim-ledger where every
   load-bearing claim is tagged and cited, reviewed against this research). Agree
   the substitute in the design phase.

  An Ailly eval. The script verifies certain sections and citations, as well as citation format, general formatting, and in the future any journal entry requirements. The "passing claim ledger" for both human and LLM judging, and the Ailly eval to run those judges.

4. **Diagrams.** The draft specifies five diagrams (functions oval, document
   ovals + funnel, blown-up syntax space, wander lines, error/thinking nudges).
   Keep all five, and in what tool/format?

   Yes, all five, as "snapshots" slides from a larger animation for the blog post explaining these ideas.

## Sources

IEEE-style; per-claim full lists (with venue, year, arXiv/DOI, and
verified-vs-aggregator flags) live in the per-skill notes under
[docs/research/](./research/).
Anchors and the highest-stakes prior art:

[1] J. M. Tyler Bradley, J. Terilla, and Y. Vlassopoulos, "An enriched category
theory of language: from syntax to semantics," 2021, arXiv:2106.07890; and
follow-up enriching with next-token LM probabilities, 2025, arXiv:2501.06662.
*(VERIFIED — closest prior art to the "fuzzy endofunctor" framing.)*
[2] B. Coecke, M. Sadrzadeh, and S. Clark, "Mathematical Foundations for a
Compositional Distributional Model of Meaning," 2010, arXiv:1003.4394. *(DisCoCat.)*
[3] G. Valeriani et al., "The geometry of hidden representations of large
transformer models," *NeurIPS*, 2023. *(Intrinsic-dimension rise-then-fall.)*
[4] E. Tulchinskii et al., "Intrinsic Dimension Estimation for Robust Detection
of AI-Generated Texts," *NeurIPS*, 2023. *(Human text ID ≈ 7–9.)*
[5] B. C. A. Brown et al., "Verifying the Union of Manifolds Hypothesis for Image
Data," *ICLR*, 2023. *(The caveat: data is a union of varying-dim manifolds.)*
[6] O. Zekri et al., "Large Language Models as Markov Chains," 2024. *(Decoding
as a Markov chain with a stationary distribution.)*
[7] Z. Li, H. Liu, T. Zhou, and T. Ma, "Chain of Thought Empowers Transformers to
Solve Inherently Serial Problems," *ICLR*, 2024, arXiv:2402.12875.
[8] W. Merrill and A. Sabharwal, "The Expressive Power of Transformers with Chain
of Thought," 2023, arXiv:2310.07923.
[9] J. Pfau, A. Merrill, and S. Bowman, "Let's Think Dot by Dot: Hidden Computation
in Transformer Language Models," 2024, arXiv:2404.15758. *(Filler tokens.)*
[10] J. Huang et al., "Large Language Models Cannot Self-Correct Reasoning Yet,"
2023, arXiv:2310.01798; R. Kamoi et al., *TACL*, 2024, arXiv:2406.01297.
*(The intrinsic-vs-external self-correction dispute.)*
[11] X. Chen et al., "Teaching Large Language Models to Self-Debug," 2023,
arXiv:2304.05128. *(External-feedback nudge — the author's error-message case.)*
[12] D. Souther, "Fuzzy Homomorphic Endofunctors," davidsouther.com, 2024.
*(The informal seed.)*
