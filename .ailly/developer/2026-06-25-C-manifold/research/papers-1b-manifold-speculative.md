# Papers — CLAIM AREA 1B: 2026-prefixed manifold/geometry papers previously excluded

Research date: 2026-06-29. Phase: `developer:ailly` research. Skill lens:
`research:papers` with arXiv-first verification, public search spot-checks, and
local PDF retrieval where possible.

This note follows up the warning in `papers-1-manifold.md` that several
2026-prefixed ids had been excluded as possible aggregator artifacts. The three
named examples now resolve on arXiv. They should still be treated as a
speculative supplement rather than folded into the core evidence base: two are
fresh, unreviewed preprints, and one is explicitly withdrawn.

Retrieved PDFs:
- `research/pdfs/13-mabrok-latent-semantic-manifolds-2603.22301.pdf`
- `research/pdfs/14-bernas-revisiting-anisotropy-2604.08764.pdf`
- `research/pdfs/15-anderson-geometry-of-thought-2601.13358v1.pdf`

Verification legend:
- **[verified]** — arXiv abstract record resolved and the PDF was retrieved in this session.
- **[verified-withdrawn]** — arXiv record resolved, but the current record is withdrawn; the
  original versioned PDF was retrieved only for audit/context.
- **[speculative-use]** — possibly useful as recent related work, but too new or assumption-heavy
  to support a central claim without caveats.
- **[do-not-cite-as-support]** — useful only as a caution or negative evidence.

---

## Findings

### 1. `2603.22301` — "Latent Semantic Manifolds in Large Language Models"

**Status:** **[verified] [speculative-use]**. arXiv:2603.22301v1, submitted
2026-03-17, cs.LG. Author: Mohamed Mabrok. PDF retrieved locally as
`research/pdfs/13-mabrok-latent-semantic-manifolds-2603.22301.pdf`.

**What it claims.** This is the most directly aligned of the three papers. It
formalizes contextual hidden states, especially layers after the raw embedding
layer, as points on a latent semantic manifold: a low-dimensional Riemannian
submanifold of the model's ambient embedding space. It then equips that manifold
with a Fisher-information metric induced by the model's token distribution:
roughly, distance is semantic/statistical distinguishability under the softmax
head, not just Euclidean separation in residual-stream coordinates [1].

The paper's central move is to treat tokens as a Voronoi partition of this
continuous manifold. Each token owns a region of semantic space, and next-token
generation is interpreted as projection from a continuous semantic state to a
finite vocabulary cell. The paper defines an **expressibility gap** as the set of
manifold points with low margin between the winning token and the runner-up
token. It then proves two formal claims under smoothness and regularity
assumptions:

- A small-epsilon **linear volume law** for the expressibility gap, derived via
  the coarea formula.
- A **rate-distortion lower bound** saying a finite vocabulary cannot drive
  semantic distortion to zero when the underlying semantic manifold has positive
  intrinsic dimension.

**Empirical support reported by the paper.** The validation section tests six
decoder-only models across GPT-2, OPT, and Pythia families: GPT-2 124M, OPT-125M,
Pythia-160M, GPT-2 XL 1.5B, OPT-1.3B, and Pythia-1B. Reported peak TwoNN
intrinsic dimensions are around 19-22, with roughly 1-3% ambient-dimension
utilization. The reported expressibility-gap slopes range from 0.873 to 1.117
with `R^2 > 0.985`, matching the claimed near-linear scaling. The paper also
reports median margin ordering across models and interprets higher margins as a
geometrically more efficient vocabulary tessellation [1].

**How it affects the manifold paper.** This paper is useful as a recent,
on-point related-work citation for the exact "continuous latent semantic space
projected through finite language" framing. It also gives vocabulary
quantization language that may sharpen the paper's expressibility argument.
However, it should **not** become the foundation of the argument:

- It is a March 2026 preprint with no peer-reviewed venue found in this pass.
- Its strongest conclusions depend on assumptions that are doing real work:
  compact smooth manifold structure, hidden states lying on/near that manifold,
  nondegeneracy of the Fisher metric on tangent spaces, regular Voronoi
  boundaries, and representative sampling of hidden states.
- The empirical validation uses older public decoder families up to 1.5B
  parameters, not frontier-scale LLMs.
- It is unusually aligned with this paper's thesis; that makes it useful, but
  also worth treating cautiously until independent uptake appears.

**Recommended use:** cite only in a "recent speculative formalizations" or
"related emerging work" paragraph. Do not use it to replace the safer evidence
from Valeriani et al., Tulchinskii et al., Robinson et al., Park/Veitch, and the
older manifold-hypothesis literature.

### 2. `2601.13358` — "The Geometry of Thought: How Scale Restructures Reasoning in Large Language Models"

**Status:** **[verified-withdrawn] [do-not-cite-as-support]**. arXiv:2601.13358v1,
submitted 2026-01-19, cs.AI. Author: Samuel Cyrenius Anderson. The current arXiv
record is withdrawn as of 2026-03-30; the original v1 PDF was retrieved locally as
`research/pdfs/15-anderson-geometry-of-thought-2601.13358v1.pdf`.

**What v1 claimed.** The withdrawn v1 analyzes more than 25,000 chain-of-thought
trajectories across Law, Science, Code, and Math using two Llama scales
(8B and 70B). It reports domain-specific geometric phases:

- **Law / crystallization:** global dimension collapse from `d95 = 501` to `274`,
  trajectory alignment increase from `0.72` to `0.94`, and large "untangling" of
  the reasoning manifold.
- **Science and Math / liquidity:** little geometric reorganization despite the
  larger model scale.
- **Code / lattice formation:** stronger clustering into discrete strategic
  modes, with silhouette score reported as `0.13 -> 0.42`.

The paper also introduces "Neural Reasoning Operators", learned maps from initial
hidden states to terminal hidden states, and reports 63.6% probe-decoding accuracy
on legal tasks. It further claims a universal negative step-to-step coherence
around `-0.4`, interpreted as an oscillatory transformer-reasoning signature [2].

**Why it should be excluded.** The current arXiv page marks the paper withdrawn
and says the framework has fundamental theoretical errors and unsupported
conclusions. That status overrides the interesting topic fit. The local PDF is
useful only for auditability: it explains what the earlier search hit was, but it
should not be used as positive support for the manifold paper.

**Recommended use:** do not cite in the paper. At most, keep this note as a
record that the attractive "geometry of thought" hit was checked and rejected.

### 3. `2604.08764` — "Revisiting Anisotropy in Language Transformers: The Geometry of Learning Dynamics"

**Status:** **[verified] [speculative-use]**. arXiv:2604.08764v1, submitted
2026-04-09, cs.CL. Authors: Raphael Bernas, Fanny Jourdan, Antonin Poche, and
Celine Hudelot. PDF retrieved locally as
`research/pdfs/14-bernas-revisiting-anisotropy-2604.08764.pdf`.

**What it claims.** This paper reframes anisotropy as a consequence of local
geometry and training dynamics, not merely as a representational defect. It adopts
a deliberately weaker **local or stratified manifold** view: token/activation
spaces may fail to be a single global smooth manifold, but small semantic
neighborhoods can still admit local tangent approximations [3].

The theory has two parts:

- **Frequency-biased sampling.** Frequent tokens are geometrically "pinned" more
  tightly around their centroids during training, while rarer tokens retain
  larger trajectory variance. In the authors' experiments, causal decoder models
  such as Pythia and SmolLM2 show a strong negative relationship between token
  frequency and centroid distance, while EuroBERT shows a weaker but still
  detectable version [3].
- **Tangent-gradient dominance.** Under a local manifold expansion, tangent
  components are first order while normal components are second order. The paper
  argues that gradient updates therefore preferentially amplify tangent
  directions, creating a feedback loop in which anisotropy becomes concentrated
  along locally meaningful tangent directions rather than arbitrary global axes
  [3].

**Empirical support reported by the paper.** The main experiment constructs
activation-derived low-rank tangent proxies and tests them against ordinary
backpropagated gradients across encoder-style and decoder-style models:
EuroBERT-210m/610m, moderncamembert-base, OLMo-1B, Pythia-160m/410m/1B,
Gaperon-1.5B, and SmolLM2-360M/1.7B. The authors report that early training
gradients are much more energy-concentrated in the tangent proxy than in
matched-rank normal controls, often by orders of magnitude in decoder models.
They also report that tangent removal usually improves isotropy more than matched
normal removal, although the effect weakens in later training and is less strong
for EuroBERT-style encoders [3].

**How it affects the manifold paper.** This is more useful as a caveat and
mechanistic complement than as direct support for "semantic manifold" claims. It
supports the idea that anisotropy can coexist with meaningful lower-dimensional
structure, and it helps explain why naive global geometry can be misleading.
Crucially, it also warns that observed geometry may be driven by frequency,
syntax, and early training dynamics, not only by semantic content.

**Recommended use:** cite cautiously if the paper discusses anisotropy as a
complication in measuring semantic geometry. A good use would be a sentence like:
"Recent work reframes anisotropy as a local, frequency- and training-dynamics
effect rather than a simple failure of geometric structure." It should not be
used to claim that all hidden-state geometry is semantic.

---

## Cross-paper synthesis

The earlier "aggregator artifact" warning was too conservative for the three
named examples: all three now resolve to arXiv records, and all retrievable PDFs
were downloaded. The stronger warning is about **citation quality**, not
existence.

For the current manuscript, the practical sorting is:

| Paper | Existence | Citation strength | Best use |
|---|---:|---:|---|
| Mabrok, `2603.22301` | Verified active preprint | Medium-low | Recent speculative formalization of latent semantic manifolds and finite-vocabulary quantization |
| Anderson, `2601.13358` | Verified withdrawn | None as support | Audit trail only; exclude |
| Bernas et al., `2604.08764` | Verified active preprint | Medium-low | Caveat/complement on anisotropy, local manifolds, and tangent-aligned learning dynamics |

The net change from `papers-1-manifold.md` is not "these should be trusted now."
It is: **two can be mentioned as fresh speculative related work, and one should be
explicitly rejected because the arXiv record is withdrawn.**

## Claim-strength ledger

- **Resolved as real arXiv records:** all three named 2026-prefixed ids.
- **Retrieved locally:** all three PDFs, with the withdrawn paper retrieved as the
  explicit `v1` PDF.
- **Potentially useful but speculative:** Mabrok [1] and Bernas et al. [3].
- **Do not cite as support:** Anderson [2], because the current arXiv record is
  withdrawn and the author-supplied withdrawal notice says the conclusions are
  unsupported.
- **No DOI / peer-reviewed venue found in this pass:** all three should be treated
  as arXiv-stage unless later venue metadata appears.

## Sources

[1] M. Mabrok, "Latent Semantic Manifolds in Large Language Models," arXiv
preprint arXiv:2603.22301, 2026. [Online]. Available:
https://arxiv.org/abs/2603.22301 — **[verified]** arXiv record and PDF retrieved.

[2] S. C. Anderson, "The Geometry of Thought: How Scale Restructures Reasoning in
Large Language Models," arXiv preprint arXiv:2601.13358v1, 2026; current arXiv
record withdrawn 2026-03-30. [Online]. Available:
https://arxiv.org/abs/2601.13358 — **[verified-withdrawn]** current record
withdrawn; v1 PDF retrieved only for audit/context.

[3] R. Bernas, F. Jourdan, A. Poche, and C. Hudelot, "Revisiting Anisotropy in
Language Transformers: The Geometry of Learning Dynamics," arXiv preprint
arXiv:2604.08764, 2026. [Online]. Available:
https://arxiv.org/abs/2604.08764 — **[verified]** arXiv record and PDF retrieved.
